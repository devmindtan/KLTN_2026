import { Router } from "express";
import { getTrafficHistory } from "../controllers/traffic-history.controller";

const router = Router();

// GET /api/traffic/history?date=YYYY-MM-DD&camera_id=all
router.get("/history", getTrafficHistory);

export default router;
