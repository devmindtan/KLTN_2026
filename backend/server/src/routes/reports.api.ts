/**
 * Reports API Routes - Smart Reports endpoints
 */
import { Router } from "express";
import { 
  getReports, 
  getReportById, 
  generateReport, 
  deleteReport,
  downloadReportFile,
  downloadReportZip,
  getReportHistory
} from "../controllers/reports.controller";

const router = Router();

// === CRUD Reports ===
router.get("/", getReports);                              // List với pagination, filter
router.get("/history", getReportHistory);                 // Lịch sử hoạt động báo cáo
router.get("/:id", getReportById);                        // Chi tiết + download links  
router.post("/generate", generateReport);                 // Tạo báo cáo mới
router.delete("/:id", deleteReport);                      // Xóa báo cáo (soft delete)

// === Download Files ===
router.get("/:id/download/:format", downloadReportFile);  // Stream PDF/XLSX file
router.get("/:id/download/zip", downloadReportZip);       // Stream ZIP file (cả PDF + XLSX)

export { router as reportsRoutes };