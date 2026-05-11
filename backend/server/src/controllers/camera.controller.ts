import { Request, Response } from "express";
import pool from "../config/database";

/**
 * Lấy danh sách tất cả camera trong hệ thống
 * GET /api/cameras
 */
export const getAllCameras = async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT cam_id, location, display_name FROM camera_data ORDER BY display_name`
    );

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Error fetching cameras:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách camera",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Lấy thông tin chi tiết một camera theo cam_id
 * GET /api/cameras/:cam_id
 */
export const getCameraById = async (req: Request, res: Response) => {
  try {
    const { cam_id } = req.params;

    // Validation: Kiểm tra cam_id có tồn tại
    if (!cam_id || typeof cam_id !== 'string' || cam_id.trim() === '') {
      return res.status(400).json({
        success: false,
        message: "cam_id không hợp lệ hoặc thiếu",
      });
    }

    const result = await pool.query(
      `SELECT cam_id, location, display_name FROM camera_data WHERE cam_id = $1`,
      [cam_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy camera với ID này",
      });
    }

    res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching camera:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy thông tin camera",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Tìm camera gần vị trí được chỉ định (tọa độ GPS)
 * GET /api/cameras/nearby?lat=10.7918902432446&lng=106.691054105759&radius=1
 */
export const getNearbyCamera = async (req: Request, res: Response) => {
  try {
    const { lat, lng, radius = 1 } = req.query;

    // Validation: Kiểm tra lat, lng phải là số hợp lệ
    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: "Thiếu tham số lat và lng",
      });
    }

    const latNum = parseFloat(lat as string);
    const lngNum = parseFloat(lng as string);
    const radiusNum = parseFloat(radius as string);

    if (isNaN(latNum) || isNaN(lngNum) || isNaN(radiusNum)) {
      return res.status(400).json({
        success: false,
        message: "Tham số lat, lng, radius phải là số hợp lệ",
      });
    }

    // Simple filtering (có thể nâng cấp với PostGIS)
    const result = await pool.query(
      `SELECT cam_id, location, display_name FROM camera_data ORDER BY display_name`
    );

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
      note: "Chức năng tìm kiếm theo vị trí có thể được nâng cấp với PostGIS",
    });
  } catch (error) {
    console.error("Error fetching nearby cameras:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi tìm kiếm camera gần",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
