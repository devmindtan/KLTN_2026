/**
 * Decisions API Routes - Decision-Making system endpoints
 */
import { Router } from "express";
import { requireAuth, requireTechnician } from "../middleware/auth.middleware";
import {
  analyzeDecisions,
  listDecisions,
  getDecisionById,
  getDecisionHistory,
  reviewDecision,
  implementDecision,
  dismissDecision,
  createDecision,
} from "../controllers/decisions.controller";

const router = Router();

// === Analysis & Listing ===
router.get("/analyze", requireAuth, analyzeDecisions);           // Trigger analysis + get recommendations
router.get("/", requireAuth, listDecisions);                      // List all decisions with filters
router.get("/camera/:cameraId", requireAuth, getDecisionHistory); // Decision history for specific camera
router.get("/:id", requireAuth, getDecisionById);                 // Get single decision details

// === Decision Management (Technician only) ===
router.post("/create", requireTechnician, createDecision);        // Manually create decision
router.post("/:id/review", requireTechnician, reviewDecision);    // Review + provide feedback
router.post("/:id/implement", requireTechnician, implementDecision); // Mark as implemented
router.delete("/:id", requireTechnician, dismissDecision);        // Dismiss decision

export { router as decisionsRoutes };
