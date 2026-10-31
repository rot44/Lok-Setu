import { CONNECTOR_TYPES } from "../sourceRegistry.service.js";
import { BaseGovernmentConnector, isPrivateOrRestrictedIp, validateConnectorUrlSafety } from "./base.connector.js";
import { PibRssConnector } from "./pibRss.connector.js";
import { GazetteRssConnector } from "./gazetteRss.connector.js";
import { ApiRestConnector } from "./apiRest.connector.js";
import { PortalScraperConnector } from "./portalScraper.connector.js";

export {
    BaseGovernmentConnector,
    PibRssConnector,
    GazetteRssConnector,
    ApiRestConnector,
    PortalScraperConnector,
    isPrivateOrRestrictedIp,
    validateConnectorUrlSafety,
};

/**
 * Returns the appropriate modular connector instance based on source metadata.
 *
 * @param {Object} sourceDef - Registered government source definition
 * @param {Object} [options] - Connector configuration overrides (timeout, maxSizeBytes, fetcher, dnsResolver)
 * @returns {BaseGovernmentConnector}
 */
export function getConnectorForSource(sourceDef, options = {}) {
    if (!sourceDef || !sourceDef.connectorType) {
        throw new Error("Cannot select connector: missing 'connectorType' on source definition");
    }

    switch (sourceDef.connectorType) {
        case CONNECTOR_TYPES.PIB_RSS:
            return new PibRssConnector(options);

        case CONNECTOR_TYPES.GAZETTE_RSS:
        case CONNECTOR_TYPES.CUSTOM_FEED:
            return new GazetteRssConnector(options);

        case CONNECTOR_TYPES.API_REST:
            return new ApiRestConnector(options);

        case CONNECTOR_TYPES.PORTAL_SCRAPER:
            return new PortalScraperConnector(options);

        default:
            throw new Error(`Unsupported connectorType: '${sourceDef.connectorType}'`);
    }
}

/**
 * Executes a modular connector for a government source, normalizes extracted policy documents,
 * eliminates duplicate records, and isolates failures.
 *
 * @param {Object} sourceDef - Registered source definition
 * @param {Object} [options] - Fetch and extraction options
 * @returns {Promise<{ success: boolean, sourceId: string, connectorType: string, totalFound: number, documents: Array<Object>, errors: Array<string> }>}
 */
export async function fetchAndNormalizeSource(sourceDef, options = {}) {
    try {
        const connector = getConnectorForSource(sourceDef, options);
        const result = await connector.execute(sourceDef, options);

        // Deduplicate records in memory by documentUrl and title
        const seenUrls = new Set();
        const seenTitles = new Set();
        const deduplicatedDocs = [];

        for (const doc of result.documents) {
            const cleanUrl = (doc.documentUrl || "").toLowerCase();
            const cleanTitle = (doc.title || "").toLowerCase();

            if (cleanUrl && seenUrls.has(cleanUrl)) continue;
            if (cleanTitle && seenTitles.has(cleanTitle)) continue;

            if (cleanUrl) seenUrls.add(cleanUrl);
            if (cleanTitle) seenTitles.add(cleanTitle);
            deduplicatedDocs.push(doc);
        }

        return {
            ...result,
            totalFound: deduplicatedDocs.length,
            documents: deduplicatedDocs,
        };
    } catch (err) {
        return {
            success: false,
            sourceId: sourceDef?.id || "unknown",
            connectorType: sourceDef?.connectorType || "unknown",
            totalFound: 0,
            documents: [],
            errors: [err.message || String(err)],
        };
    }
}

/**
 * Batch processes multiple government sources in parallel with per-source error isolation.
 *
 * @param {Array<Object>} sourcesArray
 * @param {Object} [options]
 * @returns {Promise<Array<Object>>}
 */
export async function fetchAndNormalizeSources(sourcesArray, options = {}) {
    if (!Array.isArray(sourcesArray)) {
        throw new Error("fetchAndNormalizeSources requires an array of source definitions");
    }

    return Promise.all(sourcesArray.map((src) => fetchAndNormalizeSource(src, options)));
}

