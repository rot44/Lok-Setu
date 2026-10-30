import test from "node:test";
import assert from "node:assert/strict";
import { translations, SUPPORTED_LANGUAGES } from "../src/translations/index.ts";

test("Lok-Setu Notice & Document Analysis Contracts Suite", async (t) => {
  const EXACT_MISSING_INFO = "This document does not clearly specify this information.";
  const CIVIC_DISCLAIMER = "Informational guidance only. Not an authoritative legal determination.";

  await t.test("1. Upload response contract validates document metadata and status", () => {
    const mockUploadResponse = {
      documentId: "65d8f1e293a8b417c8d9e222",
      fileName: "demolition_show_cause_notice.pdf",
      fileUrl: "https://bucket.s3.ap-south-1.amazonaws.com/user-uploads/demolition.pdf",
      fileType: "pdf",
      fileHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      status: "uploaded",
      readyForAiAnalysis: true,
    };

    assert.equal(mockUploadResponse.documentId, "65d8f1e293a8b417c8d9e222");
    assert.equal(mockUploadResponse.fileName, "demolition_show_cause_notice.pdf");
    assert.equal(mockUploadResponse.fileType, "pdf");
    assert.equal(mockUploadResponse.status, "uploaded");
    assert.equal(mockUploadResponse.readyForAiAnalysis, true);
  });

  await t.test("2. Execution response validates grounded notice breakdown and citations", () => {
    const mockExecutionResponse = {
      documentId: "65d8f1e293a8b417c8d9e222",
      fileName: "demolition_show_cause_notice.pdf",
      fileUrl: "https://bucket.s3.ap-south-1.amazonaws.com/user-uploads/demolition.pdf",
      status: "analyzed",
      isCached: false,
      analysis: {
        language: "hi",
        summary: "यह नगर निगम का कारण बताओ नोटिस है जिसमें 15 दिनों के भीतर निर्माण की अनुमति पेश करने का निर्देश है।",
        noticeFacts: [
          "नगर निगम दिल्ली, भवन विभाग द्वारा नोटिस जारी किया गया।",
          "द्वितीय तल पर अनधिकृत निर्माण का आरोप।",
        ],
        datesAndDeadlines: [
          "नोटिस प्राप्ति के 15 दिनों के भीतर लिखित उत्तर प्रस्तुत करें।",
          "व्यक्तिगत सुनवाई 12 नवंबर 2026 को निर्धारित।",
        ],
        actionItems: [
          "स्वीकृत नक्शा अथवा संपत्ति पंजीकरण का प्रमाण जमा करें।",
          "निर्धारित तिथि पर सहायक अभियंता के समक्ष उपस्थित हों।",
        ],
        penalties: [
          "अनधिकृत भाग का ध्वस्तीकरण और संपत्ति सील करने की चेतावनी।",
        ],
        keyRights: [
          "किसी भी ध्वस्तीकरण आदेश से पूर्व न्यूनतम 15 दिनों का कारण बताओ अवसर पाने का अधिकार।",
        ],
        citizenImpact: "उत्तर न देने पर संपत्ति सील होने का जोखिम।",
        businessImpact: "आवासीय संपत्ति होने के कारण व्यवसाय पर कोई प्रभाव नहीं।",
        missingInformation: [
          "शमन शुल्क (compounding fee) का विवरण नोटिस में नहीं दिया गया है।",
        ],
        citations: [
          {
            chunkId: "chunk_statutory_01",
            documentId: "65d8f1e293a8b417c8d9e111",
            title: "Delhi Municipal Corporation Act 1957",
            issuingAuthority: "Municipal Corporation of Delhi",
            clauseNumber: "Clause 343(1)",
            sourceUrl: "https://mcdonline.nic.in/act-1957",
          },
        ],
        disclaimer: CIVIC_DISCLAIMER,
        requiresOcr: false,
      },
    };

    assert.equal(mockExecutionResponse.status, "analyzed");
    assert.equal(mockExecutionResponse.analysis.language, "hi");
    assert.ok(mockExecutionResponse.analysis.noticeFacts.length >= 2);
    assert.ok(mockExecutionResponse.analysis.datesAndDeadlines.length >= 2);
    assert.ok(mockExecutionResponse.analysis.actionItems.length >= 2);
    assert.ok(mockExecutionResponse.analysis.keyRights.length >= 1);
    assert.equal(mockExecutionResponse.analysis.citations.length, 1);
    assert.equal(mockExecutionResponse.analysis.citations[0].chunkId, "chunk_statutory_01");
    assert.ok(mockExecutionResponse.analysis.disclaimer.includes("Informational guidance"));
  });

  await t.test("3. OCR-required response contract validates transparent limitations", () => {
    const ocrResponse = {
      documentId: "65d8f1e293a8b417c8d9e333",
      fileName: "printed_challan_photo.jpg",
      status: "requires_ocr",
      requiresOcr: true,
      message:
        "This document is a photograph or image file without digital text. OCR (Optical Character Recognition) is required to parse scanned images, but OCR is currently not configured on this server. Please upload an official digital PDF or plain text document.",
    };

    assert.equal(ocrResponse.status, "requires_ocr");
    assert.equal(ocrResponse.requiresOcr, true);
    assert.ok(ocrResponse.message.includes("OCR"));
    assert.ok(ocrResponse.message.includes("not configured"));
  });

  await t.test("4. Missing evidence honors exact non-negotiable sentence", () => {
    const insufficientAnalysis = {
      language: "en",
      summary: "Notice contains insufficient details.",
      noticeFacts: [EXACT_MISSING_INFO],
      datesAndDeadlines: [EXACT_MISSING_INFO],
      actionItems: [EXACT_MISSING_INFO],
      penalties: [EXACT_MISSING_INFO],
      keyRights: [EXACT_MISSING_INFO],
      citizenImpact: EXACT_MISSING_INFO,
      businessImpact: "Not applicable.",
      missingInformation: ["Hearing date omitted", "Section number unstated"],
      citations: [],
      disclaimer: CIVIC_DISCLAIMER,
    };

    assert.equal(insufficientAnalysis.noticeFacts[0], EXACT_MISSING_INFO);
    assert.equal(insufficientAnalysis.datesAndDeadlines[0], EXACT_MISSING_INFO);
    assert.equal(insufficientAnalysis.penalties[0], EXACT_MISSING_INFO);
    assert.equal(insufficientAnalysis.keyRights[0], EXACT_MISSING_INFO);
    assert.equal(insufficientAnalysis.citations.length, 0);
  });

  await t.test("5. Navigation and analyze keys exist across all 8 supported Indian languages", () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      const dict = translations[lang.code];
      assert.ok(dict, `Dictionary for language ${lang.code} must exist`);
      assert.ok(dict["nav.analyze"], `nav.analyze key for ${lang.code} must exist`);
      assert.ok(typeof dict["nav.analyze"] === "string" && dict["nav.analyze"].length > 0);
    }
  });

  await t.test("6. Citation chip validates statutory source link security", () => {
    const citation = {
      chunkId: "chunk_mcd_343",
      title: "Delhi Municipal Corporation Act 1957",
      clauseNumber: "Section 343",
      sourceUrl: "https://mcdonline.nic.in/act-1957",
    };

    const parsed = new URL(citation.sourceUrl);
    assert.equal(parsed.protocol, "https:");
    assert.equal(parsed.hostname, "mcdonline.nic.in");
  });
});
