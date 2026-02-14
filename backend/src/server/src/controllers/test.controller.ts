import { Request, Response } from "express";

export const testController = (req: Request, res: Response) => {
  console.log("✅ testController chạy");
  res.send("Hello from testController!");
};
