import express from "express";
import { getTrafficPatterns } from "../controllers/traffic-pattern.controller";

const router = express.Router();

/**
 * GET /api/traffic/patterns
 * Query: type (hour|dow|week_of_month|month), camera_id (default: "all"), tz (UTC offset minutes)
 */
router.get("/patterns", getTrafficPatterns);

export default router;
