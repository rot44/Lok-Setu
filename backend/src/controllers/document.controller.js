import { Document } from "../models/document.model.js";
import { ingestionService } from "../services/ingestion.service.js";
import { ApiError } from "../utils/apiError.js";
import { APIResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * @desc    Ingest and index an official government policy document
 * @route   POST /api/v1/documents/ingest
 * @access  Private (Admin / Official only)
 */
export const ingestOfficialDocument = asyncHandler(async (req, res) => {
    const {
        sourceUrl,
        rawText,
        title,
        issuingAuthority,
        jurisdictionLevel,
        applicableState,
        applicableDistrict,
        documentType,
        language,
        publicationDate,
        effectiveDate,
        applicationDeadline,
        tags,
    } = req.body;

    if (!title || !issuingAuthority || !jurisdictionLevel || !documentType) {
        throw new ApiError(
            400,
            "Required fields missing: 'title', 'issuingAuthority', 'jurisdictionLevel', and 'documentType' are required."
        );
    }

    if (!sourceUrl && !rawText) {
        throw new ApiError(
            400,
            "Either an official 'sourceUrl' or direct 'rawText' must be provided for ingestion."
        );
    }

    const outcome = await ingestionService.registerAndIngestOfficialDocument({
        sourceUrl,
        rawText,
        title,
        issuingAuthority,
        jurisdictionLevel,
        applicableState,
        applicableDistrict,
        documentType,
        language,
        publicationDate,
        effectiveDate,
        applicationDeadline,
        tags,
        uploadedBy: req.user?._id,
    });

    const statusCode = outcome.requiresOcr ? 202 : outcome.isDuplicate ? 200 : 201;

    return res
        .status(statusCode)
        .json(new APIResponse(statusCode, outcome, outcome.message || "Document processed successfully."));
});

/**
 * @desc    Get ingestion and indexing status for a document
 * @route   GET /api/v1/documents/:id/status
 * @access  Private (Authenticated users)
 */
export const getDocumentStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const doc = await Document.findById(id).select(
        "_id title issuingAuthority jurisdictionLevel applicableState documentType officialSourceUrl ingestionStatus indexingStatus indexedChunkCount lastIndexedAt ingestionError indexingError contentHash createdAt updatedAt"
    );

    if (!doc) {
        throw new ApiError(404, `Document with ID '${id}' not found.`);
    }

    return res.status(200).json(
        new APIResponse(
            200,
            {
                documentId: doc._id,
                title: doc.title,
                issuingAuthority: doc.issuingAuthority,
                jurisdictionLevel: doc.jurisdictionLevel,
                applicableState: doc.applicableState,
                documentType: doc.documentType,
                officialSourceUrl: doc.officialSourceUrl,
                ingestionStatus: doc.ingestionStatus,
                indexingStatus: doc.indexingStatus,
                indexedChunkCount: doc.indexedChunkCount,
                contentHash: doc.contentHash,
                lastIndexedAt: doc.lastIndexedAt,
                ingestionError: doc.ingestionError,
                indexingError: doc.indexingError,
            },
            "Document status retrieved successfully."
        )
    );
});
