import crypto from "node:crypto";
import mongoose from "mongoose";
import { UserProfile } from "../models/userProfile.model.js";
import { AiChatSession } from "../models/aiChatSession.model.js";
import { UserAnalyzedDocument } from "../models/userAnalyzedDocument.model.js";
import { ApiError } from "../utils/apiError.js";
import { APIResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadUserNoticeToS3, downloadFileBufferFromS3, uploadUserNoticeAudioToS3, getPresignedDownloadUrl, isStorageConfigured } from "../utils/s3Uploader.js";
import { sarvamService, toTwoLetterLang } from "../services/sarvam.service.js";
import { detectFileTypeFromMagicBytes, computeFileSha256 } from "../utils/fileValidator.js";
import { noticeAnalysisService } from "../services/noticeAnalysis.service.js";
import { validateLanguage } from "../services/civicAnalysis.service.js";

// Regional greeting templates based on citizen's primary language
const WELCOME_MESSAGES = {
    hi: "नमस्ते! आप अपना कोई भी सरकारी नोटिस, म्युनिसिपल ऑर्डर, ड्राफ्ट पॉलिसी या चालान (PDF, DOCX या फ़ोटो) यहाँ अपलोड करें। मैं इसे आपकी ज़रूरत के अनुसार आसान भाषा में समझाऊँगा।",
    gu: "નમસ્તે! તમારો કોઈપણ સરકારી નોટિસ, મ્યુનિસિપલ ઓર્ડર અથવા પોલિસી ડ્રાફ્ટ (PDF, DOCX અથવા ફોટો) અહીં અપલોડ કરો. હું તેને તમારી જરૂરિયાત મુજબ સરળ ભાષામાં સમજાવીશ.",
    mr: "नमस्कार! तुमची कोणतीही सरकारी नोटीस, महानगरपालिका आदेश किंवा ड्राफ्ट पॉलिसी (PDF, DOCX किंवा फोटो) येथे अपलोड करा. मी तुमच्या गरजेनुसार ते सोप्या भाषेत समजावून सांगेन.",
    bn: "নমস্কার! আপনার কোনো সরকারি বিজ্ঞপ্তি, পৌর আদেশ বা ড্রাফট পলিসি (PDF, DOCX বা ফটো) এখানে আপলোড করুন। আমি এটি আপনার জন্য সহজ ভাষায় বুঝিয়ে দেব।",
    ta: "வணக்கம்! உங்கள் அரசு அறிவிப்பு, நகராட்சி ஆணை அல்லது வரைவு பாலிசியை (PDF, DOCX அல்லது படம்) இங்கே பதிவேற்றவும். உங்கள் தேவைக்கேற்ப எளிய மொழியில் விளக்குகிறேன்.",
    te: "నమస్కారం! మీ ప్రభుత్వ నోటీసు, మున్సిపల్ ఆర్డర్ లేదా పాలసీ డ్రాఫ్ట్ (PDF, DOCX లేదా ఫోటో) ఇక్కడ అప్‌లోడ్ చేయండి. నేను మీకు అర్థమయ్యే సులభమైన భాషలో వివరిస్తాను.",
    kn: "ನಮಸ್ಕಾರ! ನಿಮ್ಮ ಯಾವುದೇ ಸರ್ಕಾರಿ ನೋಟಿಸ್, ಪುರಸಭೆ ಆದೇಶ ಅಥವಾ ಕರಡು ನೀತಿಯನ್ನು (PDF, DOCX ಅಥವಾ ಫೋಟೋ) ಇಲ್ಲಿ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ. ನಾನು ಸರಳ ಭಾಷೆಯಲ್ಲಿ ವಿವರಿಸುತ್ತೇನೆ.",
    en: "Hello! Please upload any government notice, municipal order, welfare draft, or challan (PDF, DOCX, or Photo) here. I will break it down into plain language highlighting your exact rights, eligibility, and real-world impacts.",
};

/**
 * Safely fetches citizen profile without Mongoose buffering timeouts when offline or in tests.
 */
const safeFindProfile = async (req) => {
    if (req.userProfile !== undefined) {
        return req.userProfile;
    }
    if (mongoose.connection && mongoose.connection.readyState === 1) {
        return await UserProfile.findOne({ user: req.user._id }).catch(() => null);
    }
    return null;
};

/**
 * @desc    Initiate "Analyze Document" session (Prepares pre-prompt & user profile context for AI)
 * @route   POST /api/v1/analyze/init-session
 * @access  Private (Requires verifyJWT)
 */
export const initAnalyzeSession = asyncHandler(async (req, res) => {
    // 1. Fetch citizen's profile safely
    const profile = await safeFindProfile(req);

    // 2. Build structured user context payload from profile
    const primaryLang = profile?.preferredLanguages?.primary || "hi";
    const secondaryLang = profile?.preferredLanguages?.secondary || "en";
    const tertiaryLang = profile?.preferredLanguages?.tertiary || null;

    const userContext = {
        userId: req.user._id,
        username: req.user.username,
        state: profile?.state || "All India",
        city: profile?.city || "General",
        localityType: profile?.location?.localityType || "urban",
        occupation: profile?.occupation || "other",
        isBusinessOwner: profile?.isBusinessOwner || false,
        isFarmer: profile?.isFarmer || false,
        caste: profile?.caste || "general",
        incomeRange: profile?.incomeRange || "any",
        preferredLanguages: {
            primary: primaryLang,
            secondary: secondaryLang,
            tertiary: tertiaryLang,
        },
    };

    // 3. Formulate the explicit Pre-Prompt for the AI agent (Gemini 3.8 Flash)
    const prePrompt = `SYSTEM DIRECTIVE & CITIZEN CONTEXT:
The user is about to upload a government notification, municipal order, welfare policy draft, or legal notice (PDF, DOCX, or Image).
Your task is to analyze and explain it strictly adhering to this citizen's profile:
- Primary Language for Explanation & Audio Script: ${primaryLang.toUpperCase()}
- Secondary Suggestion Language: ${secondaryLang.toUpperCase()}
- Region / Jurisdiction Context: ${userContext.state}, ${userContext.city} (${userContext.localityType})
- Citizen Occupation: ${userContext.occupation} (Business Owner: ${userContext.isBusinessOwner ? "YES - focus on MSME compliance/penalties" : "NO"})
- Economic Bracket: ${userContext.incomeRange}

REQUIRED OUTPUT STRUCTURE:
1. Plain-Language Summary (Zero legal jargon, in ${primaryLang})
2. Exact Citizen Rights & Protections (What authorities cannot do, legal appeal periods)
3. Eligibility Checklist (Who qualifies, documents required)
4. Real-World Impact (Direct effects on daily life / business fines & subsidies)
5. Action Items & Deadlines (Immediate next steps)`;

    // 4. Create a new AiChatSession with "analyze_document" mode
    const sessionId = crypto.randomUUID();
    const welcomeText = WELCOME_MESSAGES[primaryLang] || WELCOME_MESSAGES.en;

    const chatSession = await AiChatSession.create({
        user: req.user._id,
        sessionId,
        sessionMode: "analyze_document",
        injectedUserProfileContext: userContext,
        messages: [
            {
                sender: "assistant",
                text: welcomeText,
                languageUsed: primaryLang,
                timestamp: new Date(),
            },
        ],
    });

    return res.status(200).json(
        new APIResponse(
            200,
            {
                sessionId: chatSession.sessionId,
                sessionMode: chatSession.sessionMode,
                prePrompt,
                userContext,
                initialMessage: {
                    sender: "assistant",
                    text: welcomeText,
                },
            },
            "Document analysis session initialized successfully."
        )
    );
});

/**
 * @desc    Upload document (PDF/DOCX/Image/Text) to Amazon S3 & save metadata
 * @route   POST /api/v1/analyze/upload
 * @access  Private (Requires verifyJWT)
 */
export const uploadDocumentForAnalysis = asyncHandler(async (req, res) => {
    // 1. File existence check
    if (!req.file || !req.file.buffer) {
        throw new ApiError(400, "Please select and upload a valid file (PDF, DOCX, Image, or Text).");
    }

    const { sessionId } = req.body;
    const fileBuffer = req.file.buffer;
    const originalFileName = req.file.originalname;
    const mimeType = req.file.mimetype;

    // 2. Security: Validate Magic Bytes
    const detectedType = detectFileTypeFromMagicBytes(fileBuffer);
    if (!detectedType) {
        throw new ApiError(
            400,
            "Invalid file content. Only authentic PDF, DOCX, JPG, PNG, WEBP, and TXT files are accepted."
        );
    }

    // 3. Compute SHA-256 for deduplication
    const fileHash = computeFileSha256(fileBuffer);

    // 4. Deduplication Check: If user already uploaded this exact file, return cached record
    const existingDoc = await UserAnalyzedDocument.findOne({
        user: req.user._id,
        fileHash,
    });

    if (existingDoc && existingDoc.status === "analyzed") {
        return res.status(200).json(
            new APIResponse(
                200,
                {
                    isCached: true,
                    documentId: existingDoc._id,
                    fileName: existingDoc.fileName,
                    fileUrl: existingDoc.fileUrl,
                    fileType: existingDoc.fileType,
                    status: existingDoc.status,
                    analysis: existingDoc.primaryExplanation,
                    audioUrl: existingDoc.audioUrl,
                },
                "Document was already analyzed previously! Retrieved from cache."
            )
        );
    }

    // 5. Upload original file to Amazon S3
    const { s3Key, publicUrl } = await uploadUserNoticeToS3(
        fileBuffer,
        req.user._id,
        originalFileName,
        mimeType
    );

    // 6. Save metadata record to MongoDB (Status: "uploaded")
    const analyzedDoc = await UserAnalyzedDocument.create({
        user: req.user._id,
        fileName: originalFileName,
        fileUrl: publicUrl,
        s3Key,
        fileType: detectedType,
        fileHash,
        status: "uploaded",
    });

    // 7. If linked to an active chat session, append attachment message to history
    if (sessionId) {
        await AiChatSession.findOneAndUpdate(
            { sessionId, user: req.user._id },
            {
                $push: {
                    messages: {
                        sender: "user",
                        text: `Uploaded document: ${originalFileName}`,
                        attachment: {
                            fileUrl: publicUrl,
                            fileName: originalFileName,
                            fileType: detectedType,
                            s3Key,
                        },
                        timestamp: new Date(),
                    },
                },
            }
        );
    }

    // 8. Return response ready for analysis execution
    return res.status(201).json(
        new APIResponse(
            201,
            {
                documentId: analyzedDoc._id,
                fileUrl: publicUrl,
                s3Key,
                fileName: originalFileName,
                fileType: detectedType,
                fileHash,
                status: "uploaded",
                readyForAiAnalysis: true,
            },
            "Document uploaded to Amazon S3 successfully. Ready for AI processing!"
        )
    );
});

/**
 * @desc    Execute grounded notice analysis and structured rights extraction
 * @route   POST /api/v1/analyze/:id/execute
 * @access  Private (Requires verifyJWT)
 */
export const executeDocumentAnalysis = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { language: requestedLanguage } = req.body || {};

    // 1. Validate ID format
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, "Invalid document ID format.");
    }

    // 2. Fetch document & enforce strict ownership
    const doc = await UserAnalyzedDocument.findById(id);
    if (!doc) {
        throw new ApiError(404, "Document not found.");
    }

    if (doc.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "Access denied. You do not own this document.");
    }

    // 3. Resolve target language safely
    let targetLanguage = "en";
    if (requestedLanguage) {
        targetLanguage = validateLanguage(requestedLanguage);
    } else {
        const profile = await safeFindProfile(req);
        targetLanguage = profile?.preferredLanguages?.primary || "hi";
    }

    // 4. Idempotency Check: Already analyzed?
    if (doc.status === "analyzed" && doc.primaryExplanation?.summary) {
        return res.status(200).json(
            new APIResponse(
                200,
                {
                    documentId: doc._id,
                    fileName: doc.fileName,
                    fileUrl: doc.fileUrl,
                    status: doc.status,
                    isCached: true,
                    analysis: doc.primaryExplanation,
                    rawExtractedText: doc.rawExtractedText,
                    audioUrl: doc.audioUrl,
                },
                "Document was already analyzed previously! Retrieved from cache."
            )
        );
    }

    // 5. Already determined as requiring OCR?
    if (doc.status === "requires_ocr") {
        return res.status(200).json(
            new APIResponse(
                200,
                {
                    documentId: doc._id,
                    fileName: doc.fileName,
                    status: "requires_ocr",
                    requiresOcr: true,
                    message:
                        doc.ocrNotice ||
                        doc.primaryExplanation?.summary ||
                        "This document requires OCR processing. Scanned document or photograph detected without readable digital text.",
                },
                "Document requires OCR processing."
            )
        );
    }

    // 6. Concurrency Guard: Atomically lock state to "processing"
    const lockedDoc = await UserAnalyzedDocument.findOneAndUpdate(
        {
            _id: id,
            user: req.user._id,
            status: { $in: ["uploaded", "failed"] },
        },
        {
            $set: { status: "processing" },
        },
        { new: true }
    );

    if (!lockedDoc) {
        const currentDoc = await UserAnalyzedDocument.findById(id);
        if (currentDoc?.status === "processing") {
            throw new ApiError(409, "Document analysis is already in progress. Please wait.");
        }
        if (currentDoc?.status === "analyzed") {
            return res.status(200).json(
                new APIResponse(
                    200,
                    {
                        documentId: currentDoc._id,
                        fileName: currentDoc.fileName,
                        status: currentDoc.status,
                        isCached: true,
                        analysis: currentDoc.primaryExplanation,
                    },
                    "Document analysis completed."
                )
            );
        }
        if (currentDoc?.status === "requires_ocr") {
            return res.status(200).json(
                new APIResponse(
                    200,
                    {
                        documentId: currentDoc._id,
                        fileName: currentDoc.fileName,
                        status: "requires_ocr",
                        requiresOcr: true,
                        message: currentDoc.ocrNotice || "Document requires OCR processing.",
                    },
                    "Document requires OCR processing."
                )
            );
        }
    }

    try {
        // 7. Retrieve file buffer: support test override or download from S3
        let fileBuffer = req.fileBuffer || null;
        if (!fileBuffer && doc.s3Key) {
            fileBuffer = await downloadFileBufferFromS3(doc.s3Key);
        }

        if (!fileBuffer) {
            throw new ApiError(404, "Uploaded document file could not be found in storage.");
        }

        // 8. Fetch user demographic profile safely
        const profile = await safeFindProfile(req);

        // 9. Execute notice analysis
        const result = await noticeAnalysisService.analyzeNoticeDocument({
            doc,
            buffer: fileBuffer,
            language: targetLanguage,
            userProfile: profile,
            options: req.analysisOptions || {},
        });

        // 10. Persist outcome
        if (result.status === "requires_ocr") {
            doc.status = "requires_ocr";
            doc.requiresOcr = true;
            doc.ocrNotice = result.message;
            doc.primaryExplanation = {
                language: targetLanguage,
                summary: result.message,
                noticeFacts: [],
                datesAndDeadlines: [],
                actionItems: [],
                penalties: [],
                keyRights: [],
                citizenImpact: "",
                businessImpact: "",
                missingInformation: [],
                citations: [],
                disclaimer: "",
                requiresOcr: true,
            };
            await doc.save();

            return res.status(200).json(
                new APIResponse(
                    200,
                    {
                        documentId: doc._id,
                        fileName: doc.fileName,
                        status: "requires_ocr",
                        requiresOcr: true,
                        message: result.message,
                    },
                    "Document requires OCR processing."
                )
            );
        }

        // Successful analysis
        doc.status = "analyzed";
        doc.rawExtractedText = result.rawExtractedText;
        doc.primaryExplanation = result.analysis;
        doc.requiresOcr = false;
        doc.analysisError = null;
        await doc.save();

        return res.status(200).json(
            new APIResponse(
                200,
                {
                    documentId: doc._id,
                    fileName: doc.fileName,
                    fileUrl: doc.fileUrl,
                    status: doc.status,
                    isCached: false,
                    analysis: doc.primaryExplanation,
                    rawExtractedText: doc.rawExtractedText,
                },
                "Document analyzed successfully."
            )
        );
    } catch (err) {
        // Rollback status from "processing" to "failed" so document is not left permanently locked
        await UserAnalyzedDocument.findByIdAndUpdate(id, {
            $set: {
                status: "failed",
                analysisError: err.message || "Document analysis failed.",
            },
        });
        throw err;
    }
});

/**
 * @desc    Get user's uploaded documents history (For Dashboard / Revisit)
 * @route   GET /api/v1/analyze/history
 * @access  Private (Requires verifyJWT)
 */
export const getUserAnalysisHistory = asyncHandler(async (req, res) => {
    const history = await UserAnalyzedDocument.find({ user: req.user._id })
        .select(
            "fileName fileUrl fileType status primaryExplanation.language primaryExplanation.summary requiresOcr audioUrl createdAt"
        )
        .sort({ createdAt: -1 });

    return res.status(200).json(
        new APIResponse(200, { totalCount: history.length, history }, "Analysis history retrieved.")
    );
});

/**
 * @desc    Get single analyzed document details by ID
 * @route   GET /api/v1/analyze/:id
 * @access  Private (Requires verifyJWT)
 */
export const getAnalyzedDocumentById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, "Invalid document ID format.");
    }

    const doc = await UserAnalyzedDocument.findOne({
        _id: id,
        user: req.user._id, // Ownership guard
    });

    if (!doc) {
        throw new ApiError(404, "Document not found or access denied.");
    }

    return res.status(200).json(
        new APIResponse(200, doc, "Document details retrieved successfully.")
    );
});

/**
 * @desc    Generate or retrieve cached audio explainer for a private citizen notice
 * @route   POST /api/v1/analyze/:id/audio
 * @access  Private (Requires verifyJWT)
 */
export const getOrGenerateNoticeAudio = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const requestedLang = req.body?.language || req.query?.language;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, "Invalid document ID format.");
    }

    const doc = await UserAnalyzedDocument.findOne({
        _id: id,
        user: req.user._id, // Strict ownership guard
    });

    if (!doc) {
        throw new ApiError(404, "Document not found or access denied.");
    }

    if (doc.status !== "analyzed" || !doc.primaryExplanation?.summary) {
        throw new ApiError(400, "Document must be analyzed before audio can be generated.");
    }

    const languageCode = toTwoLetterLang(requestedLang || doc.primaryExplanation.language || "hi");

    const shouldRefresh = req.query?.refresh === "true" || req.body?.refresh === true;

    // Check if audio is already generated for this document in this language
    if (!shouldRefresh && doc.audioUrl && doc.audioLanguage === languageCode) {
        let activeAudioUrl = doc.audioUrl;
        if (isStorageConfigured() && doc.audioS3Key) {
            try {
                activeAudioUrl = await getPresignedDownloadUrl(doc.audioS3Key, 86400);
                doc.audioUrl = activeAudioUrl;
                await doc.save();
            } catch {
                activeAudioUrl = doc.audioUrl;
            }
        }
        return res.status(200).json(
            new APIResponse(
                200,
                {
                    documentId: doc._id,
                    fileName: doc.fileName,
                    language: languageCode,
                    audioUrl: activeAudioUrl,
                    durationSeconds: doc.audioDurationSeconds || 0,
                    voiceName: doc.voiceName || "shubh",
                    isCached: true,
                },
                "Cached notice audio retrieved."
            )
        );
    }

    let summaryText = doc.primaryExplanation.summary;
    if (languageCode !== (doc.primaryExplanation.language || "hi")) {
        const transResult = await sarvamService.translateText(summaryText, languageCode, "auto");
        if (transResult?.translatedText) {
            summaryText = transResult.translatedText;
        }
    }

    let ttsResult = null;
    let audioUrl = "";
    let s3Key = "";

    try {
        ttsResult = await sarvamService.synthesizeSpeech(summaryText, languageCode);

        if (isStorageConfigured()) {
            const uploaded = await uploadUserNoticeAudioToS3(ttsResult.audioBuffer, req.user._id, doc._id, languageCode);
            s3Key = uploaded.s3Key;
            audioUrl = await getPresignedDownloadUrl(uploaded.s3Key, 86400);
        } else {
            audioUrl = "data:audio/wav;base64," + ttsResult.audioBuffer.toString("base64");
            s3Key = "user-uploads/" + req.user._id + "/audio/" + doc._id + "-" + languageCode + ".wav";
        }

        doc.audioUrl = audioUrl;
        doc.audioS3Key = s3Key;
        doc.audioDurationSeconds = ttsResult.durationSeconds;
        doc.audioLanguage = languageCode;
        doc.voiceName = ttsResult.speaker;
        await doc.save();
    } catch (sarvamErr) {
        console.warn("⚠️ Sarvam TTS notice for notice explanation, enabling browser speech:", sarvamErr.message);
        return res.status(200).json(
            new APIResponse(
                200,
                {
                    documentId: doc._id,
                    fileName: doc.fileName,
                    language: languageCode,
                    audioUrl: null,
                    useBrowserSpeech: true,
                    durationSeconds: Math.ceil(summaryText.length / 15),
                    voiceName: "Browser Native Voice",
                    summary: summaryText,
                    isCached: false,
                },
                "Browser speech fallback enabled."
            )
        );
    }

    return res.status(200).json(
        new APIResponse(
            200,
            {
                documentId: doc._id,
                fileName: doc.fileName,
                language: languageCode,
                audioUrl: doc.audioUrl,
                durationSeconds: doc.audioDurationSeconds,
                voiceName: doc.voiceName,
                summary: summaryText,
                isCached: false,
            },
            "Notice audio synthesized successfully."
        )
    );
});

/**
 * @desc    Stream or download private notice audio with strict authentication & ownership
 * @route   GET /api/v1/analyze/:id/audio
 * @access  Private (Requires verifyJWT)
 */
export const streamNoticeAudio = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, "Invalid document ID format.");
    }

    const doc = await UserAnalyzedDocument.findOne({
        _id: id,
        user: req.user._id, // Strict ownership guard
    });

    if (!doc) {
        throw new ApiError(404, "Document not found or access denied.");
    }

    if (!doc.audioUrl && !doc.audioS3Key) {
        throw new ApiError(404, "Audio has not been synthesized for this notice. Please request synthesis first.");
    }

    if (isStorageConfigured() && doc.audioS3Key) {
        const buffer = await downloadFileBufferFromS3(doc.audioS3Key);
        res.setHeader("Content-Type", "audio/wav");
        res.setHeader("Content-Length", buffer.length);
        res.setHeader("Cache-Control", "private, no-transform, max-age=3600");
        return res.status(200).send(buffer);
    }

    if (doc.audioUrl) {
        if (doc.audioUrl.startsWith("data:")) {
            const base64Data = doc.audioUrl.split(",")[1];
            const buffer = Buffer.from(base64Data, "base64");
            res.setHeader("Content-Type", "audio/wav");
            res.setHeader("Content-Length", buffer.length);
            return res.status(200).send(buffer);
        }
        return res.redirect(doc.audioUrl);
    }

    throw new ApiError(404, "Audio file not available.");
});
