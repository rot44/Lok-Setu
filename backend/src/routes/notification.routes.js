import { Router } from "express";
import { getRecentNotifications, getRecentNotificationsCount, getNotificationById} from "../controllers/notification.controller.js";

const router = Router();

// Navbar badge count (e.g. GET /api/v1/notifications/count)
router.get("/count", getRecentNotificationsCount);

// Main feed with 7-day filter & grouping (e.g. GET /api/v1/notifications?days=7)
router.get("/", getRecentNotifications);

// Single notification
router.get("/:id", getNotificationById);

export default router;