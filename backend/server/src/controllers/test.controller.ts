import { Request, Response } from "express";

/**
 * Test endpoint để kiểm tra server đang hoạt động
 * GET /
 */
export const testController = (req: Request, res: Response) => {
  console.log("✅ testController chạy");
  res.send("Hello from testController!");
};
