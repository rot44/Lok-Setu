import { Document } from "../models/document.model.js";
import { ApiError } from "../utils/apiError.js";
import { APIResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * @desc    Fetch government notifications published in the last 7 days (Card 4: Stay Notified)
 * @route   GET /api/v1/notifications
 * @access  Public
 */
export const getRecentNotifications = asyncHandler(async (req, res) => {
    const days = parseInt(req.query.days) || 7;
    const { jurisdictionLevel, state, documentType, page = 1, limit = 20 } = req.query;

    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Build query
    const query = {
        createdAt: { $gte: sinceDate },
        isActive: true,
    };

    if (jurisdictionLevel) {
        query.jurisdictionLevel = jurisdictionLevel;
    }

    if (state && state !== "ALL") {
        query.$or = [{ applicableState: state }, { applicableState: "ALL" }];
    }

    if (documentType) {
        query.documentType = documentType;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const parsedLimit = parseInt(limit);

    const [notifications, totalCount] = await Promise.all([
        Document.find(query)
            .select("title documentType jurisdictionLevel applicableState issuingAuthority applicationDeadline officialPortalUrl tags createdAt")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parsedLimit),
        Document.countDocuments(query),
    ]);

    // Strict Hackathon Rule: Honest Empty State
    if (totalCount === 0) {
        return res.status(200).json(
            new APIResponse(
                200,
                {
                    totalCount: 0,
                    grouped: { today: [], yesterday: [], earlierThisWeek: [] },
                    notifications: [],
                },
                `No new government policies or notifications published in the last ${days} days.`
            )
        );
    }

    // Timeline Grouping logic (Today, Yesterday, Earlier This Week)
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const twoDaysMs = 48 * 60 * 60 * 1000;

    const grouped = {
        today: [],
        yesterday: [],
        earlierThisWeek: [],
    };

    notifications.forEach((item) => {
        const itemTime = new Date(item.createdAt).getTime();
        const diff = now - itemTime;

        if (diff <= oneDayMs) {
            grouped.today.push(item);
        } else if (diff <= twoDaysMs) {
            grouped.yesterday.push(item);
        } else {
            grouped.earlierThisWeek.push(item);
        }
    });

    return res.status(200).json(
        new APIResponse(
            200,
            {
                totalCount,
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / parsedLimit),
                grouped,
                notifications,
            },
            `Found ${totalCount} notifications in the last ${days} days.`
        )
    );
});

/**
 * @desc    Get count of new notifications in the last 7 days (for Navbar 🔔 badge)
 * @route   GET /api/v1/notifications/count
 * @access  Public
 */
export const getRecentNotificationsCount = asyncHandler(async (req, res) => {
    const days = parseInt(req.query.days) || 7;
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const count = await Document.countDocuments({
        createdAt: { $gte: sinceDate },
        isActive: true,
    });

    return res.status(200).json(
        new APIResponse(200, { newCount: count, days }, "Notification count fetched successfully.")
    );
});

/**
 * @desc    Get single notification details
 * @route   GET /api/v1/notifications/:id
 * @access  Public
 */
export const getNotificationById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const notification = await Document.findById(id);
    if (!notification) {
        throw new ApiError(404, "Notification not found.");
    }

    return res.status(200).json(
        new APIResponse(200, notification, "Notification details retrieved.")
    );
});