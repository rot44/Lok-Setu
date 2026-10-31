import { BaseGovernmentConnector } from "./base.connector.js";
import { DOCUMENT_TYPES } from "../../constants.js";

/**
 * Connector for official Government REST/JSON API endpoints.
 */
export class ApiRestConnector extends BaseGovernmentConnector {
    /**
     * Unwraps common JSON envelopes used by Indian government data portals.
     *
     * @param {any} json
     * @returns {Array<Object>}
     */
    extractItemsFromJson(json) {
        if (!json) return [];
        if (Array.isArray(json)) return json;

        if (typeof json === "object") {
            const possibleArrays = [
                json.data,
                json.results,
                json.items,
                json.records,
                json.notifications,
                json.gazettes,
                json.circulars,
                json.documents,
            ];

            for (const candidate of possibleArrays) {
                if (Array.isArray(candidate)) {
                    return candidate;
                }
            }
        }

        return [];
    }

    /**
     * Fetches and normalizes policy documents from a government REST API endpoint.
     *
     * @param {Object} sourceDef
     * @param {Object} [options]
     * @param {number} [options.limit=25]
     * @returns {Promise<Array<Object>>}
     */
    async fetchAndNormalize(sourceDef, options = {}) {
        const limit = options.limit ?? 25;
        const { text: jsonText, finalUrl } = await this.safeFetch(sourceDef.officialSourceUrl, options);

        let parsedJson;
        try {
            parsedJson = JSON.parse(jsonText);
        } catch (err) {
            throw new Error(`Failed to parse API response as JSON: ${err.message}`);
        }

        const rawList = this.extractItemsFromJson(parsedJson);
        const candidates = rawList.slice(0, limit);
        const documents = [];

        for (const item of candidates) {
            if (!item || typeof item !== "object") continue;

            // Resolve title from common government JSON field names
            const title = (
                item.title ||
                item.name ||
                item.subject ||
                item.notificationTitle ||
                item.gazetteTitle ||
                item.heading ||
                ""
            ).trim();

            if (!title) continue;

            // Resolve document link from common field names
            const rawLink = (
                item.url ||
                item.link ||
                item.documentUrl ||
                item.fileUrl ||
                item.pdfUrl ||
                item.downloadUrl ||
                item.path ||
                ""
            ).trim();

            let documentUrl = finalUrl;
            if (rawLink) {
                try {
                    documentUrl = new URL(rawLink, finalUrl).toString();
                } catch (_e) {
                    documentUrl = rawLink;
                }
            }

            // Resolve date
            const dateVal =
                item.date ||
                item.publishedAt ||
                item.pubDate ||
                item.notificationDate ||
                item.issueDate ||
                item.createdAt ||
                null;

            // Resolve content/summary
            const content = (
                item.description ||
                item.summary ||
                item.content ||
                item.details ||
                item.text ||
                title
            ).trim();

            const isPdf = Boolean(
                item.isPdf ||
                (item.fileType && item.fileType.toLowerCase() === "pdf") ||
                documentUrl.toLowerCase().endsWith(".pdf")
            );

            const normalized = this.normalizeRecord(
                {
                    title,
                    documentUrl,
                    publicationDate: dateVal,
                    rawContent: content,
                    isPdf,
                    pdfUrl: isPdf ? documentUrl : null,
                    documentType: item.documentType || DOCUMENT_TYPES.GOVERNMENT_NOTIFICATION,
                    metadata: {
                        apiSourceId: item.id || item._id || null,
                        category: item.category || null,
                    },
                },
                sourceDef
            );

            documents.push(normalized);
        }

        return documents;
    }
}

