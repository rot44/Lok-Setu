import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    parsePibRssXml,
    extractPibReleaseContent,
    PIB_CLASSIFICATION_SCHEMA,
} from "../src/services/pibWatcher.service.js";

describe("PIB Real-Time Policy Watcher Suite", () => {
    it("1. parsePibRssXml extracts items with title, link, and PRID", () => {
        const sampleXml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
  <channel>
    <title>Press Information Bureau</title>
    <item>
      <title>Cabinet approves PM-Surya Ghar: Muft Bijli Yojana with outlay of Rs 75,021 crore</title>
      <link>https://pib.gov.in/PressReleaseIframePage.aspx?PRID=2330725</link>
    </item>
    <item>
      <title>Prime Minister pays tribute to freedom fighters</title>
      <link>https://pib.gov.in/PressReleaseIframePage.aspx?PRID=2330726</link>
    </item>
  </channel>
</rss>`;

        const items = parsePibRssXml(sampleXml);
        assert.equal(items.length, 2);
        assert.equal(items[0].prid, "2330725");
        assert.equal(
            items[0].title,
            "Cabinet approves PM-Surya Ghar: Muft Bijli Yojana with outlay of Rs 75,021 crore"
        );
        assert.equal(items[1].prid, "2330726");
    });

    it("2. extractPibReleaseContent cleans HTML tags and extracts text cleanly", () => {
        const sampleHtml = `
<html>
<head><style>body { font-size: 14px; }</style></head>
<body>
  <div id="ReleaseContentText">
    <p>Ministry of New and Renewable Energy</p>
    <p>The Union Cabinet chaired by Prime Minister Narendra Modi approved PM-Surya Ghar with total outlay of 75,021 crore.</p>
  </div>
  <script>console.log("tracker");</script>
</body>
</html>`;

        const cleaned = extractPibReleaseContent(sampleHtml);
        assert.ok(cleaned.includes("Ministry of New and Renewable Energy"));
        assert.ok(cleaned.includes("The Union Cabinet chaired by Prime Minister"));
        assert.ok(!cleaned.includes("<p>"));
        assert.ok(!cleaned.includes("tracker"));
    });

    it("3. PIB classification schema has required fields", () => {
        assert.ok(PIB_CLASSIFICATION_SCHEMA);
        assert.equal(PIB_CLASSIFICATION_SCHEMA.type, "OBJECT");
        assert.ok(PIB_CLASSIFICATION_SCHEMA.properties.isCivicPolicyOrWelfare);
        assert.ok(PIB_CLASSIFICATION_SCHEMA.properties.documentType);
        assert.ok(PIB_CLASSIFICATION_SCHEMA.properties.issuingAuthority);
    });
});

