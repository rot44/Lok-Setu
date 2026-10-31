import { describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
    PIB_REGIONAL_BUREAUS,
    GOV_SCHEME_NORMALIZATION_SCHEMA,
    NATIONAL_BASELINE_SCHEMES,
    computeContentHash,
    isSourceEligibleForSync,
    getEligibleSourcesForSync,
    governmentSyncService,
} from "../src/services/governmentSync.service.js";
import {
    GovernmentSourceRegistry,
    governmentSourceRegistry,
    CONNECTOR_TYPES,
    SOURCE_LIFECYCLE_STAGES,
} from "../src/services/sourceRegistry.service.js";
import { Document } from "../src/models/document.model.js";
import { DocumentChunk } from "../src/models/documentChunk.model.js";
import { indexingService } from "../src/services/indexing.service.js";
import { retrieveEvidence } from "../src/services/retrieval.service.js";
import { JURISDICTION_LEVELS } from "../src/constants.js";

describe("Autonomous Government Scheme Synchronization Suite", () => {
    it("1. PIB regional bureau directory includes Central and key state bureaus", () => {
        assert.ok(PIB_REGIONAL_BUREAUS.length >= 20);

        const statesCovered = PIB_REGIONAL_BUREAUS.map((b) => b.state);
        assert.ok(statesCovered.includes("ALL"), "Missing central all-India bureau");
        assert.ok(statesCovered.includes("Maharashtra"), "Missing Maharashtra bureau");
        assert.ok(statesCovered.includes("Uttar Pradesh"), "Missing Uttar Pradesh bureau");
        assert.ok(statesCovered.includes("Karnataka"), "Missing Karnataka bureau");
        assert.ok(statesCovered.includes("Tamil Nadu"), "Missing Tamil Nadu bureau");
        assert.ok(statesCovered.includes("West Bengal"), "Missing West Bengal bureau");
        assert.ok(statesCovered.includes("Gujarat"), "Missing Gujarat bureau");
        assert.ok(statesCovered.includes("Bihar"), "Missing Bihar bureau");
        assert.ok(statesCovered.includes("Madhya Pradesh"), "Missing Madhya Pradesh bureau");
        assert.ok(statesCovered.includes("Rajasthan"), "Missing Rajasthan bureau");
        assert.ok(statesCovered.includes("Kerala"), "Missing Kerala bureau");

        // Verify valid RSS endpoints
        for (const bureau of PIB_REGIONAL_BUREAUS) {
            assert.ok(bureau.url.startsWith("https://www.pib.gov.in/RssMain.aspx?ModId=6"));
            assert.ok(bureau.code > 0);
        }
    });

    it("2. GOV_SCHEME_NORMALIZATION_SCHEMA enforces complete civic & demographic fields", () => {
        assert.equal(GOV_SCHEME_NORMALIZATION_SCHEMA.type, "OBJECT");
        const props = GOV_SCHEME_NORMALIZATION_SCHEMA.properties;

        assert.ok(props.isCivicPolicyOrWelfare);
        assert.ok(props.title);
        assert.ok(props.documentType);
        assert.ok(props.jurisdictionLevel);
        assert.ok(props.applicableState);
        assert.ok(props.issuingAuthority);
        assert.ok(props.summary);
        assert.ok(props.tags);
        assert.ok(props.eligibilityRules);

        const eligProps = props.eligibilityRules.properties;
        assert.ok(eligProps.minAge);
        assert.ok(eligProps.maxAge);
        assert.ok(eligProps.genders);
        assert.ok(eligProps.castes);
        assert.ok(eligProps.occupations);
        assert.ok(eligProps.maxAnnualIncome);
        assert.ok(eligProps.requiresRationCard);
        assert.ok(eligProps.requiresDisabilityStatus);
    });

    it("3. National baseline schemes cover targeted demographics and diverse Indian states", () => {
        assert.ok(NATIONAL_BASELINE_SCHEMES.length >= 12);

        // Check for Divyangjan (Specially Abled) schemes
        const divyangSchemes = NATIONAL_BASELINE_SCHEMES.filter(
            (s) => s.eligibilityRules?.requiresDisabilityStatus === true
        );
        assert.ok(divyangSchemes.length >= 2, "Must include Divyangjan schemes");

        // Check for Senior Citizens
        const seniorSchemes = NATIONAL_BASELINE_SCHEMES.filter(
            (s) => s.eligibilityRules?.minAge >= 60
        );
        assert.ok(seniorSchemes.length >= 1, "Must include Senior Citizen schemes");

        // Check for Women-exclusive schemes
        const womenSchemes = NATIONAL_BASELINE_SCHEMES.filter(
            (s) =>
                s.eligibilityRules?.genders?.length === 1 &&
                s.eligibilityRules.genders[0].toLowerCase() === "female"
        );
        assert.ok(womenSchemes.length >= 4, "Must include Women-specific schemes");

        // Check for Farmer-targeted schemes
        const farmerSchemes = NATIONAL_BASELINE_SCHEMES.filter(
            (s) => s.eligibilityRules?.occupations?.includes("farmer")
        );
        assert.ok(farmerSchemes.length >= 3, "Must include Farmer schemes");

        // Verify state diversity across India
        const statesRepresented = new Set(
            NATIONAL_BASELINE_SCHEMES.map((s) => s.applicableState)
        );
        assert.ok(statesRepresented.has("Madhya Pradesh"));
        assert.ok(statesRepresented.has("Rajasthan"));
        assert.ok(statesRepresented.has("West Bengal"));
        assert.ok(statesRepresented.has("Gujarat"));
        assert.ok(statesRepresented.has("Telangana"));
        assert.ok(statesRepresented.has("Andhra Pradesh"));
        assert.ok(statesRepresented.has("Kerala"));
        assert.ok(statesRepresented.has("Odisha"));
        assert.ok(statesRepresented.has("Haryana"));
        assert.ok(statesRepresented.has("Assam"));
    });

    it("4. computeContentHash produces deterministic SHA-256 strings", () => {
        const hash1 = computeContentHash("PM Kisan", "Annual financial support of 6000");
        const hash2 = computeContentHash("PM Kisan", "Annual financial support of 6000");
        const hash3 = computeContentHash("PM Kisan", "Different content");

        assert.equal(hash1, hash2);
        assert.notEqual(hash1, hash3);
        assert.equal(hash1.length, 64);
    });

    // ─── 5. SOURCE ELIGIBILITY & FILTERING ──────────────────────────────────────────────
    it("5. isSourceEligibleForSync cleanly filters supported vs unsupported/disabled sources", () => {
        // Supported & enabled PIB source
        const validSource = {
            id: "pib_test_central",
            name: "PIB Central Test",
            jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
            stateCode: "ALL",
            department: "Ministry of Information & Broadcasting",
            connectorType: CONNECTOR_TYPES.PIB_RSS,
            officialSourceUrl: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=48&lang=1",
            officialDomain: "pib.gov.in",
            isEnabled: true,
            pollingIntervalHours: 6,
            coverageStatus: SOURCE_LIFECYCLE_STAGES.CONFIGURED,
        };
        assert.equal(isSourceEligibleForSync(validSource), true);

        // Disabled source must be rejected
        assert.equal(isSourceEligibleForSync({ ...validSource, isEnabled: false }), false);

        // url_verified only (embryonic portal without active connector) must be rejected
        assert.equal(
            isSourceEligibleForSync({ ...validSource, coverageStatus: SOURCE_LIFECYCLE_STAGES.URL_VERIFIED }),
            false
        );

        // discovered only must be rejected
        assert.equal(
            isSourceEligibleForSync({ ...validSource, coverageStatus: SOURCE_LIFECYCLE_STAGES.DISCOVERED }),
            false
        );

        // blocked_or_unavailable must be rejected
        assert.equal(
            isSourceEligibleForSync({ ...validSource, coverageStatus: SOURCE_LIFECYCLE_STAGES.BLOCKED_OR_UNAVAILABLE }),
            false
        );

        // Unknown/unsupported connector type must be rejected
        assert.equal(
            isSourceEligibleForSync({ ...validSource, connectorType: "unsupported_crawler" }),
            false
        );

        // Missing officialSourceUrl must be rejected
        assert.equal(isSourceEligibleForSync({ ...validSource, officialSourceUrl: "" }), false);

        // Verify across default governmentSourceRegistry: exactly 20 sources are eligible, 38 are ineligible
        const allRegistrySources = governmentSourceRegistry.getAllSources();
        assert.equal(allRegistrySources.length, 58);

        const eligible = getEligibleSourcesForSync({ registry: governmentSourceRegistry });
        assert.equal(eligible.length, 20);
        for (const s of eligible) {
            assert.equal(s.isEnabled, true);
            assert.equal(s.connectorType, CONNECTOR_TYPES.PIB_RSS);
            assert.equal(s.coverageStatus, SOURCE_LIFECYCLE_STAGES.CONFIGURED);
        }

        // Filter by jurisdictionLevel
        const centralOnly = getEligibleSourcesForSync({
            registry: governmentSourceRegistry,
            jurisdictionLevel: "central",
        });
        assert.equal(centralOnly.length, 1);
        assert.equal(centralOnly[0].id, "pib_central_all_india");

        // Filter by stateCode: returns regional MH bureau + national Central bureau (which covers ALL)
        const mhAndCentral = getEligibleSourcesForSync({
            registry: governmentSourceRegistry,
            stateCode: "MH",
        });
        assert.equal(mhAndCentral.length, 2);
        const mhDirect = mhAndCentral.filter((s) => s.stateCode === "MH");
        assert.equal(mhDirect.length, 1);
        assert.equal(mhDirect[0].id, "pib_mh_mumbai");
    });

    // ─── 6. CONNECTOR-TO-WORKER INTEGRATION ─────────────────────────────────────────────
    it("6. syncSingleRegisteredSource executes connector, normalizes documents, and persists to DB", async () => {
        const mockRssXml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
  <channel>
    <title>PIB Central Policy Feed</title>
    <item>
      <title>Cabinet approves PM Surya Ghar Muft Bijli Yojana</title>
      <link>https://www.pib.gov.in/PressReleasePage.aspx?PRID=2008543</link>
      <description>Subsidies up to ₹78,000 for residential rooftop solar installation.</description>
      <pubDate>Mon, 15 Jan 2026 12:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

        const testSource = {
            id: "pib_solar_test",
            name: "PIB Solar Scheme Test",
            jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
            stateCode: "ALL",
            department: "Ministry of New and Renewable Energy",
            connectorType: CONNECTOR_TYPES.PIB_RSS,
            officialSourceUrl: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=48&lang=1",
            officialDomain: "pib.gov.in",
            isEnabled: true,
            pollingIntervalHours: 6,
            coverageStatus: SOURCE_LIFECYCLE_STAGES.CONFIGURED,
        };

        const registry = new GovernmentSourceRegistry();
        registry.registerSource(testSource);

        let createdDocData = null;
        let indexedDocId = null;

        const originalFindOne = Document.findOne;
        const originalCreate = Document.create;
        const originalIndexDocument = indexingService.indexDocument;

        try {
            Document.findOne = async () => null; // Simulate new document
            Document.create = async (docData) => {
                createdDocData = {
                    ...docData,
                    _id: new mongoose.Types.ObjectId(),
                    save: async function () { return this; },
                };
                return createdDocData;
            };
            indexingService.indexDocument = async (id) => {
                indexedDocId = String(id);
                return { success: true, chunkCount: 3 };
            };

            const mockFetcher = async () => ({
                ok: true,
                status: 200,
                statusText: "OK",
                headers: new Headers({ "content-type": "application/xml" }),
                text: async () => mockRssXml,
                arrayBuffer: async () => Buffer.from(mockRssXml, "utf-8"),
            });

            const result = await governmentSyncService.syncSingleRegisteredSource({
                sourceDef: testSource,
                registry,
                connectorOptions: {
                    fetchFn: mockFetcher,
                    dnsResolver: async () => [{ address: "164.100.1.1", family: 4 }],
                },
            });

            assert.equal(result.success, true);
            assert.equal(result.syncedCount, 1);
            assert.equal(result.skippedCount, 0);
            assert.equal(result.updatedCount, 0);
            assert.equal(result.indexedCount, 1);
            assert.equal(result.errors.length, 0);

            // Verify persisted document fields
            assert.ok(createdDocData);
            assert.equal(createdDocData.title, "Cabinet approves PM Surya Ghar Muft Bijli Yojana");
            assert.equal(createdDocData.jurisdictionLevel, "central");
            assert.equal(createdDocData.applicableState, "ALL");
            assert.equal(createdDocData.issuingAuthority, "Ministry of New and Renewable Energy");
            assert.equal(createdDocData.officialPortalUrl, "https://www.pib.gov.in/PressReleasePage.aspx?PRID=2008543");
            assert.equal(createdDocData.officialSourceUrl, "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=48&lang=1");
            assert.ok(createdDocData.contentHash);
            assert.equal(createdDocData.metadataProvenance.officialSource.sourceId, "pib_solar_test");

            // Verify indexing was called
            assert.equal(indexedDocId, String(createdDocData._id));

            // Verify registry was updated
            const regSource = registry.getSource("pib_solar_test");
            assert.equal(regSource.syncStatus, "success");
            assert.ok(regSource.lastSuccessfulSync);
            assert.equal(regSource.coverageStatus, SOURCE_LIFECYCLE_STAGES.SYNCHRONIZED);
        } finally {
            Document.findOne = originalFindOne;
            Document.create = originalCreate;
            indexingService.indexDocument = originalIndexDocument;
        }
    });

    // ─── 7. DUPLICATE HANDLING AND IDEMPOTENCY ──────────────────────────────────────────
    it("7. Duplicate handling avoids re-creating or re-indexing identical records on repeated syncs", async () => {
        const mockRssXml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
  <channel>
    <title>PIB Central Policy Feed</title>
    <item>
      <title>Cabinet approves PM Surya Ghar Muft Bijli Yojana</title>
      <link>https://www.pib.gov.in/PressReleasePage.aspx?PRID=2008543</link>
      <description>Subsidies up to ₹78,000 for residential rooftop solar installation.</description>
      <pubDate>Mon, 15 Jan 2026 12:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

        const testSource = {
            id: "pib_idempotency_test",
            name: "PIB Idempotency Test",
            jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
            stateCode: "ALL",
            department: "Ministry of New and Renewable Energy",
            connectorType: CONNECTOR_TYPES.PIB_RSS,
            officialSourceUrl: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=48&lang=1",
            officialDomain: "pib.gov.in",
            isEnabled: true,
            pollingIntervalHours: 6,
            coverageStatus: SOURCE_LIFECYCLE_STAGES.CONFIGURED,
        };

        const registry = new GovernmentSourceRegistry();
        registry.registerSource(testSource);

        const expectedHash = computeContentHash(
            "Cabinet approves PM Surya Ghar Muft Bijli Yojana",
            "Cabinet approves PM Surya Ghar Muft Bijli Yojana"
        );

        const mockExistingDoc = {
            _id: new mongoose.Types.ObjectId(),
            title: "Cabinet approves PM Surya Ghar Muft Bijli Yojana",
            rawExtractedText: "Cabinet approves PM Surya Ghar Muft Bijli Yojana",
            officialPortalUrl: "https://www.pib.gov.in/PressReleasePage.aspx?PRID=2008543",
            officialSourceUrl: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=48&lang=1",
            contentHash: expectedHash,
            save: async function () { return this; },
        };

        let createCallCount = 0;
        let indexCallCount = 0;

        const originalFindOne = Document.findOne;
        const originalCreate = Document.create;
        const originalIndexDocument = indexingService.indexDocument;

        try {
            Document.findOne = async () => mockExistingDoc; // Document already exists with identical hash
            Document.create = async () => {
                createCallCount++;
                return {};
            };
            indexingService.indexDocument = async () => {
                indexCallCount++;
                return { success: true };
            };

            const mockFetcher = async () => ({
                ok: true,
                status: 200,
                statusText: "OK",
                headers: new Headers({ "content-type": "application/xml" }),
                text: async () => mockRssXml,
                arrayBuffer: async () => Buffer.from(mockRssXml, "utf-8"),
            });

            const result = await governmentSyncService.syncSingleRegisteredSource({
                sourceDef: testSource,
                registry,
                connectorOptions: {
                    fetchFn: mockFetcher,
                    dnsResolver: async () => [{ address: "164.100.1.1", family: 4 }],
                },
            });

            assert.equal(result.success, true);
            assert.equal(result.syncedCount, 0); // No new documents created
            assert.equal(result.updatedCount, 0); // No updates
            assert.equal(result.skippedCount, 1); // Correctly identified as duplicate
            assert.equal(result.indexedCount, 0); // Did not trigger unnecessary re-indexing
            assert.equal(createCallCount, 0);
            assert.equal(indexCallCount, 0);
        } finally {
            Document.findOne = originalFindOne;
            Document.create = originalCreate;
            indexingService.indexDocument = originalIndexDocument;
        }
    });

    // ─── 8. CHANGED-DOCUMENT UPDATES & CHUNK CLEANUP ────────────────────────────────────
    it("8. Changed-document update detects amended content, updates record, and re-indexes cleanly", async () => {
        const mockRevisedRssXml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
  <channel>
    <title>PIB Central Policy Feed</title>
    <item>
      <title>Cabinet approves PM Surya Ghar Muft Bijli Yojana (Amended)</title>
      <link>https://www.pib.gov.in/PressReleasePage.aspx?PRID=2008543</link>
      <description>REVISED GUIDELINES 2026: Subsidies increased up to ₹1,00,000 for rural and hilly areas.</description>
      <pubDate>Wed, 17 Jan 2026 14:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

        const testSource = {
            id: "pib_amendment_test",
            name: "PIB Amendment Test",
            jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
            stateCode: "ALL",
            department: "Ministry of New and Renewable Energy",
            connectorType: CONNECTOR_TYPES.PIB_RSS,
            officialSourceUrl: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=48&lang=1",
            officialDomain: "pib.gov.in",
            isEnabled: true,
            pollingIntervalHours: 6,
            coverageStatus: SOURCE_LIFECYCLE_STAGES.CONFIGURED,
        };

        const registry = new GovernmentSourceRegistry();
        registry.registerSource(testSource);

        let savedDoc = null;
        let reindexedDocId = null;

        const mockExistingDoc = {
            _id: new mongoose.Types.ObjectId("507f1f77bcf86cd799439011"),
            title: "Cabinet approves PM Surya Ghar Muft Bijli Yojana",
            rawExtractedText: "Old text content from previous year",
            officialPortalUrl: "https://www.pib.gov.in/PressReleasePage.aspx?PRID=2008543",
            officialSourceUrl: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=48&lang=1",
            contentHash: "old_outdated_sha256_hash_1234567890abcdef",
            sourceVersion: "1.0",
            save: async function () {
                savedDoc = this;
                return this;
            },
        };

        const originalFindOne = Document.findOne;
        const originalIndexDocument = indexingService.indexDocument;

        try {
            Document.findOne = async () => mockExistingDoc;
            indexingService.indexDocument = async (id) => {
                reindexedDocId = String(id);
                return { success: true, chunkCount: 4 };
            };

            const mockFetcher = async () => ({
                ok: true,
                status: 200,
                statusText: "OK",
                headers: new Headers({ "content-type": "application/xml" }),
                text: async () => mockRevisedRssXml,
                arrayBuffer: async () => Buffer.from(mockRevisedRssXml, "utf-8"),
            });

            const result = await governmentSyncService.syncSingleRegisteredSource({
                sourceDef: testSource,
                registry,
                connectorOptions: {
                    fetchFn: mockFetcher,
                    dnsResolver: async () => [{ address: "164.100.1.1", family: 4 }],
                },
            });

            assert.equal(result.success, true);
            assert.equal(result.syncedCount, 0);
            assert.equal(result.updatedCount, 1); // Document updated
            assert.equal(result.skippedCount, 0);
            assert.equal(result.indexedCount, 1); // Re-indexed

            // Verify updated document properties
            assert.ok(savedDoc);
            assert.equal(savedDoc.title, "Cabinet approves PM Surya Ghar Muft Bijli Yojana (Amended)");
            assert.ok(savedDoc.rawExtractedText.includes("Amended"));
            assert.notEqual(savedDoc.contentHash, "old_outdated_sha256_hash_1234567890abcdef");
            assert.equal(savedDoc.sourceVersion, "1.1"); // Incremented version
            assert.equal(savedDoc.officialSourceUrl, "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=48&lang=1"); // Preserved URL

            // Verify re-indexing was triggered on existing document ID
            assert.equal(reindexedDocId, "507f1f77bcf86cd799439011");
        } finally {
            Document.findOne = originalFindOne;
            indexingService.indexDocument = originalIndexDocument;
        }
    });

    // ─── 9. FAILURE ISOLATION ACROSS MULTIPLE SOURCES ───────────────────────────────────
    it("9. Batch synchronization isolates errors: a failing source does not stop other sources", async () => {
        const sourceGood = {
            id: "source_good_feed",
            name: "Good Government Source",
            jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
            stateCode: "ALL",
            department: "Ministry of Finance",
            connectorType: CONNECTOR_TYPES.PIB_RSS,
            officialSourceUrl: "https://www.pib.gov.in/good.aspx",
            officialDomain: "pib.gov.in",
            isEnabled: true,
            pollingIntervalHours: 6,
            coverageStatus: SOURCE_LIFECYCLE_STAGES.CONFIGURED,
        };

        const sourceBroken = {
            id: "source_broken_feed",
            name: "Broken Government Source",
            jurisdictionLevel: JURISDICTION_LEVELS.STATE,
            stateCode: "MH",
            department: "Department of Urban Development",
            connectorType: CONNECTOR_TYPES.PIB_RSS,
            officialSourceUrl: "https://www.pib.gov.in/broken.aspx",
            officialDomain: "pib.gov.in",
            isEnabled: true,
            pollingIntervalHours: 6,
            coverageStatus: SOURCE_LIFECYCLE_STAGES.CONFIGURED,
        };

        const registry = new GovernmentSourceRegistry();
        registry.registerSource(sourceGood);
        registry.registerSource(sourceBroken);

        const goodXml = `<?xml version="1.0"?><rss version="2.0"><channel><title>Good Feed</title><item><title>Welfare Grant 2026</title><link>https://www.pib.gov.in/grant</link><description>Details</description></item></channel></rss>`;

        const mockFetcher = async (url) => {
            if (url.includes("broken")) {
                return {
                    ok: false,
                    status: 503,
                    statusText: "Service Unavailable",
                    headers: new Headers(),
                    text: async () => "Internal Server Error",
                    arrayBuffer: async () => Buffer.from("Internal Server Error"),
                };
            }
            return {
                ok: true,
                status: 200,
                statusText: "OK",
                headers: new Headers({ "content-type": "application/xml" }),
                text: async () => goodXml,
                arrayBuffer: async () => Buffer.from(goodXml),
            };
        };

        const originalFindOne = Document.findOne;
        const originalCreate = Document.create;
        const originalIndexDocument = indexingService.indexDocument;

        try {
            Document.findOne = async () => null;
            Document.create = async (docData) => ({ ...docData, _id: new mongoose.Types.ObjectId() });
            indexingService.indexDocument = async () => ({ success: true });

            const stats = await governmentSyncService.syncRegisteredGovernmentSources({
                registry,
                connectorOptions: {
                    fetchFn: mockFetcher,
                    dnsResolver: async () => [{ address: "164.100.1.1", family: 4 }],
                },
            });

            assert.equal(stats.eligibleSourcesCount, 2);
            assert.equal(stats.syncedCount, 1); // Good source succeeded
            assert.ok(stats.errors.length >= 1); // Broken source recorded error

            // Verify registry states
            const goodState = registry.getSource("source_good_feed");
            assert.equal(goodState.syncStatus, "success");
            assert.equal(goodState.coverageStatus, SOURCE_LIFECYCLE_STAGES.SYNCHRONIZED);

            const brokenState = registry.getSource("source_broken_feed");
            assert.equal(brokenState.syncStatus, "failed");
            assert.ok(brokenState.lastError.includes("503") || brokenState.lastError.includes("HTTP"));
        } finally {
            Document.findOne = originalFindOne;
            Document.create = originalCreate;
            indexingService.indexDocument = originalIndexDocument;
        }
    });

    // ─── 10. SECURITY & SSRF PROTECTION DURING SYNC ─────────────────────────────────────
    it("10. SSRF defense blocks private and cloud metadata targets during source synchronization", async () => {
        const ssrfSources = [
            {
                id: "ssrf_loopback",
                name: "Loopback Attack Source",
                jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
                stateCode: "ALL",
                department: "Testing",
                connectorType: CONNECTOR_TYPES.PIB_RSS,
                officialSourceUrl: "http://127.0.0.1:8080/pib_feed.xml",
                officialDomain: "127.0.0.1",
                isEnabled: true,
                pollingIntervalHours: 6,
                coverageStatus: SOURCE_LIFECYCLE_STAGES.CONFIGURED,
            },
            {
                id: "ssrf_metadata",
                name: "AWS Metadata Attack Source",
                jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
                stateCode: "ALL",
                department: "Testing",
                connectorType: CONNECTOR_TYPES.PIB_RSS,
                officialSourceUrl: "http://169.254.169.254/latest/meta-data/",
                officialDomain: "169.254.169.254",
                isEnabled: true,
                pollingIntervalHours: 6,
                coverageStatus: SOURCE_LIFECYCLE_STAGES.CONFIGURED,
            },
        ];

        for (const src of ssrfSources) {
            const registry = new GovernmentSourceRegistry();
            registry.registerSource(src);

            const result = await governmentSyncService.syncSingleRegisteredSource({
                sourceDef: src,
                registry,
            });

            assert.equal(result.success, false);
            assert.equal(result.syncedCount, 0);
            assert.ok(result.errors.length >= 1);
            assert.ok(
                result.errors.some((e) =>
                    e.toLowerCase().includes("ssrf") ||
                    e.toLowerCase().includes("restricted") ||
                    e.toLowerCase().includes("private") ||
                    e.toLowerCase().includes("loopback")
                ),
                `Expected SSRF error for '${src.id}', got: ${result.errors.join("; ")}`
            );

            // Verify failure recorded in registry
            const regSource = registry.getSource(src.id);
            assert.equal(regSource.syncStatus, "failed");
            assert.ok(regSource.lastError);
        }
    });

    // ─── 11. CIVIC ASSISTANT RAG RETRIEVAL VERIFICATION ─────────────────────────────────
    it("11. Ingested and indexed policy documents are genuinely retrievable by Civic RAG", async () => {
        const testDocId = new mongoose.Types.ObjectId("607f1f77bcf86cd799439099");
        const docTitle = "Pradhan Mantri Fasal Bima Yojana (Crop Insurance 2026)";
        const docText =
            "PMFBY provides comprehensive crop insurance cover against failure of crops due to non-preventable natural risks.\nFarmers must submit claims within 72 hours of localized calamity.";

        const mockChunk = {
            chunkId: "chk_pmfby_001",
            documentId: testDocId,
            chunkIndex: 0,
            totalChunks: 1,
            content: docText,
            contentHash: "chunk_hash_pmfby_123",
            evidence: {
                sectionHeading: "Section 4.1 Claim Settlement",
                clauseNumber: "Clause 72-Hour Calamity Notice",
                pageNumber: 3,
            },
            metadata: {
                title: docTitle,
                documentType: "welfare_policy",
                jurisdictionLevel: "central",
                applicableState: "ALL",
                issuingAuthority: "Ministry of Agriculture",
                officialPortalUrl: "https://pmfby.gov.in",
            },
            indexingStatus: "indexed",
        };

        const originalAggregate = DocumentChunk.aggregate;
        const originalFind = DocumentChunk.find;

        try {
            const mockVector = new Array(768).fill(0.01);

            DocumentChunk.aggregate = async () => [
                {
                    ...mockChunk,
                    score: 0.94,
                },
            ];
            DocumentChunk.find = () => ({
                sort: () => ({
                    limit: () => ({
                        lean: async () => [mockChunk],
                    }),
                }),
                lean: async () => [mockChunk],
            });

            const evidence = await retrieveEvidence("What is the deadline to report crop damage under PMFBY?", {
                mode: "hybrid",
                limit: 3,
                embeddingGenerator: async () => mockVector,
                filters: {
                    jurisdictionLevel: "central",
                    applicableState: "ALL",
                },
            });

            assert.ok(Array.isArray(evidence));
            assert.ok(evidence.length >= 1);

            const retrievedChunk = evidence[0];
            assert.equal(retrievedChunk.title, docTitle);
            assert.ok(retrievedChunk.sourceText.includes("within 72 hours of localized calamity"));
            assert.equal(retrievedChunk.officialPortalUrl, "https://pmfby.gov.in");
            assert.equal(retrievedChunk.clauseNumber, "Clause 72-Hour Calamity Notice");
        } finally {
            DocumentChunk.aggregate = originalAggregate;
            DocumentChunk.find = originalFind;
        }
    });

    // ─── 12. RUN FULL AUTONOMOUS SYNC ORCHESTRATION ─────────────────────────────────────
    it("12. runFullAutonomousSync coordinates baseline catalog and registered sources with filters", async () => {
        let catalogCalled = false;
        let sourcesCalled = false;

        const originalCatalogSync = governmentSyncService.syncNationalStateCatalog;
        const originalSourcesSync = governmentSyncService.syncRegisteredGovernmentSources;

        try {
            governmentSyncService.syncNationalStateCatalog = async () => {
                catalogCalled = true;
                return { totalConsidered: 90, syncedCount: 0, skippedCount: 90, indexedCount: 0 };
            };

            governmentSyncService.syncRegisteredGovernmentSources = async (opts) => {
                sourcesCalled = true;
                assert.equal(opts.limitPerSource, 3);
                assert.equal(opts.stateCode, "MH");
                return {
                    totalSourcesConsidered: 58,
                    eligibleSourcesCount: 1,
                    ineligibleSourcesCount: 57,
                    totalInspected: 2,
                    syncedCount: 1,
                    updatedCount: 0,
                    skippedCount: 1,
                    indexedCount: 1,
                    errors: [],
                    sourceResults: [],
                };
            };

            const outcome = await governmentSyncService.runFullAutonomousSync({
                includeBaselineCatalog: true,
                includeRegisteredSources: true,
                limitPerBureau: 3,
                stateCode: "MH",
            });

            assert.equal(catalogCalled, true);
            assert.equal(sourcesCalled, true);
            assert.equal(outcome.totalNewDocumentsSynced, 1);
            assert.equal(outcome.totalDocumentsUpdated, 0);
            assert.equal(outcome.totalIndexedChunks, 1);
            assert.ok(outcome.timestamp);
            assert.ok(outcome.registeredSources);
            assert.ok(outcome.livePib); // Backward compatibility check
        } finally {
            governmentSyncService.syncNationalStateCatalog = originalCatalogSync;
            governmentSyncService.syncRegisteredGovernmentSources = originalSourcesSync;
        }
    });
});
