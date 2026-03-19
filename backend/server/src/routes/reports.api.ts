/**
 * Reports API Routes - Smart Reports endpoints
 */
import { Router } from "express";
import { 
  getReports, 
  getReportById, 
  generateReport, 
  deleteReport,
  downloadReportFile 
} from "../controllers/reports.controller";

const router = Router();

// === CRUD Reports ===
router.get("/", getReports);                              // List với pagination, filter
router.get("/:id", getReportById);                        // Chi tiết + download links  
router.post("/generate", generateReport);                 // Tạo báo cáo mới
router.delete("/:id", deleteReport);                      // Xóa báo cáo (soft delete)

// === Download Files ===
router.get("/:id/download/:format", downloadReportFile);  // Stream PDF/XLSX file

export { router as reportsRoutes };