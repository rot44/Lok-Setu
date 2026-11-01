import assert from "node:assert";
import { describe, it } from "node:test";
import mongoose from "mongoose";
import {
    governmentSourceRegistry,
    CONNECTOR_TYPES,
    SOURCE_LIFECYCLE_STAGES,
    GovernmentSourceRegistry,
} from "../src/services/sourceRegistry.service.js";
import {
    governmentSyncService,
    isSourceEligibleForSync,
    getEligibleSourcesForSync,
    computeContentHash,
} from "../src/services/governmentSync.service.js";
import { indexingService } from "../src/services/indexing.service.js";
import { retrieveEvidence } from "../src/services/retrieval.service.js";
import { Document } from "../src/models/document.model.js";
import { DocumentChunk } from "../src/models/documentChunk.model.js";
import {
    fetchAndNormalizeSource,
    getConnectorForSource,
    PibRssConnector,
} from "../src/services/connectors/index.js";
import { runGovSyncCycle } from "../src/workers/governmentSync.worker.js";
import { JURISDICTION_LEVELS, DOCUMENT_TYPES } from "../src/constants.js";

const safeDnsResolver = async () => [{ address: "164.100.1.1" }];

describe("Autonomous Government Pipeline End-to-End Verification Suite", () => {
    // ─── 1. IDENTIFY ENABLED, SUPPORTED PIB SOURCE ───────────────────────────
    it("1. Identifies currently enabled, supported PIB source in the registry", () => {
        const allSources = governmentSourceRegistry.getAllSources();
        assert.equal(allSources.length, 58, "Registry must contain exactly 58 total sources");

        const eligibleSources = getEligibleSourcesForSync({ registry: governmentSourceRegistry });
        assert.equal(eligibleSources.length, 20, "Exactly 20 PIB sources must be eligible for automated sync");

        // Select the primary Central PIB source
        const centralPib = governmentSourceRegistry.getSource("pib_central_all_india");
        assert.ok(centralPib, "Source 'pib_central_all_india' must exist in registry");
        assert.equal(centralPib.isEnabled, true);
        assert.equal(centralPib.connectorType, CONNECTOR_TYPES.PIB_RSS);
        assert.equal(centralPib.coverageStatus, SOURCE_LIFECYCLE_STAGES.CONFIGURED);
        assert.equal(centralPib.jurisdictionLevel, JURISDICTION_LEVELS.CENTRAL);
        assert.equal(centralPib.stateCode, "ALL");
        assert.equal(centralPib.officialDomain, "pib.gov.in");
        assert.ok(isSourceEligibleForSync(centralPib), "centralPib must pass isSourceEligibleForSync");

        // Verify that state portals remain safely disabled
        const statePortals = allSources.filter((s) => s.connectorType !== CONNECTOR_TYPES.PIB_RSS);
        assert.equal(statePortals.length, 38, "38 state/UT portals must be present in registry");
        for (const portal of statePortals) {
            assert.equal(portal.isEnabled, false, `Portal ${portal.id} must be disabled`);
            assert.equal(isSourceEligibleForSync(portal), false, `Portal ${portal.id} must be ineligible for automated sync`);
        }
    });

    // ─── 2. TRACE THROUGH SYNC WORKER ─────────────────────────────────────────
    it("2. Traces execution through existing government sync worker", async () => {
        let fullSyncCalled = false;
        let receivedOptions = null;

        const originalFullSync = governmentSyncService.runFullAutonomousSync;
        try {
            governmentSyncService.runFullAutonomousSync = async (opts) => {
                fullSyncCalled = true;
                receivedOptions = opts;
                return {
                    timestamp: new Date().toISOString(),
                    catalog: { syncedCount: 0, skippedCount: 90 },
                    registeredSources: {
                        totalSourcesConsidered: 58,
                        eligibleSourcesCount: 20,
                        ineligibleSourcesCount: 38,
                        totalInspected: 2,
                        syncedCount: 1,
                        updatedCount: 0,
                        skippedCount: 1,
                        indexedCount: 1,
                        errors: [],
                    },
                    livePib: {
                        totalInspected: 2,
                        syncedCount: 1,
                        skippedCount: 1,
                        indexedCount: 1,
                        errors: [],
                    },
                    totalNewDocumentsSynced: 1,
                    totalDocumentsUpdated: 0,
                    totalIndexedChunks: 1,
                };
            };

            const result = await runGovSyncCycle();

            assert.equal(fullSyncCalled, true, "Worker must invoke governmentSyncService.runFullAutonomousSync");
            assert.equal(receivedOptions.includeLivePib, true);
            assert.ok(Array.isArray(receivedOptions.bureauCodes));
            assert.equal(result.totalNewDocumentsSynced, 1);
            assert.equal(result.totalIndexedChunks, 1);
        } finally {
            governmentSyncService.runFullAutonomousSync = originalFullSync;
        }
    });

    // ─── 3. FETCH AND NORMALIZATION ──────────────────────────────────────────
    it("3. Verifies that source content is fetched and normalized through connector", async () => {
        const sourceDef = governmentSourceRegistry.getSource("pib_central_all_india");
        const connector = getConnectorForSource(sourceDef, { dnsResolver: safeDnsResolver });
        assert.ok(connector instanceof PibRssConnector, "Must instantiate PibRssConnector");

        const sampleXml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
  <channel>
    <title>PIB Central Releases</title>
    <item>
      <title>Cabinet approves PM Gram Sadak Yojana Phase IV for Rural Connectivity</title>
      <link>https://www.pib.gov.in/PressReleasePage.aspx?PRID=2056789</link>
      <description>Financial outlay of Rs 70,125 crore to construct 62,500 km of rural roads.</description>
      <pubDate>Thu, 15 Oct 2026 10:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

        const mockFetcher = async () => ({
            status: 200,
            statusText: "OK",
            ok: true,
            headers: new Headers({ "content-type": "application/xml" }),
            text: async () => sampleXml,
            arrayBuffer: async () => Buffer.from(sampleXml),
        });

        const result = await fetchAndNormalizeSource(sourceDef, {
            fetcher: mockFetcher,
            dnsResolver: safeDnsResolver,
            limit: 5,
        });

        assert.equal(result.success, true);
        assert.equal(result.documents.length, 1);

        const doc = result.documents[0];
        assert.equal(doc.title, "Cabinet approves PM Gram Sadak Yojana Phase IV for Rural Connectivity");
        assert.equal(doc.documentUrl, "https://www.pib.gov.in/PressReleasePage.aspx?PRID=2056789");
        assert.equal(doc.documentType, DOCUMENT_TYPES.GOVERNMENT_NOTIFICATION);
        assert.equal(doc.jurisdictionLevel, JURISDICTION_LEVELS.CENTRAL);
        assert.equal(doc.stateCode, "ALL");
        assert.equal(doc.metadata.prid, "2056789");
    });

    // ─── 4. MONGODB DOCUMENT PERSISTENCE ──────────────────────────────────────
    it("4. Verifies that documents are persisted to MongoDB with complete metadata", async () => {
        const sourceDef = governmentSourceRegistry.getSource("pib_central_all_india");
        const registry = new GovernmentSourceRegistry();
        registry.registerSource(sourceDef);

        const sampleXml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
  <channel>
    <title>PIB Central Releases</title>
    <item>
      <title>Pradhan Mantri Awas Yojana Urban 2.0 Operational Guidelines Released</title>
      <link>https://www.pib.gov.in/PressReleasePage.aspx?PRID=2059999</link>
      <description>Interest subsidy of 4% on home loans up to Rs 25 lakh for EWS and LIG families.</description>
    </item>
  </channel>
</rss>`;

        const mockFetcher = async () => ({
            status: 200,
            statusText: "OK",
            ok: true,
            headers: new Headers({ "content-type": "application/xml" }),
            text: async () => sampleXml,
            arrayBuffer: async () => Buffer.from(sampleXml),
        });

        let persistedDoc = null;
        let indexedId = null;

        const originalFindOne = Document.findOne;
        const originalCreate = Document.create;
        const originalIndexDocument = indexingService.indexDocument;

        try {
            Document.findOne = async () => null; // New document
            Document.create = async (data) => {
                persistedDoc = {
                    ...data,
                    _id: new mongoose.Types.ObjectId().toString(),
                };
                return persistedDoc;
            };
            indexingService.indexDocument = async (id) => {
                indexedId = id;
                return { chunkCount: 2, indexedCount: 2 };
            };

            const stats = await governmentSyncService.syncSingleRegisteredSource({
                sourceDef,
                registry,
                connectorOptions: { fetcher: mockFetcher, dnsResolver: safeDnsResolver },
            });

            assert.equal(stats.success, true);
            assert.equal(stats.syncedCount, 1);
            assert.equal(stats.updatedCount, 0);
            assert.equal(stats.skippedCount, 0);
            assert.ok(persistedDoc, "Document must be persisted via Document.create");
            assert.equal(persistedDoc.title, "Pradhan Mantri Awas Yojana Urban 2.0 Operational Guidelines Released");
            assert.equal(persistedDoc.jurisdictionLevel, "central");
            assert.equal(persistedDoc.applicableState, "ALL");
            assert.equal(persistedDoc.officialPortalUrl, "https://www.pib.gov.in/PressReleasePage.aspx?PRID=2059999");
            assert.ok(persistedDoc.contentHash);
            assert.ok(persistedDoc.metadataProvenance?.officialSource?.sourceId === "pib_central_all_india");
            assert.equal(indexedId, persistedDoc._id);
        } finally {
            Document.findOne = originalFindOne;
            Document.create = originalCreate;
            indexingService.indexDocument = originalIndexDocument;
        }
    });

    // ─── 5. DOCUMENT CHUNKING AND EMBEDDING INDEXING ──────────────────────────
    it("5. Verifies document chunks and embeddings are created and indexed", async () => {
        const docId = new mongoose.Types.ObjectId().toString();
        const docText = `
GOVERNMENT OF INDIA - MINISTRY OF HOUSING AND URBAN AFFAIRS

1. Scheme Overview and Objectives
Pradhan Mantri Awas Yojana - Urban 2.0 (PMAY-U 2.0) provides financial assistance to eligible urban families.

ELIGIBILITY CRITERIA:
Economically Weaker Section (EWS) households with annual income up to Rs 3 lakh.
Low Income Group (LIG) households with annual income up to Rs 6 lakh.

BENEFITS:
Interest subsidy of 4% for loans up to Rs 25 lakh with tenure of 12 years.
`;
        const mockDoc = {
            _id: docId,
            title: "PMAY-U 2.0 Guidelines",
            rawExtractedText: docText,
            documentType: "welfare_policy",
            jurisdictionLevel: "central",
            applicableState: "ALL",
            issuingAuthority: "Ministry of Housing and Urban Affairs",
            officialPortalUrl: "https://pmayu2.gov.in",
            save: async () => {},
        };

        let insertedChunks = [];
        let deletedFilter = null;

        const originalDocFindById = Document.findById;
        const originalDocFindByIdAndUpdate = Document.findByIdAndUpdate;
        const originalChunkDeleteMany = DocumentChunk.deleteMany;
        const originalChunkInsertMany = DocumentChunk.insertMany;

        try {
            Document.findById = async (id) => (id.toString() === docId ? mockDoc : null);
            Document.findByIdAndUpdate = async () => mockDoc;
            DocumentChunk.deleteMany = async (filter) => {
                deletedFilter = filter;
                return { deletedCount: 0 };
            };
            DocumentChunk.insertMany = async (chunks) => {
                insertedChunks = chunks;
                return chunks;
            };

            const mockEmbeddingGenerator = async ({ texts }) =>
                texts.map(() => ({
                    values: new Array(768).fill(0.02),
                    model: "gemini-embedding-001",
                    dimensions: 768,
                }));

            const result = await indexingService.indexDocument(docId, {
                embeddingGenerator: mockEmbeddingGenerator,
                chunkingOptions: { chunkSize: 200, chunkOverlap: 30 },
            });

            assert.equal(result.documentId, docId);
            assert.ok(result.chunkCount >= 2, "Expected multiple chunks");
            assert.equal(deletedFilter.documentId.toString(), docId, "Must delete stale chunks prior to insert");
            assert.equal(insertedChunks.length, result.chunkCount);

            // Verify chunk structure
            const firstChunk = insertedChunks[0];
            assert.ok(firstChunk.chunkId);
            assert.equal(firstChunk.documentId, docId);
            assert.equal(firstChunk.embedding.values.length, 768);
            assert.equal(firstChunk.indexingStatus, "indexed");
            assert.ok(firstChunk.metadata.title);
            assert.equal(firstChunk.metadata.officialPortalUrl, "https://pmayu2.gov.in");
        } finally {
            Document.findById = originalDocFindById;
            Document.findByIdAndUpdate = originalDocFindByIdAndUpdate;
            DocumentChunk.deleteMany = originalChunkDeleteMany;
            DocumentChunk.insertMany = originalChunkInsertMany;
        }
    });

    // ─── 6. CIVIC ASSISTANT RETRIEVAL AND CITATION ────────────────────────────
    it("6. Verifies Civic Assistant retrieves ingested evidence and cites official source", async () => {
        const testChunk = {
            chunkId: "chk_pmayu_001",
            documentId: new mongoose.Types.ObjectId().toString(),
            chunkIndex: 0,
            totalChunks: 2,
            content: "Interest subsidy of 4% for home loans up to Rs 25 lakh for EWS and LIG families under PMAY-U 2.0.",
            contentHash: "hash_pmayu_test",
            evidence: {
                sectionHeading: "BENEFITS AND INTEREST SUBSIDY",
                clauseNumber: "Clause 3.2 Interest Subvention",
                pageNumber: 1,
            },
            metadata: {
                title: "PMAY-U 2.0 Operational Guidelines",
                documentType: "welfare_policy",
                jurisdictionLevel: "central",
                applicableState: "ALL",
                issuingAuthority: "Ministry of Housing and Urban Affairs",
                officialPortalUrl: "https://pmayu2.gov.in/guidelines",
            },
            indexingStatus: "indexed",
        };

        const originalAggregate = DocumentChunk.aggregate;
        const originalFind = DocumentChunk.find;

        try {
            DocumentChunk.aggregate = async () => [{ ...testChunk, score: 0.95 }];
            DocumentChunk.find = () => ({
                sort: () => ({
                    limit: () => ({
                        lean: async () => [testChunk],
                    }),
                }),
                lean: async () => [testChunk],
            });

            const query = "What is the interest subsidy under PMAY Urban 2.0 for housing loans?";
            const evidence = await retrieveEvidence(query, {
                mode: "hybrid",
                limit: 3,
                embeddingGenerator: async () => new Array(768).fill(0.02),
            });

            assert.ok(Array.isArray(evidence));
            assert.ok(evidence.length >= 1, "Must return at least 1 evidence item");

            const topEvidence = evidence[0];
            assert.equal(topEvidence.title, "PMAY-U 2.0 Operational Guidelines");
            assert.ok(topEvidence.sourceText.includes("Interest subsidy of 4% for home loans"));
            assert.equal(topEvidence.officialPortalUrl, "https://pmayu2.gov.in/guidelines");
            assert.equal(topEvidence.sectionHeading, "BENEFITS AND INTEREST SUBSIDY");
            assert.equal(topEvidence.clauseNumber, "Clause 3.2 Interest Subvention");
        } finally {
            DocumentChunk.aggregate = originalAggregate;
            DocumentChunk.find = originalFind;
        }
    });

    // ─── 7. IDEMPOTENCY ON REPEATED SYNC ──────────────────────────────────────
    it("7. Runs the same sync again and verifies idempotency without duplicate records or chunks", async () => {
        const sourceDef = governmentSourceRegistry.getSource("pib_central_all_india");
        const registry = new GovernmentSourceRegistry();
        registry.registerSource(sourceDef);

        const docTitle = "Pradhan Mantri Awas Yojana Urban 2.0 Operational Guidelines Released";
        const docUrl = "https://www.pib.gov.in/PressReleasePage.aspx?PRID=2059999";
        const docText = docTitle;
        const existingHash = computeContentHash(docTitle, docText);

        const sampleXml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
  <channel>
    <title>PIB Central Releases</title>
    <item>
      <title>${docTitle}</title>
      <link>${docUrl}</link>
    </item>
  </channel>
</rss>`;

        const mockFetcher = async () => ({
            status: 200,
            statusText: "OK",
            ok: true,
            headers: new Headers({ "content-type": "application/xml" }),
            text: async () => sampleXml,
            arrayBuffer: async () => Buffer.from(sampleXml),
        });

        let createCalled = false;
        let indexCalled = false;

        const originalFindOne = Document.findOne;
        const originalCreate = Document.create;
        const originalIndexDocument = indexingService.indexDocument;

        try {
            // Document already exists with the same contentHash
            Document.findOne = async () => ({
                _id: new mongoose.Types.ObjectId().toString(),
                title: docTitle,
                officialPortalUrl: docUrl,
                contentHash: existingHash,
                save: async () => {},
            });
            Document.create = async () => {
                createCalled = true;
                return {};
            };
            indexingService.indexDocument = async () => {
                indexCalled = true;
                return {};
            };

            const stats = await governmentSyncService.syncSingleRegisteredSource({
                sourceDef,
                registry,
                connectorOptions: { fetcher: mockFetcher, dnsResolver: safeDnsResolver },
            });

            assert.equal(stats.success, true);
            assert.equal(stats.syncedCount, 0, "No new documents should be created");
            assert.equal(stats.updatedCount, 0, "No existing documents should be updated");
            assert.equal(stats.skippedCount, 1, "Existing identical document must be skipped");
            assert.equal(stats.indexedCount, 0, "No re-indexing should be triggered");
            assert.equal(createCalled, false, "Document.create must not be called");
            assert.equal(indexCalled, false, "indexingService.indexDocument must not be called");

            const updatedSource = registry.getSource("pib_central_all_india");
            assert.equal(updatedSource.syncStatus, "success");
            assert.ok(updatedSource.lastAttemptedSync);
            assert.ok(updatedSource.lastSuccessfulSync);
        } finally {
            Document.findOne = originalFindOne;
            Document.create = originalCreate;
            indexingService.indexDocument = originalIndexDocument;
        }
    });

    // ─── 8. FAILURE ISOLATION ─────────────────────────────────────────────────
    it("8. Verifies batch failure isolation when one source fails and others succeed", async () => {
        const healthySource = {
            id: "pib_healthy_test",
            name: "PIB Healthy Source",
            jurisdictionLevel: JURISDICTION_LEVELS.CENTRAL,
            stateCode: "ALL",
            department: "Ministry of Information",
            connectorType: CONNECTOR_TYPES.PIB_RSS,
            officialSourceUrl: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=48&lang=1",
            officialDomain: "pib.gov.in",
            isEnabled: true,
            pollingIntervalHours: 6,
            coverageStatus: SOURCE_LIFECYCLE_STAGES.CONFIGURED,
        };

        const failingSource = {
            id: "pib_failing_test",
            name: "PIB Failing Source",
            jurisdictionLevel: JURISDICTION_LEVELS.STATE,
            stateCode: "MH",
            department: "Regional Bureau",
            connectorType: CONNECTOR_TYPES.PIB_RSS,
            officialSourceUrl: "https://www.pib.gov.in/RssMain.aspx?ModId=6&reg=3&lang=1",
            officialDomain: "pib.gov.in",
            isEnabled: true,
            pollingIntervalHours: 6,
            coverageStatus: SOURCE_LIFECYCLE_STAGES.CONFIGURED,
        };

        const registry = new GovernmentSourceRegistry();
        registry.registerSource(healthySource);
        registry.registerSource(failingSource);

        const healthyXml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
  <channel>
    <title>Healthy Feed</title>
    <item>
      <title>National Digital Agriculture Mission Launched</title>
      <link>https://www.pib.gov.in/PressReleasePage.aspx?PRID=2099001</link>
    </item>
  </channel>
</rss>`;

        const mockFetcher = async (url) => {
            if (url.includes("reg=3")) {
                // Simulate HTTP 500 server outage on failing source
                return {
                    status: 500,
                    statusText: "Internal Server Error",
                    ok: false,
                    headers: new Headers(),
                    text: async () => "Internal Server Error",
                    arrayBuffer: async () => Buffer.from("error"),
                };
            }
            return {
                status: 200,
                statusText: "OK",
                ok: true,
                headers: new Headers({ "content-type": "application/xml" }),
                text: async () => healthyXml,
                arrayBuffer: async () => Buffer.from(healthyXml),
            };
        };

        const originalFindOne = Document.findOne;
        const originalCreate = Document.create;
        const originalIndexDocument = indexingService.indexDocument;

        try {
            Document.findOne = async () => null;
            Document.create = async (d) => ({ ...d, _id: new mongoose.Types.ObjectId().toString() });
            indexingService.indexDocument = async () => ({ chunkCount: 1 });

            const batchResult = await governmentSyncService.syncRegisteredGovernmentSources({
                registry,
                connectorOptions: { fetcher: mockFetcher, dnsResolver: safeDnsResolver },
            });

            assert.equal(batchResult.eligibleSourcesCount, 2);
            assert.equal(batchResult.syncedCount, 1, "Healthy source document must be synced");
            assert.equal(batchResult.indexedCount, 1, "Healthy source document must be indexed");
            assert.ok(batchResult.errors.length >= 1, "Failing source error must be captured");

            // Verify registry states
            const hStatus = registry.getSource("pib_healthy_test");
            const fStatus = registry.getSource("pib_failing_test");

            assert.equal(hStatus.syncStatus, "success");
            assert.equal(hStatus.lastError, null);
            assert.ok(hStatus.lastSuccessfulSync);

            assert.equal(fStatus.syncStatus, "failed");
            assert.ok(fStatus.lastError.includes("HTTP 500"));
        } finally {
            Document.findOne = originalFindOne;
            Document.create = originalCreate;
            indexingService.indexDocument = originalIndexDocument;
        }
    });
});
