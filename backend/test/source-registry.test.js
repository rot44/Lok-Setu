import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
    CONNECTOR_TYPES,
    SOURCE_LIFECYCLE_STAGES,
    SYNC_STATUSES,
    SourceValidationError,
    validateSourceUrl,
    validateSourceDefinition,
    assertValidSourceDefinition,
    GovernmentSourceRegistry,
    VERIFIED_BASELINE_GOVERNMENT_SOURCES,
    governmentSourceRegistry,
} from "../src/services/sourceRegistry.service.js";
import { JURISDICTION_LEVELS } from "../src/constants.js";

describe("Government Source Registry Suite", () => {
    let registry;

    beforeEach(() => {
        registry = new GovernmentSourceRegistry();
    });

    describe("1. URL and Domain Validation", () => {
        it("accepts valid HTTPS URL matching domain exactly", () => {
            const res = validateSourceUrl("https://pib.gov.in/RssMain.aspx?ModId=6", "pib.gov.in");
            assert.equal(res.isValid, true);
        });

        it("accepts valid subdomain of official domain", () => {
            const res = validateSourceUrl("https://egazette.mahaonline.gov.in/index.aspx", "mahaonline.gov.in");
            assert.equal(res.isValid, true);
        });

        it("rejects non-HTTP/HTTPS schemes", () => {
            const res = validateSourceUrl("ftp://pib.gov.in/feed.xml", "pib.gov.in");
            assert.equal(res.isValid, false);
            assert.ok(res.error.includes("must use http or https"));
        });

        it("rejects domain mismatches", () => {
            const res = validateSourceUrl("https://phishing-site.com/feed", "pib.gov.in");
            assert.equal(res.isValid, false);
            assert.ok(res.error.includes("does not match official domain"));
        });

        it("rejects malformed URLs", () => {
            const res = validateSourceUrl("not-a-url", "pib.gov.in");
            assert.equal(res.isValid, false);
            assert.ok(res.error.includes("Invalid URL format"));
        });

        it("rejects empty URLs", () => {
            const res = validateSourceUrl("", "pib.gov.in");
            assert.equal(res.isValid, false);
            assert.ok(res.error.includes("required"));
        });
    });

    describe("2. Structural and Field Validation", () => {
        const validSource = {
            id: "test_source_central",
            name: "Test Central Welfare Source",
            jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
            stateCode: "ALL",
            department: "Ministry of Social Justice and Empowerment",
            connectorType: CONNECTOR_TYPES.PIB_RSS,
            officialSourceUrl: "https://pib.gov.in/RssMain.aspx?ModId=6&reg=48",
            officialDomain: "pib.gov.in",
            isEnabled: true,
            pollingIntervalHours: 6,
        };

        it("validates a fully compliant central source", () => {
            const res = validateSourceDefinition(validSource);
            assert.equal(res.isValid, true);
            assert.equal(res.errors.length, 0);
        });

        it("rejects when required fields are missing", () => {
            const emptyRes = validateSourceDefinition({});
            assert.equal(emptyRes.isValid, false);
            assert.ok(emptyRes.errors.some((e) => e.includes("'id'")));
            assert.ok(emptyRes.errors.some((e) => e.includes("'name'")));
            assert.ok(emptyRes.errors.some((e) => e.includes("'jurisdictionLevel'")));
            assert.ok(emptyRes.errors.some((e) => e.includes("'department'")));
            assert.ok(emptyRes.errors.some((e) => e.includes("'connectorType'")));
            assert.ok(emptyRes.errors.some((e) => e.includes("'officialDomain'")));
            assert.ok(emptyRes.errors.some((e) => e.includes("'officialSourceUrl'")));
            assert.ok(emptyRes.errors.some((e) => e.includes("'pollingIntervalHours'")));
        });

        it("rejects invalid source IDs with illegal characters", () => {
            const res = validateSourceDefinition({
                ...validSource,
                id: "invalid ID with spaces!!",
            });
            assert.equal(res.isValid, false);
            assert.ok(res.errors.some((e) => e.includes("invalid characters")));
        });

        it("rejects invalid jurisdiction levels", () => {
            const res = validateSourceDefinition({
                ...validSource,
                jurisdictionLevel: "galactic_empire",
            });
            assert.equal(res.isValid, false);
            assert.ok(res.errors.some((e) => e.includes("Invalid jurisdictionLevel")));
        });

        it("rejects unsupported connector types", () => {
            const res = validateSourceDefinition({
                ...validSource,
                connectorType: "unsupported_ai_stream",
            });
            assert.equal(res.isValid, false);
            assert.ok(res.errors.some((e) => e.includes("Unsupported connectorType")));
        });

        it("rejects invalid polling intervals", () => {
            for (const badInterval of [0, -5, 1000, 3.5, "not_a_number"]) {
                const res = validateSourceDefinition({
                    ...validSource,
                    pollingIntervalHours: badInterval,
                });
                assert.equal(res.isValid, false);
                assert.ok(res.errors.some((e) => e.includes("Invalid pollingIntervalHours")));
            }
        });

        it("detects duplicate source IDs against existing registration set", () => {
            const existing = new Set(["test_source_central", "existing_one"]);
            const res = validateSourceDefinition(validSource, existing);
            assert.equal(res.isValid, false);
            assert.ok(res.errors.some((e) => e.includes("Duplicate source ID")));
        });
    });

    describe("3. Jurisdiction Metadata Consistency", () => {
        it("rejects central jurisdiction with specific state assignment other than ALL", () => {
            const res = validateSourceDefinition({
                id: "bad_central",
                name: "Bad Central",
                jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
                stateCode: "MH",
                department: "Ministry of Rural Development",
                connectorType: CONNECTOR_TYPES.PIB_RSS,
                officialSourceUrl: "https://pib.gov.in/test",
                officialDomain: "pib.gov.in",
                pollingIntervalHours: 6,
            });
            assert.equal(res.isValid, false);
            assert.ok(res.errors.some((e) => e.includes("Central jurisdiction source must have stateCode 'ALL'")));
        });

        it("requires valid stateCode for state jurisdiction", () => {
            const missingStateRes = validateSourceDefinition({
                id: "bad_state",
                name: "Bad State",
                jurisdictionLevel: JURISDICTION_LEVELS.STATE,
                department: "Department of Social Justice",
                connectorType: CONNECTOR_TYPES.PORTAL_SCRAPER,
                officialSourceUrl: "https://karnataka.gov.in/dept",
                officialDomain: "karnataka.gov.in",
                pollingIntervalHours: 12,
            });
            assert.equal(missingStateRes.isValid, false);
            assert.ok(missingStateRes.errors.some((e) => e.includes("requires a valid 2-letter 'stateCode'")));

            const invalidStateRes = validateSourceDefinition({
                id: "bad_state_code",
                name: "Bad State Code",
                jurisdictionLevel: JURISDICTION_LEVELS.STATE,
                stateCode: "XYZ_INVALID",
                department: "Department of Social Justice",
                connectorType: CONNECTOR_TYPES.PORTAL_SCRAPER,
                officialSourceUrl: "https://karnataka.gov.in/dept",
                officialDomain: "karnataka.gov.in",
                pollingIntervalHours: 12,
            });
            assert.equal(invalidStateRes.isValid, false);
            assert.ok(invalidStateRes.errors.some((e) => e.includes("Must be a valid Indian state/UT code")));
        });

        it("validates compliant state-level source", () => {
            const res = validateSourceDefinition({
                id: "maha_social_welfare",
                name: "Maharashtra Social Welfare Department",
                jurisdictionLevel: JURISDICTION_LEVELS.STATE,
                stateCode: "MH",
                department: "Social Justice and Special Assistance Department, Maharashtra",
                connectorType: CONNECTOR_TYPES.PORTAL_SCRAPER,
                officialSourceUrl: "https://sjsa.maharashtra.gov.in",
                officialDomain: "maharashtra.gov.in",
                pollingIntervalHours: 12,
            });
            assert.equal(res.isValid, true);
        });

        it("requires municipality and valid parent stateCode for municipal jurisdiction", () => {
            const missingMunicipalityRes = validateSourceDefinition({
                id: "bad_muni",
                name: "Bad Municipal",
                jurisdictionLevel: JURISDICTION_LEVELS.MUNICIPAL,
                stateCode: "MH",
                department: "Urban Development",
                connectorType: CONNECTOR_TYPES.PORTAL_SCRAPER,
                officialSourceUrl: "https://mcgm.gov.in",
                officialDomain: "mcgm.gov.in",
                pollingIntervalHours: 24,
            });
            assert.equal(missingMunicipalityRes.isValid, false);
            assert.ok(missingMunicipalityRes.errors.some((e) => e.includes("requires a non-empty 'municipality'")));

            const missingStateRes = validateSourceDefinition({
                id: "bad_muni_state",
                name: "Bad Municipal State",
                jurisdictionLevel: JURISDICTION_LEVELS.MUNICIPAL,
                municipality: "Brihanmumbai Municipal Corporation",
                department: "Urban Development",
                connectorType: CONNECTOR_TYPES.PORTAL_SCRAPER,
                officialSourceUrl: "https://mcgm.gov.in",
                officialDomain: "mcgm.gov.in",
                pollingIntervalHours: 24,
            });
            assert.equal(missingStateRes.isValid, false);
            assert.ok(missingStateRes.errors.some((e) => e.includes("requires a valid parent 'stateCode'")));
        });

        it("validates compliant municipal-level source", () => {
            const res = validateSourceDefinition({
                id: "mcd_delhi_notices",
                name: "Municipal Corporation of Delhi Notices",
                jurisdictionLevel: JURISDICTION_LEVELS.MUNICIPAL,
                stateCode: "DL",
                municipality: "Municipal Corporation of Delhi",
                department: "Municipal Corporation of Delhi",
                connectorType: CONNECTOR_TYPES.PORTAL_SCRAPER,
                officialSourceUrl: "https://mcdonline.nic.in",
                officialDomain: "mcdonline.nic.in",
                pollingIntervalHours: 24,
            });
            assert.equal(res.isValid, true);
        });
    });

    describe("4. Registry CRUD & Querying Operations", () => {
        const source1 = {
            id: "src_delhi_central",
            name: "PIB Delhi Central",
            jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
            stateCode: "ALL",
            department: "PIB",
            connectorType: CONNECTOR_TYPES.PIB_RSS,
            officialSourceUrl: "https://pib.gov.in/feed1",
            officialDomain: "pib.gov.in",
            pollingIntervalHours: 6,
            isEnabled: true,
        };

        const source2 = {
            id: "src_mh_mumbai",
            name: "PIB Mumbai",
            jurisdictionLevel: JURISDICTION_LEVELS.STATE,
            stateCode: "MH",
            department: "PIB Regional",
            connectorType: CONNECTOR_TYPES.PIB_RSS,
            officialSourceUrl: "https://pib.gov.in/feed2",
            officialDomain: "pib.gov.in",
            pollingIntervalHours: 6,
            isEnabled: true,
        };

        const source3 = {
            id: "src_bmc_mumbai",
            name: "BMC Mumbai",
            jurisdictionLevel: JURISDICTION_LEVELS.MUNICIPAL,
            stateCode: "MH",
            municipality: "Brihanmumbai Municipal Corporation",
            department: "BMC Urban",
            connectorType: CONNECTOR_TYPES.PORTAL_SCRAPER,
            officialSourceUrl: "https://mcgm.gov.in",
            officialDomain: "mcgm.gov.in",
            pollingIntervalHours: 24,
            isEnabled: false,
        };

        it("registers and retrieves sources properly", () => {
            const reg1 = registry.registerSource(source1);
            assert.equal(reg1.id, "src_delhi_central");
            assert.equal(registry.hasSource("src_delhi_central"), true);
            assert.equal(registry.getSource("src_delhi_central").name, "PIB Delhi Central");

            registry.registerSource(source2);
            assert.equal(registry.getAllSources().length, 2);
        });

        it("throws SourceValidationError when registering duplicate source ID", () => {
            registry.registerSource(source1);
            assert.throws(
                () => registry.registerSource(source1),
                SourceValidationError
            );
        });

        it("unregisters sources", () => {
            registry.registerSource(source1);
            assert.equal(registry.hasSource("src_delhi_central"), true);
            const removed = registry.unregisterSource("src_delhi_central");
            assert.equal(removed, true);
            assert.equal(registry.hasSource("src_delhi_central"), false);
        });

        it("filters sources by enabled state", () => {
            registry.registerSource(source1);
            registry.registerSource(source2);
            registry.registerSource(source3);

            const enabled = registry.getEnabledSources();
            assert.equal(enabled.length, 2);
            assert.ok(!enabled.some((s) => s.id === "src_bmc_mumbai"));
        });

        it("filters sources by jurisdiction level", () => {
            registry.registerSource(source1);
            registry.registerSource(source2);
            registry.registerSource(source3);

            assert.equal(registry.getSourcesByJurisdiction("central").length, 1);
            assert.equal(registry.getSourcesByJurisdiction("state").length, 1);
            assert.equal(registry.getSourcesByJurisdiction("municipal").length, 1);
        });

        it("filters sources by state with national fallback", () => {
            registry.registerSource(source1); // Central ALL
            registry.registerSource(source2); // MH State
            registry.registerSource(source3); // MH Municipal

            // Searching MH with includePanIndia=true should return MH sources + Central ALL
            const mhWithAll = registry.getSourcesByState("MH", true);
            assert.equal(mhWithAll.length, 3);

            // Searching MH without national fallback should return only MH state & municipal
            const mhOnly = registry.getSourcesByState("MH", false);
            assert.equal(mhOnly.length, 2);
            assert.ok(!mhOnly.some((s) => s.id === "src_delhi_central"));
        });

        it("filters sources by connector type", () => {
            registry.registerSource(source1);
            registry.registerSource(source2);
            registry.registerSource(source3);

            assert.equal(registry.getSourcesByConnector(CONNECTOR_TYPES.PIB_RSS).length, 2);
            assert.equal(registry.getSourcesByConnector(CONNECTOR_TYPES.PORTAL_SCRAPER).length, 1);
        });
    });

    describe("5. Lifecycle and Sync Status Progression", () => {
        beforeEach(() => {
            registry.registerSource({
                id: "lifecycle_src",
                name: "Lifecycle Progression Source",
                jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
                stateCode: "ALL",
                department: "Ministry of Information",
                connectorType: CONNECTOR_TYPES.PIB_RSS,
                officialSourceUrl: "https://pib.gov.in/feed",
                officialDomain: "pib.gov.in",
                pollingIntervalHours: 6,
                coverageStatus: SOURCE_LIFECYCLE_STAGES.CONFIGURED,
            });
        });

        it("records sync attempt with timestamp and in_progress status", () => {
            const updated = registry.recordSyncAttempt("lifecycle_src");
            assert.equal(updated.syncStatus, SYNC_STATUSES.IN_PROGRESS);
            assert.ok(updated.lastAttemptedSync);
        });

        it("records sync success, clearing errors and progressing to synchronized", () => {
            registry.recordSyncAttempt("lifecycle_src");
            const updated = registry.recordSyncSuccess("lifecycle_src");

            assert.equal(updated.syncStatus, SYNC_STATUSES.SUCCESS);
            assert.equal(updated.lastError, null);
            assert.ok(updated.lastSuccessfulSync);
            assert.equal(updated.coverageStatus, SOURCE_LIFECYCLE_STAGES.SYNCHRONIZED);
        });

        it("records sync failure and optionally marks unavailable", () => {
            const failed = registry.recordSyncFailure("lifecycle_src", "HTTP 403 Forbidden");
            assert.equal(failed.syncStatus, SYNC_STATUSES.FAILED);
            assert.equal(failed.lastError, "HTTP 403 Forbidden");

            const persistentFailure = registry.recordSyncFailure("lifecycle_src", "DNS Resolution Failed", true);
            assert.equal(persistentFailure.coverageStatus, SOURCE_LIFECYCLE_STAGES.BLOCKED_OR_UNAVAILABLE);
        });

        it("updates coverage lifecycle status explicitly", () => {
            const updated = registry.updateCoverageStatus("lifecycle_src", SOURCE_LIFECYCLE_STAGES.CONNECTOR_IMPLEMENTED);
            assert.equal(updated.coverageStatus, SOURCE_LIFECYCLE_STAGES.CONNECTOR_IMPLEMENTED);

            assert.throws(
                () => registry.updateCoverageStatus("lifecycle_src", "invalid_stage"),
                SourceValidationError
            );
        });
    });

    describe("6. Coverage Inventory & Metrics Reporting", () => {
        it("calculates accurate inventory counts across all tiers and lifecycle stages", () => {
            registry.registerSource({
                id: "src_c1",
                name: "Central 1",
                jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
                stateCode: "ALL",
                department: "Dept A",
                connectorType: CONNECTOR_TYPES.PIB_RSS,
                officialSourceUrl: "https://pib.gov.in/1",
                officialDomain: "pib.gov.in",
                pollingIntervalHours: 6,
                coverageStatus: SOURCE_LIFECYCLE_STAGES.SYNCHRONIZED,
                syncStatus: SYNC_STATUSES.SUCCESS,
                isEnabled: true,
            });

            registry.registerSource({
                id: "src_s1",
                name: "State 1",
                jurisdictionLevel: JURISDICTION_LEVELS.STATE,
                stateCode: "MH",
                department: "Dept B",
                connectorType: CONNECTOR_TYPES.PORTAL_SCRAPER,
                officialSourceUrl: "https://mahaonline.gov.in/2",
                officialDomain: "mahaonline.gov.in",
                pollingIntervalHours: 12,
                coverageStatus: SOURCE_LIFECYCLE_STAGES.URL_VERIFIED,
                syncStatus: SYNC_STATUSES.IDLE,
                isEnabled: false,
            });

            registry.registerSource({
                id: "src_m1",
                name: "Municipal 1",
                jurisdictionLevel: JURISDICTION_LEVELS.MUNICIPAL,
                stateCode: "MH",
                municipality: "BMC",
                department: "Dept C",
                connectorType: CONNECTOR_TYPES.PORTAL_SCRAPER,
                officialSourceUrl: "https://mcgm.gov.in/3",
                officialDomain: "mcgm.gov.in",
                pollingIntervalHours: 24,
                coverageStatus: SOURCE_LIFECYCLE_STAGES.BLOCKED_OR_UNAVAILABLE,
                syncStatus: SYNC_STATUSES.FAILED,
                isEnabled: true,
            });

            const inventory = registry.getCoverageInventory();

            assert.equal(inventory.totalSources, 3);
            assert.equal(inventory.enabledCount, 2);
            assert.equal(inventory.disabledCount, 1);

            // Jurisdiction breakdown
            assert.equal(inventory.byJurisdiction.central, 1);
            assert.equal(inventory.byJurisdiction.state, 1);
            assert.equal(inventory.byJurisdiction.municipal, 1);

            // Lifecycle breakdown
            assert.equal(inventory.byStatus.synchronized, 1);
            assert.equal(inventory.byStatus.url_verified, 1);
            assert.equal(inventory.byStatus.blocked_or_unavailable, 1);
            assert.equal(inventory.byStatus.discovered, 0);

            // Connector breakdown
            assert.equal(inventory.byConnector.pib_rss, 1);
            assert.equal(inventory.byConnector.portal_scraper, 2);

            // Sync Status breakdown
            assert.equal(inventory.bySyncStatus.success, 1);
            assert.equal(inventory.bySyncStatus.idle, 1);
            assert.equal(inventory.bySyncStatus.failed, 1);

            // State coverage
            assert.equal(inventory.stateCoverage.ALL, 1);
            assert.equal(inventory.stateCoverage.MH, 2);

            assert.ok(inventory.generatedAt);
        });
    });

    describe("7. Baseline Government Source Inventory Verification", () => {
        it("verifies the default singleton registry contains at least 24 verified sources", () => {
            const allSources = governmentSourceRegistry.getAllSources();
            assert.ok(allSources.length >= 24, `Expected at least 24 sources, found ${allSources.length}`);
        });

        it("verifies all 20 Regional PIB Bureaus are registered with authentic URLs and domains", () => {
            const pibSources = governmentSourceRegistry.getSourcesByConnector(CONNECTOR_TYPES.PIB_RSS);
            assert.equal(pibSources.length, 20);

            for (const pib of pibSources) {
                assert.equal(pib.officialDomain, "pib.gov.in");
                assert.ok(pib.officialSourceUrl.startsWith("https://www.pib.gov.in/RssMain.aspx?ModId=6"));
                assert.ok(pib.pollingIntervalHours >= 1);
                assert.equal(pib.coverageStatus, SOURCE_LIFECYCLE_STAGES.CONFIGURED);
            }

            // Central PIB
            const central = governmentSourceRegistry.getSource("pib_central_all_india");
            assert.ok(central);
            assert.equal(central.jurisdictionLevel, JURISDICTION_LEVELS.CENTRAL);
            assert.equal(central.stateCode, "ALL");

            // Key state PIB bureaus
            const keyStates = ["MH", "UP", "KA", "TN", "WB", "TG", "GJ", "BR", "KL", "RJ", "PB", "AS", "MP", "OD", "UK", "JH", "CG", "JK", "GA"];
            for (const st of keyStates) {
                const found = pibSources.find((s) => s.stateCode === st);
                assert.ok(found, `Missing PIB bureau for state ${st}`);
            }
        });

        it("verifies state and municipal sources have authentic government URLs and honest lifecycle status", () => {
            const stateSources = governmentSourceRegistry.getSourcesByJurisdiction(JURISDICTION_LEVELS.STATE);
            const muniSources = governmentSourceRegistry.getSourcesByJurisdiction(JURISDICTION_LEVELS.MUNICIPAL);

            assert.ok(stateSources.length >= 20);
            assert.ok(muniSources.length >= 2);

            // MCD Delhi municipal check
            const mcd = governmentSourceRegistry.getSource("mcd_delhi_notices");
            assert.ok(mcd);
            assert.equal(mcd.jurisdictionLevel, JURISDICTION_LEVELS.MUNICIPAL);
            assert.equal(mcd.stateCode, "DL");
            assert.equal(mcd.officialDomain, "mcdonline.nic.in");
            assert.equal(mcd.coverageStatus, SOURCE_LIFECYCLE_STAGES.URL_VERIFIED);

            // BMC Mumbai municipal check
            const bmc = governmentSourceRegistry.getSource("bmc_mumbai_citizen_portal");
            assert.ok(bmc);
            assert.equal(bmc.jurisdictionLevel, JURISDICTION_LEVELS.MUNICIPAL);
            assert.equal(bmc.stateCode, "MH");
            assert.equal(bmc.officialDomain, "mcgm.gov.in");
            assert.equal(bmc.coverageStatus, SOURCE_LIFECYCLE_STAGES.URL_VERIFIED);

            // Maharashtra e-Gazette check
            const maha = governmentSourceRegistry.getSource("maha_egazette_portal");
            assert.ok(maha);
            assert.equal(maha.jurisdictionLevel, JURISDICTION_LEVELS.STATE);
            assert.equal(maha.stateCode, "MH");
            assert.equal(maha.officialDomain, "mahaonline.gov.in");
            assert.equal(maha.coverageStatus, SOURCE_LIFECYCLE_STAGES.URL_VERIFIED);
        });
    });
});

