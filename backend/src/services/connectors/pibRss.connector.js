import { BaseGovernmentConnector } from "./base.connector.js";
import { parsePibRssXml, extractPibReleaseContent } from "../pibWatcher.service.js";
import { DOCUMENT_TYPES } from "../../constants.js";

/**
 * Connector for official Press Information Bureau (PIB) RSS feeds.
 */
export class PibRssConnector extends BaseGovernmentConnector {
    /**
     * Fetches and normalizes press releases from a PIB RSS feed endpoint.
     *
     * @param {Object} sourceDef - Government source definition
     * @param {Object} [options]
     * @param {number} [options.limit=10] - Max items to process
     * @param {boolean} [options.fetchFullReleases=false] - Whether to fetch iframe page content
     * @returns {Promise<Array<Object>>} Normalized policy records
     */
    async fetchAndNormalize(sourceDef, options = {}) {
        const limit = options.limit ?? 10;
        const fetchFullReleases = Boolean(options.fetchFullReleases);

        const { text: xmlText, finalUrl } = await this.safeFetch(sourceDef.officialSourceUrl, options);
        const rawItems = parsePibRssXml(xmlText);
        const candidates = rawItems.slice(0, limit);
        const documents = [];

        for (const item of candidates) {
            let releaseContent = item.title;

            if (fetchFullReleases && item.prid) {
                const iframeUrl = `https://pib.gov.in/PressReleaseIframePage.aspx?PRID=${item.prid}`;
                try {
                    const pageFetch = await this.safeFetch(iframeUrl, {
                        ...options,
                        timeoutMs: Math.min(options.timeoutMs || 5000, 5000),
                    });
                    const cleaned = extractPibReleaseContent(pageFetch.text);
                    if (cleaned && cleaned.length > 80) {
                        releaseContent = cleaned;
                    }
                } catch (_pageErr) {
                    // Fall back cleanly to title
                }
            }

            const normalized = this.normalizeRecord(
                {
                    title: item.title,
                    documentUrl: item.link || finalUrl,
                    rawContent: releaseContent,
                    documentType: DOCUMENT_TYPES.GOVERNMENT_NOTIFICATION,
                    metadata: {
                        prid: item.prid,
                        bureauState: sourceDef.stateCode,
                    },
                },
                sourceDef
            );

            documents.push(normalized);
        }

        return documents;
    }
}

