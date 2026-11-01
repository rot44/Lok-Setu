import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    CONNECTOR_TYPES,
    SOURCE_LIFECYCLE_STAGES,
} from "../src/services/sourceRegistry.service.js";
import { JURISDICTION_LEVELS } from "../src/constants.js";
import {
    getConnectorForSource,
    fetchAndNormalizeSource,
    fetchAndNormalizeSources,
    PibRssConnector,
    GazetteRssConnector,
    ApiRestConnector,
    PortalScraperConnector,
    isPrivateOrRestrictedIp,
    validateConnectorUrlSafety,
} from "../src/services/connectors/index.js";

// Mock helper to create synthetic fetch responses
function createMockFetch(responses) {
    let callIndex = 0;
    return async (url, options = {}) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        const mock = Array.isArray(responses) ? responses[callIndex++] : responses;

        if (!mock) {
            throw new Error(`Unexpected fetch call #${callIndex} to ${urlStr}`);
        }

        if (mock.throwError) {
            throw mock.throwError;
        }

        const headers = new Map(Object.entries(mock.headers || {}));
        const status = mock.status ?? 200;
        const statusText = mock.statusText ?? "OK";
        const bodyText = typeof mock.body === "string" ? mock.body : JSON.stringify(mock.body || {});

        return {
            status,
            statusText,
            ok: status >= 200 && status < 300,
            headers: {
                get: (key) => headers.get(key.toLowerCase()) || null,
            },
            text: async () => bodyText,
            arrayBuffer: async () => Buffer.from(bodyText),
        };
    };
}

// Mock DNS resolver allowing public test IPs
function createMockDns(hostToIpMap = {}) {
    return async (hostname) => {
        const mapped = hostToIpMap[hostname.toLowerCase()];
        if (mapped) {
            return Array.isArray(mapped) ? mapped.map((a) => ({ address: a })) : [{ address: mapped }];
        }
        // Default safe public IP for tests
        return [{ address: "142.250.190.46" }];
    };
}

describe("Modular Government Source Connectors Suite", () => {
    describe("1. Connector Factory & Selection", () => {
        it("selects PibRssConnector for pib_rss", () => {
            const connector = getConnectorForSource({
                id: "src_pib",
                connectorType: CONNECTOR_TYPES.PIB_RSS,
            });
            assert.ok(connector instanceof PibRssConnector);
        });

        it("selects GazetteRssConnector for gazette_rss and custom_feed", () => {
            const c1 = getConnectorForSource({
                id: "src_gazette",
                connectorType: CONNECTOR_TYPES.GAZETTE_RSS,
            });
            assert.ok(c1 instanceof GazetteRssConnector);

            const c2 = getConnectorForSource({
                id: "src_feed",
                connectorType: CONNECTOR_TYPES.CUSTOM_FEED,
            });
            assert.ok(c2 instanceof GazetteRssConnector);
        });

        it("selects ApiRestConnector for api_rest", () => {
            const connector = getConnectorForSource({
                id: "src_api",
                connectorType: CONNECTOR_TYPES.API_REST,
            });
            assert.ok(connector instanceof ApiRestConnector);
        });

        it("selects PortalScraperConnector for portal_scraper", () => {
            const connector = getConnectorForSource({
                id: "src_scraper",
                connectorType: CONNECTOR_TYPES.PORTAL_SCRAPER,
            });
            assert.ok(connector instanceof PortalScraperConnector);
        });

        it("throws an error for missing or unsupported connectorType", () => {
            assert.throws(() => getConnectorForSource({ id: "src_no_type" }), /missing 'connectorType'/);
            assert.throws(
                () => getConnectorForSource({ id: "src_bad", connectorType: "unknown_ai_connector" }),
                /Unsupported connectorType/
            );
        });
    });

    describe("2. Security, SSRF Defense & Redirect Validation", () => {
        it("identifies private and restricted IP addresses accurately", () => {
            assert.equal(isPrivateOrRestrictedIp("127.0.0.1"), true);
            assert.equal(isPrivateOrRestrictedIp("10.0.0.5"), true);
            assert.equal(isPrivateOrRestrictedIp("192.168.1.100"), true);
            assert.equal(isPrivateOrRestrictedIp("172.16.0.1"), true);
            assert.equal(isPrivateOrRestrictedIp("169.254.169.254"), true); // AWS/GCP metadata
            assert.equal(isPrivateOrRestrictedIp("::1"), true);
            assert.equal(isPrivateOrRestrictedIp("fc00::1"), true);
            assert.equal(isPrivateOrRestrictedIp("fe80::1"), true);

            // Public safe IPs
            assert.equal(isPrivateOrRestrictedIp("8.8.8.8"), false);
            assert.equal(isPrivateOrRestrictedIp("142.250.190.46"), false);
        });

        it("blocks SSRF attempts on disallowed hostnames and protocols", async () => {
            const dnsResolver = createMockDns();
            // Localhost
            const r1 = await validateConnectorUrlSafety("http://localhost/admin", { dnsResolver });
            assert.equal(r1.isValid, false);
            assert.ok(r1.error.includes("SSRF protection"));

            // Disallowed protocol
            const r2 = await validateConnectorUrlSafety("ftp://pib.gov.in/feed.xml", { dnsResolver });
            assert.equal(r2.isValid, false);
            assert.ok(r2.error.includes("Disallowed protocol"));

            // Internal IP resolution
            const internalDns = createMockDns({ "internal.gov.in": "10.0.0.1" });
            const r3 = await validateConnectorUrlSafety("https://internal.gov.in/feed", { dnsResolver: internalDns });
            assert.equal(r3.isValid, false);
            assert.ok(r3.error.includes("disallowed private/internal IP"));
        });

        it("validates redirect destinations and aborts if redirect targets a private destination", async () => {
            const mockFetcher = createMockFetch([
                // First hop: Public URL redirects to internal IP
                {
                    status: 302,
                    headers: { location: "http://127.0.0.1/internal-status" },
                },
            ]);

            const connector = new PortalScraperConnector({
                fetcher: mockFetcher,
                dnsResolver: createMockDns(),
            });

            await assert.rejects(
                () => connector.safeFetch("https://mahaonline.gov.in/redirect"),
                /SSRF Blocked/
            );
        });

        it("successfully follows safe redirects up to limit", async () => {
            const mockFetcher = createMockFetch([
                {
                    status: 301,
                    headers: { location: "https://mahaonline.gov.in/notices-final" },
                },
                {
                    status: 200,
                    headers: { "content-type": "text/html" },
                    body: "<html><body><h1>Official Notices</h1></body></html>",
                },
            ]);

            const connector = new PortalScraperConnector({
                fetcher: mockFetcher,
                dnsResolver: createMockDns(),
            });

            const res = await connector.safeFetch("https://mahaonline.gov.in/notices-start");
            assert.equal(res.status, 200);
            assert.equal(res.finalUrl, "https://mahaonline.gov.in/notices-final");
        });
    });

    describe("3. Timeouts & Bounded Response Limits", () => {
        it("handles request timeouts gracefully", async () => {
            const mockFetcher = async () => {
                const err = new Error("The operation was aborted");
                err.name = "AbortError";
                throw err;
            };

            const connector = new PortalScraperConnector({
                fetcher: mockFetcher,
                dnsResolver: createMockDns(),
                timeoutMs: 100,
            });

            await assert.rejects(
                () => connector.safeFetch("https://mahaonline.gov.in/slow"),
                /timed out/
            );
        });

        it("rejects responses exceeding max response size limit", async () => {
            const mockFetcher = createMockFetch({
                status: 200,
                headers: { "content-length": "10485760" }, // 10 MB reported
                body: "huge payload",
            });

            const connector = new PortalScraperConnector({
                fetcher: mockFetcher,
                dnsResolver: createMockDns(),
                maxSizeBytes: 1024 * 1024, // 1 MB limit
            });

            await assert.rejects(
                () => connector.safeFetch("https://mahaonline.gov.in/huge"),
                /exceeds limit/
            );
        });

        it("sends standard browser-compatible User-Agent and merges custom request headers", async () => {
            let capturedHeaders = null;
            const innerFetch = createMockFetch({ status: 200, body: "ok", headers: { "content-type": "text/html" } });
            const mockFetcher = async (url, opts) => {
                capturedHeaders = opts.headers;
                return innerFetch(url, opts);
            };

            const connector = new PortalScraperConnector({
                fetcher: mockFetcher,
                dnsResolver: createMockDns(),
            });

            await connector.safeFetch("https://mahaonline.gov.in/test", {
                headers: { "X-Custom-Auth": "SecretKey123" },
            });

            assert.ok(capturedHeaders);
            assert.ok(capturedHeaders["User-Agent"].includes("Mozilla/5.0"));
            assert.ok(capturedHeaders["User-Agent"].includes("Chrome"));
            assert.equal(capturedHeaders["X-Custom-Auth"], "SecretKey123");
        });
    });

    describe("4. PIB RSS Connector", () => {
        const pibSource = {
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
        };

        it("fetches and normalizes valid PIB RSS releases", async () => {
            const pibXml = `
                <rss version="2.0">
                    <channel>
                        <title>PIB Mumbai Releases</title>
                        <link>https://pib.gov.in</link>
                        <item>
                            <title>Maharashtra launches Ladki Bahin Scheme for Women Financial Security</title>
                            <link>https://pib.gov.in/PressReleasePage.aspx?PRID=2012345</link>
                        </item>
                        <item>
                            <title>Centre extends PM SVANidhi Credit Support for Urban Vendors in Maharashtra</title>
                            <link>https://pib.gov.in/PressReleasePage.aspx?PRID=2012346</link>
                        </item>
                    </channel>
                </rss>
            `;

            const connector = new PibRssConnector({
                fetcher: createMockFetch({ status: 200, body: pibXml, headers: { "content-type": "application/xml" } }),
                dnsResolver: createMockDns(),
            });

            const docs = await connector.fetchAndNormalize(pibSource);
            assert.equal(docs.length, 2);

            assert.equal(docs[0].sourceId, "pib_mh_mumbai");
            assert.equal(docs[0].stateCode, "MH");
            assert.equal(docs[0].title, "Maharashtra launches Ladki Bahin Scheme for Women Financial Security");
            assert.equal(docs[0].documentUrl, "https://pib.gov.in/PressReleasePage.aspx?PRID=2012345");
            assert.equal(docs[0].metadata.prid, "2012345");
            assert.equal(docs[0].isPdf, false);
        });

        it("handles empty or malformed PIB RSS without crashing", async () => {
            const connector = new PibRssConnector({
                fetcher: createMockFetch({ status: 200, body: "not valid xml at all", headers: { "content-type": "text/plain" } }),
                dnsResolver: createMockDns(),
            });

            const docs = await connector.fetchAndNormalize(pibSource);
            assert.equal(docs.length, 0);
        });
    });

    describe("5. State Gazette RSS & Atom Connector", () => {
        const gazetteSource = {
            id: "src_state_gazette",
            name: "State Government e-Gazette",
            jurisdictionLevel: JURISDICTION_LEVELS.STATE,
            stateCode: "KA",
            department: "Department of Printing and Stationery",
            connectorType: CONNECTOR_TYPES.GAZETTE_RSS,
            officialSourceUrl: "https://gazette.karnataka.gov.in/feed.xml",
            officialDomain: "karnataka.gov.in",
            isEnabled: false,
            pollingIntervalHours: 12,
        };

        it("parses RSS 2.0 gazette feeds and identifies PDF enclosures", async () => {
            const rss2Xml = `
                <rss version="2.0">
                    <channel>
                        <title>Karnataka State Gazette Notifications</title>
                        <item>
                            <title>Notification No. FD 12 PES 2024 (Welfare Grant)</title>
                            <link>https://gazette.karnataka.gov.in/notice/123</link>
                            <description>Statutory notification regarding education incentive rules.</description>
                            <pubDate>Mon, 15 Jan 2024 10:00:00 GMT</pubDate>
                            <enclosure url="https://gazette.karnataka.gov.in/files/notice123.pdf" type="application/pdf" length="102400"/>
                        </item>
                    </channel>
                </rss>
            `;

            const connector = new GazetteRssConnector({
                fetcher: createMockFetch({ status: 200, body: rss2Xml, headers: { "content-type": "application/xml" } }),
                dnsResolver: createMockDns(),
            });

            const docs = await connector.fetchAndNormalize(gazetteSource);
            assert.equal(docs.length, 1);
            assert.equal(docs[0].title, "Notification No. FD 12 PES 2024 (Welfare Grant)");
            assert.equal(docs[0].isPdf, true);
            assert.equal(docs[0].pdfUrl, "https://gazette.karnataka.gov.in/notice/123");
            assert.ok(docs[0].publicationDate.startsWith("2024-01-15"));
        });

        it("parses Atom XML gazette feeds correctly", async () => {
            const atomXml = `
                <feed xmlns="http://www.w3.org/2005/Atom">
                    <title>State Circulars Feed</title>
                    <entry>
                        <title>Circular on MSME Interest Subsidy</title>
                        <link href="https://gazette.karnataka.gov.in/circulars/msme-456.pdf" rel="alternate"/>
                        <updated>2024-03-20T12:00:00Z</updated>
                        <summary>Guidelines for subsidy claims by rural micro enterprises.</summary>
                    </entry>
                </feed>
            `;

            const connector = new GazetteRssConnector({
                fetcher: createMockFetch({ status: 200, body: atomXml, headers: { "content-type": "application/atom+xml" } }),
                dnsResolver: createMockDns(),
            });

            const docs = await connector.fetchAndNormalize(gazetteSource);
            assert.equal(docs.length, 1);
            assert.equal(docs[0].title, "Circular on MSME Interest Subsidy");
            assert.equal(docs[0].isPdf, true);
            assert.ok(docs[0].publicationDate.startsWith("2024-03-20"));
        });
    });

    describe("6. Government REST / JSON API Connector", () => {
        const apiSource = {
            id: "src_delhi_api",
            name: "Delhi Government Orders API",
            jurisdictionLevel: JURISDICTION_LEVELS.STATE,
            stateCode: "DL",
            department: "Information Technology Department",
            connectorType: CONNECTOR_TYPES.API_REST,
            officialSourceUrl: "https://delhi.gov.in/api/v1/orders",
            officialDomain: "delhi.gov.in",
            isEnabled: false,
            pollingIntervalHours: 12,
        };

        it("parses enveloped JSON and normalizes documents", async () => {
            const apiJson = {
                status: "success",
                data: [
                    {
                        id: "DL-2024-001",
                        title: "Delhi Solar Policy 2024 Guidelines",
                        url: "/documents/solar-policy-2024.pdf",
                        date: "2024-02-10",
                        description: "Guidelines and capital subsidies for residential rooftop solar installations.",
                    },
                    {
                        id: "DL-2024-002",
                        subject: "Property Tax Rebate Circular for Senior Citizens",
                        downloadUrl: "https://delhi.gov.in/notices/property-rebate",
                        pubDate: "15/03/2024",
                        summary: "Circular announcing 15% rebate for senior citizen owned properties.",
                    },
                ],
            };

            const connector = new ApiRestConnector({
                fetcher: createMockFetch({ status: 200, body: apiJson, headers: { "content-type": "application/json" } }),
                dnsResolver: createMockDns(),
            });

            const docs = await connector.fetchAndNormalize(apiSource);
            assert.equal(docs.length, 2);

            // Document 1 (Relative PDF URL resolved against API URL)
            assert.equal(docs[0].title, "Delhi Solar Policy 2024 Guidelines");
            assert.equal(docs[0].documentUrl, "https://delhi.gov.in/documents/solar-policy-2024.pdf");
            assert.equal(docs[0].isPdf, true);
            assert.ok(docs[0].publicationDate.startsWith("2024-02-10"));

            // Document 2
            assert.equal(docs[1].title, "Property Tax Rebate Circular for Senior Citizens");
            assert.equal(docs[1].documentUrl, "https://delhi.gov.in/notices/property-rebate");
            assert.equal(docs[1].isPdf, false);
            assert.ok(docs[1].publicationDate.startsWith("2024-03-15"));
        });

        it("handles malformed JSON error without crashing the sync runner", async () => {
            const connector = new ApiRestConnector({
                fetcher: createMockFetch({ status: 200, body: "not valid json {broken", headers: { "content-type": "application/json" } }),
                dnsResolver: createMockDns(),
            });

            const res = await connector.execute(apiSource);
            assert.equal(res.success, false);
            assert.equal(res.documents.length, 0);
            assert.ok(res.errors[0].includes("Failed to parse API response as JSON"));
        });
    });

    describe("7. HTML Listing & Gazette Document Scraper", () => {
        const scraperSource = {
            id: "maha_egazette_portal",
            name: "Maharashtra Government e-Gazette",
            jurisdictionLevel: JURISDICTION_LEVELS.STATE,
            stateCode: "MH",
            department: "Directorate of Government Printing and Stationery",
            connectorType: CONNECTOR_TYPES.PORTAL_SCRAPER,
            officialSourceUrl: "https://egazette.mahaonline.gov.in/list",
            officialDomain: "mahaonline.gov.in",
            isEnabled: false,
            pollingIntervalHours: 12,
        };

        it("parses HTML tables, derives context for generic links, and extracts PDF links", async () => {
            const html = `
                <html>
                    <body>
                        <table class="gazette-table">
                            <thead>
                                <tr><th>Sr No</th><th>Date</th><th>Notification Title</th><th>Action</th></tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>1</td>
                                    <td>14/07/2024</td>
                                    <td>Mukhyamantri Majhi Ladki Bahin Yojana Rules</td>
                                    <td><a href="/downloads/ladki_bahin_gr.pdf">Download</a></td>
                                </tr>
                                <tr>
                                    <td>2</td>
                                    <td>20/08/2024</td>
                                    <td>Amendment to Maharashtra Agricultural Land Ceiling Act</td>
                                    <td><a href="/downloads/land_ceiling_amendment.pdf">View PDF</a></td>
                                </tr>
                            </tbody>
                        </table>
                    </body>
                </html>
            `;

            const connector = new PortalScraperConnector({
                fetcher: createMockFetch({ status: 200, body: html, headers: { "content-type": "text/html" } }),
                dnsResolver: createMockDns(),
            });

            const docs = await connector.fetchAndNormalize(scraperSource);
            assert.equal(docs.length, 2);

            assert.ok(docs[0].title.includes("Mukhyamantri Majhi Ladki Bahin Yojana Rules"));
            assert.equal(docs[0].documentUrl, "https://egazette.mahaonline.gov.in/downloads/ladki_bahin_gr.pdf");
            assert.equal(docs[0].isPdf, true);
            assert.ok(docs[0].publicationDate.startsWith("2024-07-14"));

            assert.ok(docs[1].title.includes("Amendment to Maharashtra Agricultural Land Ceiling Act"));
            assert.equal(docs[1].documentUrl, "https://egazette.mahaonline.gov.in/downloads/land_ceiling_amendment.pdf");
            assert.equal(docs[1].isPdf, true);
        });

        it("discards noise and navigation links from listing page", async () => {
            const html = `
                <html>
                    <body>
                        <nav>
                            <a href="/">Home</a>
                            <a href="/about-us">About Us</a>
                            <a href="javascript:void(0)">Login</a>
                            <a href="mailto:support@maha.gov.in">Contact Us</a>
                        </nav>
                        <div class="content">
                            <a href="/circulars/welfare-notice-2024.pdf">Notification Regarding Divyangjan Welfare Allowance 2024</a>
                        </div>
                    </body>
                </html>
            `;

            const connector = new PortalScraperConnector({
                fetcher: createMockFetch({ status: 200, body: html, headers: { "content-type": "text/html" } }),
                dnsResolver: createMockDns(),
            });

            const docs = await connector.fetchAndNormalize(scraperSource);
            assert.equal(docs.length, 1);
            assert.equal(docs[0].title, "Notification Regarding Divyangjan Welfare Allowance 2024");
            assert.equal(docs[0].documentUrl, "https://egazette.mahaonline.gov.in/circulars/welfare-notice-2024.pdf");
        });
    });

    describe("8. Deduplication, Batch Execution & Error Isolation", () => {
        const sourceDef = {
            id: "src_batch_test",
            name: "Batch Deduplication Source",
            jurisdictionLevel: JURISDICTION_LEVELS.STATE,
            stateCode: "MH",
            department: "Department of Revenue",
            connectorType: CONNECTOR_TYPES.GAZETTE_RSS,
            officialSourceUrl: "https://revenue.maharashtra.gov.in/feed.xml",
            officialDomain: "maharashtra.gov.in",
            isEnabled: false,
            pollingIntervalHours: 12,
        };

        it("deduplicates identical records within a batch by URL and title", async () => {
            const duplicateRss = `
                <rss version="2.0">
                    <channel>
                        <title>Feed</title>
                        <item>
                            <title>Duplicate Notice A</title>
                            <link>https://revenue.maharashtra.gov.in/notice-1</link>
                        </item>
                        <item>
                            <title>Duplicate Notice A</title>
                            <link>https://revenue.maharashtra.gov.in/notice-1</link>
                        </item>
                        <item>
                            <title>Unique Notice B</title>
                            <link>https://revenue.maharashtra.gov.in/notice-2</link>
                        </item>
                    </channel>
                </rss>
            `;

            const mockFetcher = createMockFetch({ status: 200, body: duplicateRss, headers: { "content-type": "application/xml" } });
            const result = await fetchAndNormalizeSource(sourceDef, {
                fetcher: mockFetcher,
                dnsResolver: createMockDns(),
            });

            assert.equal(result.success, true);
            assert.equal(result.totalFound, 2); // 3 items parsed, 1 duplicate removed -> 2 returned
            assert.equal(result.documents[0].title, "Duplicate Notice A");
            assert.equal(result.documents[1].title, "Unique Notice B");
        });

        it("isolates failures across multiple sources in batch execution", async () => {
            const goodSource = {
                id: "src_good",
                name: "Good Source",
                jurisdictionLevel: JURISDICTION_LEVELS.STATE,
                stateCode: "KA",
                department: "Dept A",
                connectorType: CONNECTOR_TYPES.GAZETTE_RSS,
                officialSourceUrl: "https://karnataka.gov.in/feed.xml",
                officialDomain: "karnataka.gov.in",
                isEnabled: false,
                pollingIntervalHours: 12,
            };

            const failingSource = {
                id: "src_failing",
                name: "Failing Source",
                jurisdictionLevel: JURISDICTION_LEVELS.STATE,
                stateCode: "UP",
                department: "Dept B",
                connectorType: CONNECTOR_TYPES.GAZETTE_RSS,
                officialSourceUrl: "https://up.gov.in/bad-feed.xml",
                officialDomain: "up.gov.in",
                isEnabled: false,
                pollingIntervalHours: 12,
            };

            const customFetcher = async (url) => {
                const urlStr = typeof url === "string" ? url : url.toString();
                if (urlStr.includes("karnataka.gov.in")) {
                    const xml = `<rss><channel><item><title>Good Notice</title><link>https://karnataka.gov.in/n1</link></item></channel></rss>`;
                    return {
                        status: 200,
                        statusText: "OK",
                        ok: true,
                        headers: { get: () => "application/xml" },
                        text: async () => xml,
                        arrayBuffer: async () => Buffer.from(xml),
                    };
                }
                // Failing UP feed throws 500
                return {
                    status: 500,
                    statusText: "Internal Server Error",
                    ok: false,
                    headers: { get: () => "text/plain" },
                    text: async () => "Internal Server Error",
                    arrayBuffer: async () => Buffer.from("Internal Server Error"),
                };
            };

            const batchResults = await fetchAndNormalizeSources([goodSource, failingSource], {
                fetcher: customFetcher,
                dnsResolver: createMockDns(),
            });

            assert.equal(batchResults.length, 2);

            // Good source succeeded
            assert.equal(batchResults[0].success, true);
            assert.equal(batchResults[0].totalFound, 1);
            assert.equal(batchResults[0].sourceId, "src_good");

            // Failing source failed without aborting or crashing the good source
            assert.equal(batchResults[1].success, false);
            assert.equal(batchResults[1].totalFound, 0);
            assert.equal(batchResults[1].sourceId, "src_failing");
            assert.ok(batchResults[1].errors.length > 0);
        });
    });
});
