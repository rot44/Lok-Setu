import crypto from "node:crypto";
import { UserProfile } from "../models/userProfile.model.js";
import { AiChatSession } from "../models/aiChatSession.model.js";
import { UserAnalyzedDocument } from "../models/userAnalyzedDocument.model.js";
import { ApiError } from "../utils/apiError.js";
import { APIResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadUserNoticeToS3 } from "../utils/s3Uploader.js";
import { detectFileTypeFromMagicBytes, computeFileSha256 } from "../utils/fileValidator.js";

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
 * @desc    Initiate "Analyze Document" session (Prepares pre-prompt & user profile context for AI)
 * @route   POST /api/v1/analyze/init-session
 * @access  Private (Requires verifyJWT)
 */
export const initAnalyzeSession = asyncHandler(async (req, res) => {
    // 1. Fetch citizen's profile
    const profile = await UserProfile.findOne({ user: req.user._id });

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
 * @desc    Upload document (PDF/DOCX/Image) to Amazon S3 & save metadata (Pre-AI Stage)
 * @route   POST /api/v1/analyze/upload
 * @access  Private (Requires verifyJWT)
 */
export const uploadDocumentForAnalysis = asyncHandler(async (req, res) => {
    // 1. File existence check
    if (!req.file || !req.file.buffer) {
        throw new ApiError(400, "Please select and upload a valid file (PDF, DOCX, or Image).");
    }

    const { sessionId } = req.body;
    const fileBuffer = req.file.buffer;
    const originalFileName = req.file.originalname;
    const mimeType = req.file.mimetype;

    // 2. Security: Validate Magic Bytes (Ensures real file format, rejects disguised executables)
    const detectedType = detectFileTypeFromMagicBytes(fileBuffer);
    if (!detectedType) {
        throw new ApiError(
            400,
            "Invalid file content. Only authentic PDF, DOCX, JPG, and PNG files are accepted."
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

    // 6. Save metadata record to MongoDB (Status: "uploaded", waiting for AI pipeline)
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

    // 8. Return response ready for friend's AI Agent pipeline to consume
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
 * @desc    Get user's uploaded documents history (For Dashboard / Revisit)
 * @route   GET /api/v1/analyze/history
 * @access  Private (Requires verifyJWT)
 */
export const getUserAnalysisHistory = asyncHandler(async (req, res) => {
    const history = await UserAnalyzedDocument.find({ user: req.user._id })
        .select("fileName fileUrl fileType status primaryExplanation.language primaryExplanation.summary audioUrl createdAt")
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

