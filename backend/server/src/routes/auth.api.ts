import express from "express";
import {
  getGuestToken,
  login,
  refreshToken,
  logout,
  getMe,
  changePassword,
  getActivityLogs,
} from "../controllers/auth.controller";
import { requireTechnician } from "../middleware/auth.middleware";

const router = express.Router();

// Public – không cần token
router.post("/guest-token", getGuestToken);
router.post("/login",       login);
router.post("/refresh",     refreshToken);

// Protected – chỉ technician
router.post("/logout",          requireTechnician, logout);
router.get("/me",               requireTechnician, getMe);
router.put("/change-password",  requireTechnician, changePassword);
router.get("/activity-logs",    requireTechnician, getActivityLogs);

export default router;
