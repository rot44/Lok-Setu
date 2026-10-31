import { Document } from "../models/document.model.js";
import { generateStructuredJson } from "./gemini.service.js";
import { indexingService } from "./indexing.service.js";
import { ApiError } from "../utils/apiError.js";

export const PIB_RSS_URL_EN = "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=48&lang=1";

/**
 * Parses raw PIB RSS XML and extracts items with title, link, and PRID.
 *
 * @param {string} xmlString
 * @returns {Array<{ title: string, link: string, prid: string }>}
 */
export const parsePibRssXml = (xmlString) => {
    if (!xmlString || typeof xmlString !== "string") {
        return [];
    }

    const items = [];
    const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
    let match;

    while ((match = itemRegex.exec(xmlString)) !== null) {
        const itemBlock = match[1];

        const titleMatch = itemBlock.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
        const linkMatch = itemBlock.match(/<link\b[^>]*>([\s\S]*?)<\/link>/i);

        const rawTitle = titleMatch ? titleMatch[1].trim() : "";
        const rawLink = linkMatch ? linkMatch[1].trim() : "";

        // Unescape standard XML entities
        const cleanTitle = rawTitle
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim();

        // Extract PRID (Press Release ID)
        const pridMatch = rawLink.match(/PRID=(\d+)/i);
        const prid = pridMatch ? pridMatch[1] : "";

        if (cleanTitle && rawLink) {
            items.push({
                title: cleanTitle,
                link: rawLink,
                prid,
            });
        }
    }

    return items;
};

/**
 * Strips styles, scripts, and HTML markup from PIB release pages.
 *
 * @param {string} html
 * @returns {string} Plain text
 */
export const extractPibReleaseContent = (html) => {
    if (!html || typeof html !== "string") {
        return "";
    }

    return html
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
};

/**
 * Gemini JSON schema for classifying civic press releases.
 */
export const PIB_CLASSIFICATION_SCHEMA = {
    type: "OBJECT",
    properties: {
        isCivicPolicyOrWelfare: {
            type: "BOOLEAN",
            description:
                "True if this press release announces a government scheme, subsidy, citizen welfare policy, compliance regulation, or public service update. False if it is a general speech, diplomatic meeting, tribute, or political event.",
        },
        title: {
            type: "STRING",
            description: "Clean, standardized title of the scheme, notification, or policy.",
        },
        documentType: {
            type: "STRING",
            enum: [
                "welfare_policy",
                "government_notification",
                "circular",
                "subsidies_grants",
            ],
            description: "Categorization of the government action.",
        },
        jurisdictionLevel: {
            type: "STRING",
            enum: ["central", "state", "municipal"],
            description: "Jurisdiction level. Default to central for PIB central releases.",
        },
        applicableState: {
            type: "STRING",
            description:
                "Applicable Indian state name, or 'ALL' if it applies nationwide across India.",
        },
        issuingAuthority: {
            type: "STRING",
            description:
                "Official Nodal Ministry or Statutory Department (e.g., 'Ministry of Rural Development').",
        },
        summary: {
            type: "STRING",
            description:
                "A concise 2-sentence citizen-friendly summary of the policy decision and its impact.",
        },
        tags: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "3 to 5 relevant civic tags (e.g., ['Rural Development', 'Connectivity', 'Infrastructure']).",
        },
        applicationDeadline: {
            type: "STRING",
            description:
                "Explicit deadline or application date if mentioned, or null if ongoing/unspecified.",
        },
    },
    required: [
        "isCivicPolicyOrWelfare",
        "title",
        "documentType",
        "jurisdictionLevel",
        "applicableState",
        "issuingAuthority",
        "summary",
        "tags",
    ],
};

/**
 * Syncs recent PIB press releases into Lok Setu's Document knowledge base.
 *
 * @param {Object} options
 * @param {number} [options.limit=10] - Number of recent releases to inspect
 * @param {Function} [options.fetchFn=globalThis.fetch] - HTTP fetch function
 * @returns {Promise<{ syncedCount: number, skippedCount: number, items: Array }>}
 */
export const syncLatestPibReleases = async ({
    limit = 10,
    fetchFn = globalThis.fetch,
} = {}) => {
    // 1. Fetch live RSS XML from PIB
    const rssResponse = await fetchFn(PIB_RSS_URL_EN, {
        headers: {
            "User-Agent": "Mozilla/5.0 (compatible; LokSetuGovSync/1.0)",
            Accept: "application/xml, text/xml, */*",
        },
    });

    if (!rssResponse.ok) {
        throw new ApiError(
            502,
            `Failed to fetch PIB RSS feed: HTTP ${rssResponse.status} ${rssResponse.statusText}`
        );
    }

    const xmlText = await rssResponse.text();
    const rawItems = parsePibRssXml(xmlText);
    const candidateItems = rawItems.slice(0, limit);

    let syncedCount = 0;
    let skippedCount = 0;
    const syncedDocuments = [];

    for (const item of candidateItems) {
        // 2. Check if already ingested in database
        const existingDoc = await Document.findOne({
            $or: [{ officialPortalUrl: item.link }, { title: item.title }],
        });

        if (existingDoc) {
            skippedCount++;
            continue;
        }

        // 3. Fetch full release text via PIB iframe URL
        const iframeUrl = item.prid
            ? `https://pib.gov.in/PressReleaseIframePage.aspx?PRID=${item.prid}`
            : item.link;

        let releaseText = item.title;
        try {
            const pageRes = await fetchFn(iframeUrl, {
                headers: { "User-Agent": "Mozilla/5.0" },
            });
            if (pageRes.ok) {
                const pageHtml = await pageRes.text();
                const extracted = extractPibReleaseContent(pageHtml);
                if (extracted && extracted.length > 80) {
                    releaseText = extracted;
                }
            }
        } catch (_fetchErr) {
            // Fallback to title
        }

        // 4. Classify via Gemini
        const prompt = `
Analyze the following official Indian government press release:
TITLE: "${item.title}"
URL: "${item.link}"
CONTENT:
${releaseText.slice(0, 4000)}

Determine if this is an official welfare scheme, government subsidy, citizen policy update, statutory regulation, or public infrastructure announcement that impacts citizens or businesses.
If YES: Extract structured details according to schema.
If NO (e.g. routine tributes, sports awards, diplomatic greetings, political speeches): Set isCivicPolicyOrWelfare to false.
`;

        try {
            const classification = await generateStructuredJson({
                prompt,
                responseSchema: PIB_CLASSIFICATION_SCHEMA,
                systemInstruction:
                    "You are the official policy classifier for Lok-Setu. Accurately identify genuine citizen welfare policies, schemes, and statutory notifications.",
            });

            if (!classification?.isCivicPolicyOrWelfare) {
                skippedCount++;
                continue;
            }

            // Parse and sanitize deadline if present
            let parsedDeadline = null;
            if (classification.applicationDeadline && typeof classification.applicationDeadline === "string") {
                const trimmed = classification.applicationDeadline.trim();
                if (
                    !trimmed.toLowerCase().includes("not clearly specify") &&
                    !trimmed.toLowerCase().includes("unspecified") &&
                    !trimmed.toLowerCase().includes("null")
                ) {
                    const parsed = new Date(trimmed);
                    if (!isNaN(parsed.getTime())) {
                        parsedDeadline = parsed;
                    }
                }
            }

            // 5. Create Document record
            const newDoc = await Document.create({
                title: classification.title || item.title,
                documentType: classification.documentType || "government_notification",
                jurisdictionLevel: classification.jurisdictionLevel || "central",
                applicableState: classification.applicableState || "ALL",
                applicableDistrict: "ALL",
                issuingAuthority:
                    classification.issuingAuthority || "Press Information Bureau",
                rawExtractedText: releaseText,
                officialPortalUrl: item.link,
                notificationDate: new Date(),
                applicationDeadline: parsedDeadline,
                isActive: true,
                tags: classification.tags || ["PIB", "Government Notification"],
            });

            // 6. Vector Index the Document for Civic Assistant
            try {
                await indexingService.indexDocument(newDoc._id);
            } catch (indexErr) {
                console.warn(
                    `[PIB Watcher] Document indexed with fallback: ${indexErr.message}`
                );
            }

            syncedDocuments.push({
                _id: newDoc._id,
                title: newDoc.title,
                issuingAuthority: newDoc.issuingAuthority,
                applicableState: newDoc.applicableState,
            });

            syncedCount++;
        } catch (classifyErr) {
            console.error(
                `[PIB Watcher] Classification failed for "${item.title}":`,
                classifyErr.message
            );
            skippedCount++;
        }

        // Throttle to respect Gemini API rate limits
        await new Promise((r) => setTimeout(r, 2000));
    }

    return {
        syncedCount,
        skippedCount,
        totalInspected: candidateItems.length,
        items: syncedDocuments,
    };
};

