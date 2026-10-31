import { BaseGovernmentConnector } from "./base.connector.js";
import { DOCUMENT_TYPES } from "../../constants.js";

/**
 * Connector for State e-Gazette and Government RSS 2.0 & Atom feeds.
 */
export class GazetteRssConnector extends BaseGovernmentConnector {
    /**
     * Unescapes standard XML entities in text.
     *
     * @param {string} str
     * @returns {string}
     */
    unescapeXml(str) {
        if (!str || typeof str !== "string") return "";
        return str
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
            .trim();
    }

    /**
     * Parses an RSS 2.0 or Atom XML feed string into raw document items.
     *
     * @param {string} xmlText
     * @param {string} baseUrl
     * @returns {Array<Object>}
     */
    parseFeedXml(xmlText, baseUrl) {
        if (!xmlText || typeof xmlText !== "string") return [];

        const isAtom = /<feed\b[^>]*>/i.test(xmlText);
        return isAtom ? this.parseAtomFeed(xmlText, baseUrl) : this.parseRssFeed(xmlText, baseUrl);
    }

    /**
     * Parses RSS 2.0 items.
     *
     * @param {string} xmlText
     * @param {string} baseUrl
     * @returns {Array<Object>}
     */
    parseRssFeed(xmlText, baseUrl) {
        const items = [];
        const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
        let match;

        while ((match = itemRegex.exec(xmlText)) !== null) {
            const block = match[1];

            const titleMatch = block.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
            const linkMatch = block.match(/<link\b[^>]*>([\s\S]*?)<\/link>/i);
            const descMatch = block.match(/<description\b[^>]*>([\s\S]*?)<\/description>/i);
            const pubDateMatch = block.match(/<pubDate\b[^>]*>([\s\S]*?)<\/pubDate>/i);
            const enclosureMatch = block.match(/<enclosure\b[^>]*url=["']([^"']+)["'][^>]*>/i);

            const title = this.unescapeXml(titleMatch ? titleMatch[1] : "");
            const rawLink = this.unescapeXml(linkMatch ? linkMatch[1] : "");
            const description = this.cleanHtml(this.unescapeXml(descMatch ? descMatch[1] : ""));
            const pubDate = pubDateMatch ? pubDateMatch[1].trim() : null;
            const enclosureUrl = enclosureMatch ? enclosureMatch[1].trim() : null;

            let docUrl = rawLink || enclosureUrl || baseUrl;
            try {
                docUrl = new URL(docUrl, baseUrl).toString();
            } catch (_e) {
                // Keep raw link
            }

            const isPdf = Boolean(
                (enclosureUrl && enclosureUrl.toLowerCase().endsWith(".pdf")) ||
                docUrl.toLowerCase().endsWith(".pdf") ||
                (enclosureMatch && /type=["']application\/pdf["']/i.test(enclosureMatch[0]))
            );

            if (title && docUrl) {
                items.push({
                    title,
                    documentUrl: docUrl,
                    publicationDate: pubDate,
                    rawContent: description || title,
                    isPdf,
                    pdfUrl: isPdf ? docUrl : null,
                });
            }
        }

        return items;
    }

    /**
     * Parses Atom feed entries.
     *
     * @param {string} xmlText
     * @param {string} baseUrl
     * @returns {Array<Object>}
     */
    parseAtomFeed(xmlText, baseUrl) {
        const items = [];
        const entryRegex = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
        let match;

        while ((match = entryRegex.exec(xmlText)) !== null) {
            const block = match[1];

            const titleMatch = block.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
            const linkMatch = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i);
            const summaryMatch = block.match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/i);
            const contentMatch = block.match(/<content\b[^>]*>([\s\S]*?)<\/content>/i);
            const updatedMatch = block.match(/<(?:updated|published)\b[^>]*>([\s\S]*?)<\/(?:updated|published)>/i);

            const title = this.unescapeXml(titleMatch ? titleMatch[1] : "");
            const rawHref = linkMatch ? linkMatch[1].trim() : "";
            const rawSummary = summaryMatch ? summaryMatch[1] : (contentMatch ? contentMatch[1] : "");
            const summary = this.cleanHtml(this.unescapeXml(rawSummary));
            const pubDate = updatedMatch ? updatedMatch[1].trim() : null;

            let docUrl = rawHref || baseUrl;
            try {
                docUrl = new URL(docUrl, baseUrl).toString();
            } catch (_e) {
                // Keep raw
            }

            const isPdf = docUrl.toLowerCase().endsWith(".pdf");

            if (title && docUrl) {
                items.push({
                    title,
                    documentUrl: docUrl,
                    publicationDate: pubDate,
                    rawContent: summary || title,
                    isPdf,
                    pdfUrl: isPdf ? docUrl : null,
                });
            }
        }

        return items;
    }

    /**
     * Fetches and normalizes RSS 2.0 or Atom feed notifications.
     *
     * @param {Object} sourceDef
     * @param {Object} [options]
     * @param {number} [options.limit=20]
     * @returns {Promise<Array<Object>>}
     */
    async fetchAndNormalize(sourceDef, options = {}) {
        const limit = options.limit ?? 20;
        const { text: xmlText, finalUrl } = await this.safeFetch(sourceDef.officialSourceUrl, options);
        const rawItems = this.parseFeedXml(xmlText, finalUrl);
        const candidates = rawItems.slice(0, limit);

        return candidates.map((item) =>
            this.normalizeRecord(
                {
                    ...item,
                    documentType: DOCUMENT_TYPES.GOVERNMENT_NOTIFICATION,
                },
                sourceDef
            )
        );
    }
}

