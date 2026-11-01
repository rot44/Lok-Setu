import net from "node:net";
import dns from "node:dns/promises";
import { DOCUMENT_TYPES, JURISDICTION_LEVELS } from "../../constants.js";
import { validateSourceDefinition } from "../sourceRegistry.service.js";

/**
 * Checks whether an IP address belongs to private, loopback, link-local,
 * cloud metadata, or reserved ranges to prevent SSRF attacks.
 *
 * @param {string} ip - IPv4 or IPv6 string
 * @returns {boolean} True if address is private or restricted
 */
export function isPrivateOrRestrictedIp(ip) {
    if (!ip || typeof ip !== "string") return true;
    const trimmed = ip.trim();

    // IPv4 Checks
    if (net.isIPv4(trimmed)) {
        const parts = trimmed.split(".").map(Number);
        if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
            return true;
        }

        const [b0, b1, b2] = parts;

        // Loopback: 127.0.0.0/8
        if (b0 === 127) return true;
        // Zero / current network: 0.0.0.0/8
        if (b0 === 0) return true;
        // RFC 1918 Private: 10.0.0.0/8
        if (b0 === 10) return true;
        // RFC 1918 Private: 172.16.0.0/12 (172.16 - 172.31)
        if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;
        // RFC 1918 Private: 192.168.0.0/16
        if (b0 === 192 && b1 === 168) return true;
        // Link-Local / Cloud Metadata: 169.254.0.0/16 (e.g. AWS/GCP 169.254.169.254)
        if (b0 === 169 && b1 === 254) return true;
        // Carrier-grade NAT (CGNAT): 100.64.0.0/10
        if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;
        // Documentation & Testnets
        if (b0 === 192 && b1 === 0 && b2 === 2) return true; // 192.0.2.0/24 (TEST-NET-1)
        if (b0 === 198 && b1 === 51 && b2 === 100) return true; // 198.51.100.0/24 (TEST-NET-2)
        if (b0 === 203 && b1 === 0 && b2 === 113) return true; // 203.0.113.0/24 (TEST-NET-3)
        if (b0 === 198 && (b1 === 18 || b1 === 19)) return true; // 198.18.0.0/15
        // Multicast & Reserved (224.0.0.0 - 255.255.255.255)
        if (b0 >= 224) return true;

        return false;
    }

    // IPv6 Checks
    if (net.isIPv6(trimmed)) {
        const lower = trimmed.toLowerCase();
        if (lower === "::1" || lower === "0:0:0:0:0:0:0:1") return true;
        if (lower === "::" || lower === "0:0:0:0:0:0:0:0") return true;
        if (lower.startsWith("::ffff:")) {
            return isPrivateOrRestrictedIp(lower.replace("::ffff:", ""));
        }
        // Unique Local Address (fc00::/7)
        if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
        // Link-local (fe80::/10)
        if (/^fe[89ab]/i.test(lower)) return true;
        // Documentation (2001:db8::/32)
        if (lower.startsWith("2001:db8:") || lower.startsWith("2001:0db8:")) return true;

        return false;
    }

    return true;
}

/**
 * Validates a target URL against SSRF vulnerabilities and protocol constraints.
 * Resolves DNS to ensure no private/loopback/cloud metadata IP addresses are targeted.
 *
 * @param {string} urlString
 * @param {Object} [options]
 * @param {Function} [options.dnsResolver]
 * @returns {Promise<{ isValid: boolean, error?: string, parsedUrl?: URL }>}
 */
export async function validateConnectorUrlSafety(urlString, options = {}) {
    if (!urlString || typeof urlString !== "string" || !urlString.trim()) {
        return { isValid: false, error: "URL string is required" };
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(urlString.trim());
    } catch (_e) {
        return { isValid: false, error: `Malformed URL: '${urlString}'` };
    }

    // 1. Protocol: Only HTTP and HTTPS
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        return { isValid: false, error: `Disallowed protocol '${parsedUrl.protocol}'. Only http: and https: are allowed.` };
    }

    const hostname = parsedUrl.hostname.toLowerCase();

    // 2. Reject obvious loopback and metadata hostnames
    if (
        hostname === "localhost" ||
        hostname.endsWith(".localhost") ||
        hostname.endsWith(".local") ||
        hostname.endsWith(".internal") ||
        hostname === "metadata.google.internal" ||
        hostname === "instance-data"
    ) {
        return { isValid: false, error: `Access to internal/loopback host '${hostname}' is disallowed (SSRF protection).` };
    }

    // 3. IP check
    if (net.isIP(hostname)) {
        if (isPrivateOrRestrictedIp(hostname)) {
            return { isValid: false, error: `Access to restricted IP address '${hostname}' is disallowed (SSRF protection).` };
        }
    } else {
        const lookupFn = options.dnsResolver || dns.lookup;
        try {
            const records = await lookupFn(hostname, { all: true });
            if (!records || records.length === 0) {
                return { isValid: false, error: `DNS resolution failed for hostname '${hostname}'.` };
            }
            const ips = records.map((r) => r.address || r);
            for (const ip of ips) {
                if (isPrivateOrRestrictedIp(ip)) {
                    return {
                        isValid: false,
                        error: `Hostname '${hostname}' resolved to disallowed private/internal IP '${ip}' (SSRF protection).`,
                    };
                }
            }
        } catch (dnsErr) {
            return { isValid: false, error: `DNS lookup error for host '${hostname}': ${dnsErr.message}` };
        }
    }

    return { isValid: true, parsedUrl };
}

/**
 * Base Government Connector class.
 * Provides safe HTTP fetching, SSRF defense, timeout bounding, content normalization,
 * and error isolation across all government policy source types.
 */
export class BaseGovernmentConnector {
    constructor(options = {}) {
        this.timeoutMs = options.timeoutMs ?? 10000;
        this.maxSizeBytes = options.maxSizeBytes ?? 5 * 1024 * 1024; // 5 MB max response size
        this.maxRedirects = options.maxRedirects ?? 3;
        this.fetcher = options.fetcher || fetch;
        this.dnsResolver = options.dnsResolver || null;
    }

    /**
     * Validates that the input source conforms to the government source registry schema.
     *
     * @param {Object} sourceDef
     * @throws {Error} If definition is invalid
     */
    validateSource(sourceDef) {
        const validation = validateSourceDefinition(sourceDef);
        if (!validation.isValid) {
            throw new Error(`Invalid source definition for '${sourceDef?.id || "unnamed"}': ${validation.errors.join("; ")}`);
        }
    }

    /**
     * Safely fetches a URL with SSRF checks at every hop, redirect limits, timeouts, and body size bounds.
     *
     * @param {string} urlString
     * @param {Object} [overrideOptions]
     * @returns {Promise<{ buffer: Buffer, text: string, contentType: string, finalUrl: string, status: number }>}
     */
    async safeFetch(urlString, overrideOptions = {}) {
        const maxRedirects = overrideOptions.maxRedirects ?? this.maxRedirects;
        const maxSizeBytes = overrideOptions.maxSizeBytes ?? this.maxSizeBytes;
        const timeoutMs = overrideOptions.timeoutMs ?? this.timeoutMs;
        const fetchFn = overrideOptions.fetcher || this.fetcher;
        const dnsResolver = overrideOptions.dnsResolver || this.dnsResolver;

        let currentUrl = urlString;
        let redirectCount = 0;

        while (redirectCount <= maxRedirects) {
            // SSRF validation at every hop
            const safety = await validateConnectorUrlSafety(currentUrl, { dnsResolver });
            if (!safety.isValid) {
                throw new Error(`SSRF Blocked: ${safety.error}`);
            }

            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);

            let response;
            try {
                response = await fetchFn(currentUrl, {
                    method: "GET",
                    redirect: "manual", // Handle redirects explicitly to revalidate target
                    signal: controller.signal,
                    headers: {
                        "User-Agent":
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 (LokSetuCivicIngestion/1.0)",
                        Accept: "application/xml, text/xml, application/json, text/html, application/pdf;q=0.9, */*;q=0.8",
                        ...(overrideOptions.headers || {}),
                    },
                });
            } catch (err) {
                if (err.name === "AbortError" || err.message?.includes("aborted")) {
                    throw new Error(`Connection timed out after ${timeoutMs}ms for '${currentUrl}'`);
                }
                throw new Error(`Network error while fetching '${currentUrl}': ${err.message}`);
            } finally {
                clearTimeout(timer);
            }

            // Handle HTTP Redirects (301, 302, 303, 307, 308)
            if ([301, 302, 303, 307, 308].includes(response.status)) {
                const locationHeader = response.headers.get("location");
                if (!locationHeader) {
                    throw new Error(`Received HTTP ${response.status} redirect without Location header from '${currentUrl}'`);
                }

                redirectCount++;
                if (redirectCount > maxRedirects) {
                    throw new Error(`Exceeded maximum redirect limit of ${maxRedirects}`);
                }

                currentUrl = new URL(locationHeader, currentUrl).toString();
                continue;
            }

            if (!response.ok) {
                throw new Error(`Source endpoint returned HTTP ${response.status} (${response.statusText})`);
            }

            // Content-Length header cap check
            const reportedLength = Number(response.headers.get("content-length"));
            if (!Number.isNaN(reportedLength) && reportedLength > maxSizeBytes) {
                throw new Error(`Payload size ${reportedLength} bytes exceeds limit of ${maxSizeBytes} bytes`);
            }

            const arrayBuf = await response.arrayBuffer();
            const buffer = Buffer.isBuffer(arrayBuf)
                ? arrayBuf
                : Buffer.from(arrayBuf.buffer || arrayBuf, arrayBuf.byteOffset || 0, arrayBuf.byteLength || arrayBuf.length);

            if (buffer.length > maxSizeBytes) {
                throw new Error(`Downloaded body ${buffer.length} bytes exceeds maximum size ${maxSizeBytes} bytes`);
            }

            const contentType = (response.headers.get("content-type") || "").toLowerCase();
            const text = buffer.toString("utf-8");

            return {
                buffer,
                text,
                contentType,
                finalUrl: currentUrl,
                status: response.status,
            };
        }

        throw new Error(`Exceeded maximum redirect limit of ${maxRedirects}`);
    }

    /**
     * Strips styles, scripts, HTML tags, and unescapes common HTML entities.
     *
     * @param {string} html
     * @returns {string} Clean plain text
     */
    cleanHtml(html) {
        if (!html || typeof html !== "string") return "";
        return html
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&ndash;/g, "-")
            .replace(/&mdash;/g, "--")
            .replace(/\s+/g, " ")
            .trim();
    }

    /**
     * Parses standard Indian date representations (DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, RFC 2822, ISO).
     *
     * @param {string} rawDate
     * @returns {string|null} ISO 8601 Date string or null
     */
    parseDate(rawDate) {
        if (!rawDate || typeof rawDate !== "string") return null;
        const clean = rawDate.trim();

        // 1. Try standard Date.parse
        const parsedTimestamp = Date.parse(clean);
        if (!isNaN(parsedTimestamp)) {
            return new Date(parsedTimestamp).toISOString();
        }

        // 2. Try DD/MM/YYYY or DD-MM-YYYY
        const dmyMatch = clean.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
        if (dmyMatch) {
            const day = Number(dmyMatch[1]);
            const month = Number(dmyMatch[2]) - 1;
            const year = Number(dmyMatch[3]);
            const d = new Date(Date.UTC(year, month, day));
            if (!isNaN(d.getTime())) {
                return d.toISOString();
            }
        }

        // 3. Try Embedded Date in text
        const embeddedMatch = clean.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
        if (embeddedMatch) {
            const day = Number(embeddedMatch[1]);
            const month = Number(embeddedMatch[2]) - 1;
            const year = Number(embeddedMatch[3]);
            const d = new Date(Date.UTC(year, month, day));
            if (!isNaN(d.getTime())) {
                return d.toISOString();
            }
        }

        return null;
    }

    /**
     * Standardizes an extracted raw item into the official Lok-Setu policy record shape.
     *
     * @param {Object} item
     * @param {Object} sourceDef
     * @returns {Object} Normalized policy record
     */
    normalizeRecord(item, sourceDef) {
        const title = (item.title || "").trim();
        const documentUrl = (item.documentUrl || item.link || item.url || sourceDef.officialSourceUrl).trim();
        const publicationDate = this.parseDate(item.publicationDate || item.pubDate || item.date);
        const isPdf = Boolean(item.isPdf || documentUrl.toLowerCase().endsWith(".pdf"));

        return {
            sourceId: sourceDef.id,
            sourceName: sourceDef.name,
            jurisdictionLevel: sourceDef.jurisdictionLevel,
            stateCode: sourceDef.stateCode || "ALL",
            department: sourceDef.department,
            title,
            documentUrl,
            officialSourceUrl: sourceDef.officialSourceUrl,
            publicationDate,
            rawContent: (item.rawContent || item.summary || title).trim(),
            documentType: item.documentType || DOCUMENT_TYPES.GOVERNMENT_NOTIFICATION,
            isPdf,
            pdfUrl: isPdf ? documentUrl : (item.pdfUrl || null),
            metadata: {
                connectorType: sourceDef.connectorType,
                retrievedAt: new Date().toISOString(),
                ...(item.metadata || {}),
            },
        };
    }

    /**
     * Abstract method: Subclasses must implement fetchAndNormalize.
     *
     * @param {Object} _sourceDef
     * @param {Object} [_options]
     * @returns {Promise<Array<Object>>} Array of normalized documents
     */
    async fetchAndNormalize(_sourceDef, _options = {}) {
        throw new Error("fetchAndNormalize must be implemented by connector subclass");
    }

    /**
     * Main execution entry point.
     * Validates source, runs fetchAndNormalize, isolates exceptions per source, and returns structured result.
     *
     * @param {Object} sourceDef
     * @param {Object} [options]
     * @returns {Promise<{ success: boolean, sourceId: string, connectorType: string, totalFound: number, documents: Array<Object>, errors: Array<string> }>}
     */
    async execute(sourceDef, options = {}) {
        const errors = [];
        let documents = [];

        try {
            this.validateSource(sourceDef);
            documents = await this.fetchAndNormalize(sourceDef, options);
        } catch (err) {
            errors.push(err.message || String(err));
        }

        return {
            success: errors.length === 0,
            sourceId: sourceDef?.id || "unknown",
            connectorType: sourceDef?.connectorType || "unknown",
            totalFound: documents.length,
            documents,
            errors,
        };
    }
}

