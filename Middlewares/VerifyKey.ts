import type { Request, Response, NextFunction } from "express";
export const VerifyKey = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const API_KEY = req.headers.authorization?.split(" ")[1];

    if (!API_KEY || typeof API_KEY !== "string") {
      return res.status(401).json({
        message:
          "Invalid API_KEY please make sure that you are using a correct api_key .",
      });
    }

    console.log("The error has reached here");
    // database validation
    next();
  } catch (error: any) {
    console.error("AuthMiddleware error\n", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
