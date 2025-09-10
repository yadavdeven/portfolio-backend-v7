import { Request, Response, NextFunction } from "express";
import AppError from "../utils/errors/app-error";
import textConstants from "../utils/constants/text-constants";
import httpStatusCodes from "../utils/constants/http-status-codes";

export default function errorHandler(
  err: AppError | Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const isDev = process.env.NODE_ENV === "development";

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        status: err.statusCode,
        message: err.message,
        ...(isDev && { stack: err.stack }),
      },
    });
  }

  // Log unknown errors for debugging
  console.error("Unexpected error:", err);

  return res.status(httpStatusCodes.INTERNAL_SERVER_ERROR).json({
    error: {
      status: httpStatusCodes.INTERNAL_SERVER_ERROR,
      message: textConstants.SOMETHING_WENT_WRONG,
      ...(isDev && { stack: err.stack }),
    },
  });
}
