import { BaseGovernmentConnector, validateConnectorUrlSafety } from "./base.connector.js";
import { DOCUMENT_TYPES } from "../../constants.js";

/**
 * Common noisy link patterns to discard (navigation, search, login, social).
 */
const NOISE_LINK_PATTERNS = [
    /javascript:/i,
    /mailto:/i,
    /tel:/i,
    /^#/,
    /login/i,
    /register/i,
    /signup/i,
    /sitemap/i,
    /contact/i,
    /about-us/i,
    /feedback/i,
    /privacy-policy/i,
    /terms-of-use/i,
    /disclaimer/i,
    /screen-reader/i,
    /skip-to-content/i,
    /facebook\.com/i,
    /twitter\.com/i,
    /youtube\.com/i,
    /instagram\.com/i,
    /linkedin\.com/i,
];

/**
 * Generic anchor text to discard unless parent row/context provides a real title.
 */
const GENERIC_ANCHOR_TEXT = new Set([
    "click here",
    "download",
    "view",
    "read more",
    "pdf",
    "details",
    "link",
    "more",
    "view pdf",
    "download pdf",
    "home",
    "back",
    "submit",
    "search",
]);

/**
 * Connector for State e-Gazette and Government Policy HTML listing pages.
 */
export class PortalScraperConnector extends BaseGovernmentConnector {
    /**
     * Checks if a link text or href is purely generic or navigational noise.
     *
     * @param {string} text
     * @param {string} href
     * @returns {boolean} True if noise
     */
    isNoiseLink(text, href) {
        if (!href || href === "/" || href.trim() === "#") return true;
        for (const pattern of NOISE_LINK_PATTERNS) {
            if (pattern.test(href) || pattern.test(text)) return true;
        }
        if (text.length <= 2) return true;
        return false;
    }

    /**
     * Extracts date strings from an HTML text segment.
     *
     * @param {string} text
     * @returns {string|null}
     */
    extractDateFromText(text) {
        if (!text) return null;
        // DD/MM/YYYY or DD-MM-YYYY
        const dmy = text.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{4})\b/);
        if (dmy) return dmy[1];

        // YYYY-MM-DD
        const ymd = text.match(/\b(\d{4}[/-]\d{1,2}[/-]\d{1,2})\b/);
        if (ymd) return ymd[1];

        // DD Mon YYYY (e.g. 15 Aug 2024, 05 January 2025)
        const wordDate = text.match(/\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})\b/i);
        if (wordDate) return wordDate[1];

        return null;
    }

    /**
     * Parses table rows (`<tr>`) from an HTML document.
     *
     * @param {string} html
     * @param {string} baseUrl
     * @returns {Array<Object>}
     */
    parseTableRows(html, baseUrl) {
        const items = [];
        const rowRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
        let rowMatch;

        while ((rowMatch = rowRegex.exec(html)) !== null) {
            const rowContent = rowMatch[1];
            // Skip header rows
            if (/<th\b/i.test(rowContent) && !/<td\b/i.test(rowContent)) continue;

            const linkMatch = rowContent.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
            if (!linkMatch) continue;

            const rawHref = linkMatch[1].trim();
            const anchorText = this.cleanHtml(linkMatch[2]);
            const rowText = this.cleanHtml(rowContent);

            if (this.isNoiseLink(anchorText, rawHref)) continue;

            // If anchor text is generic ("Download", "PDF"), extract title from the whole table row
            let title = anchorText;
            if (GENERIC_ANCHOR_TEXT.has(anchorText.toLowerCase()) || anchorText.length < 5) {
                // Remove the anchor text from row text to find meaningful description
                title = rowText.replace(new RegExp(anchorText, "i"), "").trim();
            }

            // Strip leading numbering or dates from title if present (e.g. "1. Notification regarding...")
            title = title.replace(/^\d+[\s.)-]+/, "").trim();
            if (!title || title.length < 5) continue;

            let docUrl;
            try {
                docUrl = new URL(rawHref, baseUrl).toString();
            } catch (_e) {
                continue;
            }

            const isPdf = docUrl.toLowerCase().endsWith(".pdf") || rawHref.toLowerCase().includes(".pdf");
            const publicationDate = this.extractDateFromText(rowText);

            items.push({
                title,
                documentUrl: docUrl,
                publicationDate,
                rawContent: rowText || title,
                isPdf,
                pdfUrl: isPdf ? docUrl : null,
            });
        }

        return items;
    }

    /**
     * Parses list items or general anchor links when tables are not present.
     *
     * @param {string} html
     * @param {string} baseUrl
     * @returns {Array<Object>}
     */
    parseGeneralLinks(html, baseUrl) {
        const items = [];
        const anchorRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
        let match;

        while ((match = anchorRegex.exec(html)) !== null) {
            const rawHref = match[1].trim();
            const text = this.cleanHtml(match[2]);

            if (this.isNoiseLink(text, rawHref)) continue;
            if (GENERIC_ANCHOR_TEXT.has(text.toLowerCase())) continue;
            if (text.length < 8) continue; // Skip short labels

            let docUrl;
            try {
                docUrl = new URL(rawHref, baseUrl).toString();
            } catch (_e) {
                continue;
            }

            const isPdf = docUrl.toLowerCase().endsWith(".pdf") || rawHref.toLowerCase().includes(".pdf");
            const publicationDate = this.extractDateFromText(text);

            items.push({
                title: text.replace(/^\d+[\s.)-]+/, "").trim(),
                documentUrl: docUrl,
                publicationDate,
                rawContent: text,
                isPdf,
                pdfUrl: isPdf ? docUrl : null,
            });
        }

        return items;
    }

    /**
     * Fetches and extracts policy documents from an HTML listing page.
     *
     * @param {Object} sourceDef
     * @param {Object} [options]
     * @param {number} [options.limit=25]
     * @returns {Promise<Array<Object>>}
     */
    async fetchAndNormalize(sourceDef, options = {}) {
        const limit = options.limit ?? 25;
        const { text: htmlText, contentType, finalUrl } = await this.safeFetch(sourceDef.officialSourceUrl, options);

        if (contentType && !contentType.includes("html") && !contentType.includes("text")) {
            throw new Error(`Expected HTML listing page, received content-type '${contentType}'`);
        }

        // 1. Try parsing tabular listing (standard for e-gazettes and government notices)
        let candidates = this.parseTableRows(htmlText, finalUrl);

        // 2. Fall back to general list/card parsing if no table items were discovered
        if (candidates.length === 0) {
            candidates = this.parseGeneralLinks(htmlText, finalUrl);
        }

        const validCandidates = candidates.slice(0, limit);
        const documents = [];

        for (const item of validCandidates) {
            // Validate extracted document URL against SSRF before emitting
            const safety = await validateConnectorUrlSafety(item.documentUrl, {
                dnsResolver: options.dnsResolver || this.dnsResolver,
            });

            if (!safety.isValid) {
                continue; // Skip dangerous/internal URLs extracted from page
            }

            documents.push(
                this.normalizeRecord(
                    {
                        ...item,
                        documentType: DOCUMENT_TYPES.GOVERNMENT_NOTIFICATION,
                    },
                    sourceDef
                )
            );
        }

        return documents;
    }
}

