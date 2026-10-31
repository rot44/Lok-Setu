import { JURISDICTION_LEVELS } from "../constants.js";

/**
 * Supported connector types for government policy & notification ingestion.
 */
export const CONNECTOR_TYPES = Object.freeze({
    PIB_RSS: "pib_rss",
    GAZETTE_RSS: "gazette_rss",
    PORTAL_SCRAPER: "portal_scraper",
    API_REST: "api_rest",
    CUSTOM_FEED: "custom_feed",
});

/**
 * Official lifecycle progression of a policy ingestion source.
 * Tracks source maturity from initial discovery to active production sync.
 */
export const SOURCE_LIFECYCLE_STAGES = Object.freeze({
    DISCOVERED: "discovered",
    URL_VERIFIED: "url_verified",
    CONNECTOR_IMPLEMENTED: "connector_implemented",
    CONFIGURED: "configured",
    SYNCHRONIZED: "synchronized",
    BLOCKED_OR_UNAVAILABLE: "blocked_or_unavailable",
});

/**
 * Synchronization execution statuses.
 */
export const SYNC_STATUSES = Object.freeze({
    IDLE: "idle",
    IN_PROGRESS: "in_progress",
    SUCCESS: "success",
    FAILED: "failed",
});

/**
 * Recognized Indian State and Union Territory 2-letter postal/ISO codes, plus 'ALL' for central/national.
 */
export const VALID_INDIAN_STATE_CODES = Object.freeze(
    new Set([
        "ALL", // Pan-India / National Central scope
        // 28 States
        "AP", "AR", "AS", "BR", "CG", "CT", "GA", "GJ", "HR", "HP",
        "JH", "KA", "KL", "MP", "MH", "MN", "ML", "MZ", "NL", "OD",
        "OR", "PB", "RJ", "SK", "TN", "TG", "TS", "TR", "UP", "UK",
        "UT", "WB",
        // 8 Union Territories
        "AN", "CH", "DH", "DN", "DL", "JK", "LA", "LD", "PY",
    ])
);

/**
 * Custom error class for government source registry validation failures.
 */
export class SourceValidationError extends Error {
    constructor(message, errors = []) {
        super(message);
        this.name = "SourceValidationError";
        this.errors = errors;
    }
}

/**
 * Validates an official source URL against http/https standards and domain consistency.
 *
 * @param {string} urlString
 * @param {string} officialDomain
 * @returns {{ isValid: boolean, error?: string, parsedUrl?: URL }}
 */
export function validateSourceUrl(urlString, officialDomain) {
    if (typeof urlString !== "string" || !urlString.trim()) {
        return { isValid: false, error: "Official source URL is required and must be a non-empty string" };
    }

    let parsed;
    try {
        parsed = new URL(urlString.trim());
    } catch (_e) {
        return { isValid: false, error: `Invalid URL format: '${urlString}'` };
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { isValid: false, error: `URL must use http or https protocol: '${urlString}'` };
    }

    if (officialDomain && typeof officialDomain === "string") {
        const cleanDomain = officialDomain.trim().toLowerCase();
        const hostname = parsed.hostname.toLowerCase();
        if (hostname !== cleanDomain && !hostname.endsWith(`.${cleanDomain}`)) {
            return {
                isValid: false,
                error: `URL host '${hostname}' does not match official domain '${cleanDomain}'`,
                parsedUrl: parsed,
            };
        }
    }

    return { isValid: true, parsedUrl: parsed };
}

/**
 * Performs rigorous structural and semantic validation on a government source definition.
 *
 * @param {Object} source - The source definition candidate
 * @param {Set<string>|Array<string>} [existingIds] - Optional set of already-registered IDs for duplicate checking
 * @returns {{ isValid: boolean, errors: string[] }}
 */
export function validateSourceDefinition(source, existingIds = new Set()) {
    const errors = [];
    const idSet = existingIds instanceof Set ? existingIds : new Set(existingIds);

    if (!source || typeof source !== "object") {
        return { isValid: false, errors: ["Source definition must be an object"] };
    }

    // 1. Stable Source ID validation
    if (!source.id || typeof source.id !== "string" || !source.id.trim()) {
        errors.push("Missing required field: 'id'");
    } else {
        const trimmedId = source.id.trim();
        if (!/^[a-z0-9_-]+$/i.test(trimmedId)) {
            errors.push(`Source ID '${trimmedId}' contains invalid characters (allowed: alphanumeric, underscore, hyphen)`);
        }
        if (idSet.has(trimmedId)) {
            errors.push(`Duplicate source ID: '${trimmedId}' is already registered`);
        }
    }

    // 2. Source Name validation
    if (!source.name || typeof source.name !== "string" || !source.name.trim()) {
        errors.push("Missing required field: 'name'");
    }

    // 3. Jurisdiction Level validation
    const validJurisdictions = Object.values(JURISDICTION_LEVELS);
    if (!source.jurisdictionLevel) {
        errors.push("Missing required field: 'jurisdictionLevel'");
    } else if (!validJurisdictions.includes(source.jurisdictionLevel)) {
        errors.push(`Invalid jurisdictionLevel: '${source.jurisdictionLevel}'. Must be one of: ${validJurisdictions.join(", ")}`);
    }

    // 4. Department / Issuing Authority validation
    if (!source.department || typeof source.department !== "string" || !source.department.trim()) {
        errors.push("Missing required field: 'department'");
    }

    // 5. Connector Type validation
    const validConnectors = Object.values(CONNECTOR_TYPES);
    if (!source.connectorType) {
        errors.push("Missing required field: 'connectorType'");
    } else if (!validConnectors.includes(source.connectorType)) {
        errors.push(`Unsupported connectorType: '${source.connectorType}'. Must be one of: ${validConnectors.join(", ")}`);
    }

    // 6. Official Domain validation
    if (!source.officialDomain || typeof source.officialDomain !== "string" || !source.officialDomain.trim()) {
        errors.push("Missing required field: 'officialDomain'");
    }

    // 7. Official Source URL validation
    if (!source.officialSourceUrl) {
        errors.push("Missing required field: 'officialSourceUrl'");
    } else {
        const urlValidation = validateSourceUrl(source.officialSourceUrl, source.officialDomain);
        if (!urlValidation.isValid) {
            errors.push(urlValidation.error);
        }
    }

    // 8. Polling Interval validation
    if (source.pollingIntervalHours === undefined || source.pollingIntervalHours === null) {
        errors.push("Missing required field: 'pollingIntervalHours'");
    } else {
        const interval = Number(source.pollingIntervalHours);
        if (Number.isNaN(interval) || !Number.isInteger(interval) || interval < 1 || interval > 720) {
            errors.push(`Invalid pollingIntervalHours: '${source.pollingIntervalHours}'. Must be an integer between 1 and 720`);
        }
    }

    // 9. Jurisdiction Metadata Consistency
    if (source.jurisdictionLevel === JURISDICTION_LEVELS.CENTRAL) {
        if (source.stateCode && source.stateCode.toUpperCase() !== "ALL") {
            errors.push(`Central jurisdiction source must have stateCode 'ALL' or undefined, received '${source.stateCode}'`);
        }
    } else if (source.jurisdictionLevel === JURISDICTION_LEVELS.STATE) {
        if (!source.stateCode || typeof source.stateCode !== "string") {
            errors.push("State jurisdiction source requires a valid 2-letter 'stateCode'");
        } else {
            const upperCode = source.stateCode.trim().toUpperCase();
            if (upperCode === "ALL" || !VALID_INDIAN_STATE_CODES.has(upperCode)) {
                errors.push(`Invalid stateCode '${source.stateCode}' for state jurisdiction. Must be a valid Indian state/UT code`);
            }
        }
    } else if (source.jurisdictionLevel === JURISDICTION_LEVELS.MUNICIPAL) {
        if (!source.stateCode || typeof source.stateCode !== "string") {
            errors.push("Municipal jurisdiction source requires a valid parent 'stateCode'");
        } else {
            const upperCode = source.stateCode.trim().toUpperCase();
            if (upperCode === "ALL" || !VALID_INDIAN_STATE_CODES.has(upperCode)) {
                errors.push(`Invalid stateCode '${source.stateCode}' for municipal jurisdiction. Must be a valid Indian state/UT code`);
            }
        }
        if (!source.municipality || typeof source.municipality !== "string" || !source.municipality.trim()) {
            errors.push("Municipal jurisdiction source requires a non-empty 'municipality' name or identifier");
        }
    }

    // 10. Coverage Lifecycle Stage validation (if supplied)
    if (source.coverageStatus !== undefined) {
        const validStages = Object.values(SOURCE_LIFECYCLE_STAGES);
        if (!validStages.includes(source.coverageStatus)) {
            errors.push(`Invalid coverageStatus: '${source.coverageStatus}'. Must be one of: ${validStages.join(", ")}`);
        }
    }

    // 11. Sync Status validation (if supplied)
    if (source.syncStatus !== undefined) {
        const validStatuses = Object.values(SYNC_STATUSES);
        if (!validStatuses.includes(source.syncStatus)) {
            errors.push(`Invalid syncStatus: '${source.syncStatus}'. Must be one of: ${validStatuses.join(", ")}`);
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
}

/**
 * Asserts that a source definition is valid. Throws SourceValidationError if invalid.
 *
 * @param {Object} source
 * @param {Set<string>|Array<string>} [existingIds]
 */
export function assertValidSourceDefinition(source, existingIds = new Set()) {
    const { isValid, errors } = validateSourceDefinition(source, existingIds);
    if (!isValid) {
        throw new SourceValidationError(
            `Government source validation failed for '${source?.id || "unnamed"}':\n- ${errors.join("\n- ")}`,
            errors
        );
    }
}

/**
 * Central registry managing government policy and notification sources across all administrative tiers.
 */
export class GovernmentSourceRegistry {
    constructor() {
        /** @type {Map<string, Object>} */
        this._sources = new Map();
    }

    /**
     * Registers a single government source definition after strict validation.
     *
     * @param {Object} sourceDef
     * @returns {Object} Normalized registered source object
     */
    registerSource(sourceDef) {
        assertValidSourceDefinition(sourceDef, this._sources.keys());

        const normalized = {
            id: sourceDef.id.trim(),
            name: sourceDef.name.trim(),
            jurisdictionLevel: sourceDef.jurisdictionLevel,
            stateCode: sourceDef.stateCode ? sourceDef.stateCode.trim().toUpperCase() : "ALL",
            department: sourceDef.department.trim(),
            connectorType: sourceDef.connectorType,
            officialSourceUrl: sourceDef.officialSourceUrl.trim(),
            officialDomain: sourceDef.officialDomain.trim().toLowerCase(),
            isEnabled: sourceDef.isEnabled !== undefined ? Boolean(sourceDef.isEnabled) : true,
            pollingIntervalHours: Number(sourceDef.pollingIntervalHours),
            coverageStatus: sourceDef.coverageStatus || SOURCE_LIFECYCLE_STAGES.CONFIGURED,
            syncStatus: sourceDef.syncStatus || SYNC_STATUSES.IDLE,
            lastAttemptedSync: sourceDef.lastAttemptedSync || null,
            lastSuccessfulSync: sourceDef.lastSuccessfulSync || null,
            lastError: sourceDef.lastError || null,
            municipality: sourceDef.municipality ? sourceDef.municipality.trim() : null,
            description: sourceDef.description ? sourceDef.description.trim() : "",
            tags: Array.isArray(sourceDef.tags) ? [...sourceDef.tags] : [],
            format: sourceDef.format || "rss",
        };

        this._sources.set(normalized.id, normalized);
        return { ...normalized };
    }

    /**
     * Batch registers an array of government sources.
     *
     * @param {Array<Object>} sourcesArray
     * @returns {Array<Object>}
     */
    registerSources(sourcesArray) {
        if (!Array.isArray(sourcesArray)) {
            throw new SourceValidationError("registerSources requires an array of source definitions");
        }
        return sourcesArray.map((src) => this.registerSource(src));
    }

    /**
     * Unregisters a source by ID.
     *
     * @param {string} sourceId
     * @returns {boolean} True if removed, false if not found
     */
    unregisterSource(sourceId) {
        return this._sources.delete(sourceId);
    }

    /**
     * Retrieves a source definition by ID.
     *
     * @param {string} sourceId
     * @returns {Object|null}
     */
    getSource(sourceId) {
        const found = this._sources.get(sourceId);
        return found ? { ...found } : null;
    }

    /**
     * Checks if a source ID is registered.
     *
     * @param {string} sourceId
     * @returns {boolean}
     */
    hasSource(sourceId) {
        return this._sources.has(sourceId);
    }

    /**
     * Returns all registered sources.
     *
     * @returns {Array<Object>}
     */
    getAllSources() {
        return Array.from(this._sources.values()).map((s) => ({ ...s }));
    }

    /**
     * Returns only currently enabled sources.
     *
     * @returns {Array<Object>}
     */
    getEnabledSources() {
        return this.getAllSources().filter((s) => s.isEnabled);
    }

    /**
     * Queries sources by jurisdiction level ('central', 'state', 'municipal').
     *
     * @param {string} jurisdictionLevel
     * @returns {Array<Object>}
     */
    getSourcesByJurisdiction(jurisdictionLevel) {
        return this.getAllSources().filter(
            (s) => s.jurisdictionLevel.toLowerCase() === jurisdictionLevel.toLowerCase()
        );
    }

    /**
     * Queries sources by state/UT code (case-insensitive).
     *
     * @param {string} stateCode
     * @param {boolean} [includePanIndia=true]
     * @returns {Array<Object>}
     */
    getSourcesByState(stateCode, includePanIndia = true) {
        const target = stateCode.trim().toUpperCase();
        return this.getAllSources().filter((s) => {
            if (s.stateCode === target) return true;
            if (includePanIndia && s.stateCode === "ALL") return true;
            return false;
        });
    }

    /**
     * Queries sources by connector type.
     *
     * @param {string} connectorType
     * @returns {Array<Object>}
     */
    getSourcesByConnector(connectorType) {
        return this.getAllSources().filter((s) => s.connectorType === connectorType);
    }

    /**
     * Records a synchronization attempt starting for a source.
     *
     * @param {string} sourceId
     * @returns {Object} Updated source
     */
    recordSyncAttempt(sourceId) {
        const source = this._sources.get(sourceId);
        if (!source) {
            throw new Error(`Cannot record sync attempt: source '${sourceId}' not found`);
        }
        source.lastAttemptedSync = new Date().toISOString();
        source.syncStatus = SYNC_STATUSES.IN_PROGRESS;
        return { ...source };
    }

    /**
     * Records a successful synchronization for a source.
     * Transitions coverage status to 'synchronized'.
     *
     * @param {string} sourceId
     * @returns {Object} Updated source
     */
    recordSyncSuccess(sourceId) {
        const source = this._sources.get(sourceId);
        if (!source) {
            throw new Error(`Cannot record sync success: source '${sourceId}' not found`);
        }
        const now = new Date().toISOString();
        source.lastSuccessfulSync = now;
        source.lastAttemptedSync = source.lastAttemptedSync || now;
        source.syncStatus = SYNC_STATUSES.SUCCESS;
        source.lastError = null;
        source.coverageStatus = SOURCE_LIFECYCLE_STAGES.SYNCHRONIZED;
        return { ...source };
    }

    /**
     * Records a synchronization failure for a source.
     * Transitions coverage status to 'blocked_or_unavailable' if persistent or severe.
     *
     * @param {string} sourceId
     * @param {string} errorMessage
     * @param {boolean} [markUnavailable=false]
     * @returns {Object} Updated source
     */
    recordSyncFailure(sourceId, errorMessage, markUnavailable = false) {
        const source = this._sources.get(sourceId);
        if (!source) {
            throw new Error(`Cannot record sync failure: source '${sourceId}' not found`);
        }
        source.syncStatus = SYNC_STATUSES.FAILED;
        source.lastError = typeof errorMessage === "string" ? errorMessage : String(errorMessage);
        if (markUnavailable) {
            source.coverageStatus = SOURCE_LIFECYCLE_STAGES.BLOCKED_OR_UNAVAILABLE;
        }
        return { ...source };
    }

    /**
     * Updates the coverage lifecycle status of a source.
     *
     * @param {string} sourceId
     * @param {string} newStatus
     * @returns {Object} Updated source
     */
    updateCoverageStatus(sourceId, newStatus) {
        const source = this._sources.get(sourceId);
        if (!source) {
            throw new Error(`Cannot update coverage status: source '${sourceId}' not found`);
        }
        const validStages = Object.values(SOURCE_LIFECYCLE_STAGES);
        if (!validStages.includes(newStatus)) {
            throw new SourceValidationError(`Invalid coverage status: '${newStatus}'. Must be one of: ${validStages.join(", ")}`);
        }
        source.coverageStatus = newStatus;
        return { ...source };
    }

    /**
     * Toggles the enabled state of a source.
     *
     * @param {string} sourceId
     * @param {boolean} isEnabled
     * @returns {Object} Updated source
     */
    setSourceEnabled(sourceId, isEnabled) {
        const source = this._sources.get(sourceId);
        if (!source) {
            throw new Error(`Cannot toggle enabled status: source '${sourceId}' not found`);
        }
        source.isEnabled = Boolean(isEnabled);
        return { ...source };
    }

    /**
     * Generates a comprehensive source coverage inventory report across all tiers and lifecycle stages.
     *
     * @returns {Object} Coverage inventory breakdown
     */
    getCoverageInventory() {
        const allSources = this.getAllSources();

        const byJurisdiction = {
            [JURISDICTION_LEVELS.CENTRAL]: 0,
            [JURISDICTION_LEVELS.STATE]: 0,
            [JURISDICTION_LEVELS.MUNICIPAL]: 0,
        };

        const byStatus = {
            [SOURCE_LIFECYCLE_STAGES.DISCOVERED]: 0,
            [SOURCE_LIFECYCLE_STAGES.URL_VERIFIED]: 0,
            [SOURCE_LIFECYCLE_STAGES.CONNECTOR_IMPLEMENTED]: 0,
            [SOURCE_LIFECYCLE_STAGES.CONFIGURED]: 0,
            [SOURCE_LIFECYCLE_STAGES.SYNCHRONIZED]: 0,
            [SOURCE_LIFECYCLE_STAGES.BLOCKED_OR_UNAVAILABLE]: 0,
        };

        const byConnector = {};
        for (const type of Object.values(CONNECTOR_TYPES)) {
            byConnector[type] = 0;
        }

        const bySyncStatus = {
            [SYNC_STATUSES.IDLE]: 0,
            [SYNC_STATUSES.IN_PROGRESS]: 0,
            [SYNC_STATUSES.SUCCESS]: 0,
            [SYNC_STATUSES.FAILED]: 0,
        };

        const stateCoverage = {};
        let enabledCount = 0;
        let disabledCount = 0;

        for (const src of allSources) {
            // Jurisdiction
            if (byJurisdiction[src.jurisdictionLevel] !== undefined) {
                byJurisdiction[src.jurisdictionLevel]++;
            }

            // Coverage Status
            if (byStatus[src.coverageStatus] !== undefined) {
                byStatus[src.coverageStatus]++;
            }

            // Connector
            byConnector[src.connectorType] = (byConnector[src.connectorType] || 0) + 1;

            // Sync Status
            if (bySyncStatus[src.syncStatus] !== undefined) {
                bySyncStatus[src.syncStatus]++;
            }

            // State Breakdown
            stateCoverage[src.stateCode] = (stateCoverage[src.stateCode] || 0) + 1;

            // Enabled/Disabled
            if (src.isEnabled) {
                enabledCount++;
            } else {
                disabledCount++;
            }
        }

        return {
            totalSources: allSources.length,
            enabledCount,
            disabledCount,
            byJurisdiction,
            byStatus,
            byConnector,
            bySyncStatus,
            stateCoverage,
            generatedAt: new Date().toISOString(),
        };
    }

    /**
     * Clears all registered sources.
     */
    clear() {
        this._sources.clear();
    }
}

/**
 * Verified Baseline Government Sources.
 * Includes the 20 active regional bureaus of the Press Information Bureau (PIB)
 * plus authentic discovered/URL-verified state gazette and municipal portals.
 *
 * All URLs are authentic government endpoints. Non-PIB sources are tracked
 * accurately in their current lifecycle stage ('url_verified').
 */
export const VERIFIED_BASELINE_GOVERNMENT_SOURCES = Object.freeze([
    // ─── CENTRAL & REGIONAL PRESS INFORMATION BUREAU (PIB) FEEDS ────────────
    {
        id: "pib_central_all_india",
        name: "PIB New Delhi (Central All-India)",
        jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
        stateCode: "ALL",
        department: "Press Information Bureau, Ministry of Information and Broadcasting",
        connectorType: CONNECTOR_TYPES.PIB_RSS,
        officialSourceUrl: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=48&lang=1",
        officialDomain: "pib.gov.in",
        isEnabled: true,
        pollingIntervalHours: 6,
        coverageStatus: SOURCE_LIFECYCLE_STAGES.CONFIGURED,
        description: "National all-India official government press releases and welfare announcements.",
    },
    {
        id: "pib_mh_mumbai",
        name: "PIB Mumbai (Maharashtra & Goa)",
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        stateCode: "MH",
        department: "Press Information Bureau, Regional Bureau Mumbai",
        connectorType: CONNECTOR_TYPES.PIB_RSS,
        officialSourceUrl: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=3&lang=1",
        officialDomain: "pib.gov.in",
        isEnabled: true,
        pollingIntervalHours: 6,
        coverageStatus: SOURCE_LIFECYCLE_STAGES.CONFIGURED,
        description: "Official releases and policy notifications for Maharashtra and Goa.",
    },
    {
        id: "pib_up_lucknow",
        name: "PIB Lucknow (Uttar Pradesh)",
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        stateCode: "UP",
        department: "Press Information Bureau, Regional Bureau Lucknow",
        connectorType: CONNECTOR_TYPES.PIB_RSS,
        officialSourceUrl: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=30&lang=1",
        officialDomain: "pib.gov.in",
        isEnabled: true,
        pollingIntervalHours: 6,
        coverageStatus: SOURCE_LIFECYCLE_STAGES.CONFIGURED,
        description: "Official releases and policy notifications for Uttar Pradesh.",
    },
    {
        id: "pib_ka_bengaluru",
        name: "PIB Bengaluru (Karnataka)",
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        stateCode: "KA",
        department: "Press Information Bureau, Regional Bureau Bengaluru",
        connectorType: CONNECTOR_TYPES.PIB_RSS,
        officialSourceUrl: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=14&lang=1",
        officialDomain: "pib.gov.in",
        isEnabled: true,
        pollingIntervalHours: 6,
        coverageStatus: SOURCE_LIFECYCLE_STAGES.CONFIGURED,
        description: "Official releases and policy notifications for Karnataka.",
    },
    {
        id: "pib_tn_chennai",
        name: "PIB Chennai (Tamil Nadu & Puducherry)",
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        stateCode: "TN",
        department: "Press Information Bureau, Regional Bureau Chennai",
        connectorType: CONNECTOR_TYPES.PIB_RSS,
        officialSourceUrl: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=22&lang=1",
        officialDomain: "pib.gov.in",
        isEnabled: true,
        pollingIntervalHours: 6,
        coverageStatus: SOURCE_LIFECYCLE_STAGES.CONFIGURED,
        description: "Official releases and policy notifications for Tamil Nadu and Puducherry.",
    },
    {
        id: "pib_wb_kolkata",
        name: "PIB Kolkata (West Bengal & A&N)",
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        stateCode: "WB",
        department: "Press Information Bureau, Regional Bureau Kolkata",
        connectorType: CONNECTOR_TYPES.PIB_RSS,
        officialSourceUrl: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=10&lang=1",
        officialDomain: "pib.gov.in",
        isEnabled: true,
        pollingIntervalHours: 6,
        coverageStatus: SOURCE_LIFECYCLE_STAGES.CONFIGURED,
        description: "Official releases and policy notifications for West Bengal and Andaman & Nicobar.",
    },
    {
        id: "pib_tg_hyderabad",
        name: "PIB Hyderabad (Telangana & Andhra Pradesh)",
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        stateCode: "TG",
        department: "Press Information Bureau, Regional Bureau Hyderabad",
        connectorType: CONNECTOR_TYPES.PIB_RSS,
        officialSourceUrl: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=11&lang=1",
        officialDomain: "pib.gov.in",
        isEnabled: true,
        pollingIntervalHours: 6,
        coverageStatus: SOURCE_LIFECYCLE_STAGES.CONFIGURED,
        description: "Official releases and policy notifications for Telangana and Andhra Pradesh.",
    },
    {
        id: "pib_gj_ahmedabad",
        name: "PIB Ahmedabad (Gujarat)",
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        stateCode: "GJ",
        department: "Press Information Bureau, Regional Bureau Ahmedabad",
        connectorType: CONNECTOR_TYPES.PIB_RSS,
        officialSourceUrl: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=2&lang=1",
        officialDomain: "pib.gov.in",
        isEnabled: true,
        pollingIntervalHours: 6,
        coverageStatus: SOURCE_LIFECYCLE_STAGES.CONFIGURED,
        description: "Official releases and policy notifications for Gujarat.",
    },
    {
        id: "pib_br_patna",
        name: "PIB Patna (Bihar)",
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        stateCode: "BR",
        department: "Press Information Bureau, Regional Bureau Patna",
        connectorType: CONNECTOR_TYPES.PIB_RSS,
        officialSourceUrl: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=26&lang=1",
        officialDomain: "pib.gov.in",
        isEnabled: true,
        pollingIntervalHours: 6,
        coverageStatus: SOURCE_LIFECYCLE_STAGES.CONFIGURED,
        description: "Official releases and policy notifications for Bihar.",
    },
    {
        id: "pib_kl_thiruvananthapuram",
        name: "PIB Thiruvananthapuram (Kerala & Lakshadweep)",
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        stateCode: "KL",
        department: "Press Information Bureau, Regional Bureau Thiruvananthapuram",
        connectorType: CONNECTOR_TYPES.PIB_RSS,
        officialSourceUrl: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=24&lang=1",
        officialDomain: "pib.gov.in",
        isEnabled: true,
        pollingIntervalHours: 6,
        coverageStatus: SOURCE_LIFECYCLE_STAGES.CONFIGURED,
        description: "Official releases and policy notifications for Kerala and Lakshadweep.",
    },
    {
        id: "pib_rj_jaipur",
        name: "PIB Jaipur (Rajasthan)",
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        stateCode: "RJ",
        department: "Press Information Bureau, Regional Bureau Jaipur",
        connectorType: CONNECTOR_TYPES.PIB_RSS,
        officialSourceUrl: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=15&lang=1",
        officialDomain: "pib.gov.in",
        isEnabled: true,
        pollingIntervalHours: 6,
        coverageStatus: SOURCE_LIFECYCLE_STAGES.CONFIGURED,
        description: "Official releases and policy notifications for Rajasthan.",
    },
    {
        id: "pib_pb_chandigarh",
        name: "PIB Chandigarh (Punjab, Haryana, HP, Chandigarh)",
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        stateCode: "PB",
        department: "Press Information Bureau, Regional Bureau Chandigarh",
        connectorType: CONNECTOR_TYPES.PIB_RSS,
        officialSourceUrl: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=6&lang=1",
        officialDomain: "pib.gov.in",
        isEnabled: true,
        pollingIntervalHours: 6,
        coverageStatus: SOURCE_LIFECYCLE_STAGES.CONFIGURED,
        description: "Official releases and policy notifications for Punjab, Haryana, Himachal Pradesh, and Chandigarh.",
    },
    {
        id: "pib_as_guwahati",
        name: "PIB Guwahati (Assam & North East Region)",
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        stateCode: "AS",
        department: "Press Information Bureau, Regional Bureau Guwahati",
        connectorType: CONNECTOR_TYPES.PIB_RSS,
        officialSourceUrl: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=8&lang=1",
        officialDomain: "pib.gov.in",
        isEnabled: true,
        pollingIntervalHours: 6,
        coverageStatus: SOURCE_LIFECYCLE_STAGES.CONFIGURED,
        description: "Official releases and policy notifications for Assam and the North Eastern States.",
    },
    {
        id: "pib_mp_bhopal",
        name: "PIB Bhopal (Madhya Pradesh)",
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        stateCode: "MP",
        department: "Press Information Bureau, Regional Bureau Bhopal",
        connectorType: CONNECTOR_TYPES.PIB_RSS,
        officialSourceUrl: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=16&lang=1",
        officialDomain: "pib.gov.in",
        isEnabled: true,
        pollingIntervalHours: 6,
        coverageStatus: SOURCE_LIFECYCLE_STAGES.CONFIGURED,
        description: "Official releases and policy notifications for Madhya Pradesh.",
    },
    {
        id: "pib_od_bhubaneswar",
        name: "PIB Bhubaneswar (Odisha)",
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        stateCode: "OD",
        department: "Press Information Bureau, Regional Bureau Bhubaneswar",
        connectorType: CONNECTOR_TYPES.PIB_RSS,
        officialSourceUrl: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=17&lang=1",
        officialDomain: "pib.gov.in",
        isEnabled: true,
        pollingIntervalHours: 6,
        coverageStatus: SOURCE_LIFECYCLE_STAGES.CONFIGURED,
        description: "Official releases and policy notifications for Odisha.",
    },
    {
        id: "pib_uk_dehradun",
        name: "PIB Dehradun (Uttarakhand)",
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        stateCode: "UK",
        department: "Press Information Bureau, Regional Bureau Dehradun",
        connectorType: CONNECTOR_TYPES.PIB_RSS,
        officialSourceUrl: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=7&lang=1",
        officialDomain: "pib.gov.in",
        isEnabled: true,
        pollingIntervalHours: 6,
        coverageStatus: SOURCE_LIFECYCLE_STAGES.CONFIGURED,
        description: "Official releases and policy notifications for Uttarakhand.",
    },
    {
        id: "pib_jh_ranchi",
        name: "PIB Ranchi (Jharkhand)",
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        stateCode: "JH",
        department: "Press Information Bureau, Regional Bureau Ranchi",
        connectorType: CONNECTOR_TYPES.PIB_RSS,
        officialSourceUrl: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=27&lang=1",
        officialDomain: "pib.gov.in",
        isEnabled: true,
        pollingIntervalHours: 6,
        coverageStatus: SOURCE_LIFECYCLE_STAGES.CONFIGURED,
        description: "Official releases and policy notifications for Jharkhand.",
    },
    {
        id: "pib_cg_raipur",
        name: "PIB Raipur (Chhattisgarh)",
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        stateCode: "CG",
        department: "Press Information Bureau, Regional Bureau Raipur",
        connectorType: CONNECTOR_TYPES.PIB_RSS,
        officialSourceUrl: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=29&lang=1",
        officialDomain: "pib.gov.in",
        isEnabled: true,
        pollingIntervalHours: 6,
        coverageStatus: SOURCE_LIFECYCLE_STAGES.CONFIGURED,
        description: "Official releases and policy notifications for Chhattisgarh.",
    },
    {
        id: "pib_jk_jammu",
        name: "PIB Jammu (J&K and Ladakh)",
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        stateCode: "JK",
        department: "Press Information Bureau, Regional Bureau Jammu",
        connectorType: CONNECTOR_TYPES.PIB_RSS,
        officialSourceUrl: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=4&lang=1",
        officialDomain: "pib.gov.in",
        isEnabled: true,
        pollingIntervalHours: 6,
        coverageStatus: SOURCE_LIFECYCLE_STAGES.CONFIGURED,
        description: "Official releases and policy notifications for Jammu & Kashmir and Ladakh.",
    },
    {
        id: "pib_ga_panaji",
        name: "PIB Panaji (Goa)",
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        stateCode: "GA",
        department: "Press Information Bureau, Regional Bureau Panaji",
        connectorType: CONNECTOR_TYPES.PIB_RSS,
        officialSourceUrl: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=1&lang=1",
        officialDomain: "pib.gov.in",
        isEnabled: true,
        pollingIntervalHours: 6,
        coverageStatus: SOURCE_LIFECYCLE_STAGES.CONFIGURED,
        description: "Official releases and policy notifications for Goa.",
    },

    // ─── AUTHENTIC DISCOVERED STATE GAZETTE & MUNICIPAL SOURCES ─────────────
    {
        id: "maha_egazette_portal",
        name: "Maharashtra Government e-Gazette",
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        stateCode: "MH",
        department: "Directorate of Government Printing and Stationery, Maharashtra",
        connectorType: CONNECTOR_TYPES.PORTAL_SCRAPER,
        officialSourceUrl: "https://egazette.mahaonline.gov.in",
        officialDomain: "mahaonline.gov.in",
        isEnabled: false,
        pollingIntervalHours: 12,
        coverageStatus: SOURCE_LIFECYCLE_STAGES.URL_VERIFIED,
        description: "Official statutory gazette notifications and government resolutions of Maharashtra.",
    },
    {
        id: "karnataka_gazette_portal",
        name: "Karnataka State Gazette",
        jurisdictionLevel: JURISDICTION_LEVELS.STATE,
        stateCode: "KA",
        department: "Department of Printing, Stationery and Publications, Karnataka",
        connectorType: CONNECTOR_TYPES.PORTAL_SCRAPER,
        officialSourceUrl: "https://gazette.karnataka.gov.in",
        officialDomain: "karnataka.gov.in",
        isEnabled: false,
        pollingIntervalHours: 12,
        coverageStatus: SOURCE_LIFECYCLE_STAGES.URL_VERIFIED,
        description: "Official government gazette releases and statutory notifications for Karnataka.",
    },
    {
        id: "mcd_delhi_notices",
        name: "Municipal Corporation of Delhi (MCD) Public Circulars",
        jurisdictionLevel: JURISDICTION_LEVELS.MUNICIPAL,
        stateCode: "DL",
        municipality: "Municipal Corporation of Delhi",
        department: "Municipal Corporation of Delhi",
        connectorType: CONNECTOR_TYPES.PORTAL_SCRAPER,
        officialSourceUrl: "https://mcdonline.nic.in",
        officialDomain: "mcdonline.nic.in",
        isEnabled: false,
        pollingIntervalHours: 24,
        coverageStatus: SOURCE_LIFECYCLE_STAGES.URL_VERIFIED,
        description: "Official municipal notifications, property tax rules, and local regulations in Delhi.",
    },
    {
        id: "bmc_mumbai_citizen_portal",
        name: "Brihanmumbai Municipal Corporation (BMC) Public Circulars",
        jurisdictionLevel: JURISDICTION_LEVELS.MUNICIPAL,
        stateCode: "MH",
        municipality: "Brihanmumbai Municipal Corporation",
        department: "Urban Development Department, Maharashtra",
        connectorType: CONNECTOR_TYPES.PORTAL_SCRAPER,
        officialSourceUrl: "https://www.mcgm.gov.in",
        officialDomain: "mcgm.gov.in",
        isEnabled: false,
        pollingIntervalHours: 24,
        coverageStatus: SOURCE_LIFECYCLE_STAGES.URL_VERIFIED,
        description: "Municipal circulars, civic bylaws, and local civic announcements for Mumbai.",
    },
]);

/**
 * Initializes and returns a pre-configured GovernmentSourceRegistry with baseline official sources.
 *
 * @returns {GovernmentSourceRegistry}
 */
export function createDefaultSourceRegistry() {
    const registry = new GovernmentSourceRegistry();
    registry.registerSources(VERIFIED_BASELINE_GOVERNMENT_SOURCES);
    return registry;
}

/**
 * Singleton instance of the GovernmentSourceRegistry initialized with baseline sources.
 */
export const governmentSourceRegistry = createDefaultSourceRegistry();

