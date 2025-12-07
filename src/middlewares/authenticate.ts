import { NextFunction, Request, Response } from "express";
import UnAuthenticatedError from "../utils/errors/unauthenticated-error";
import textConstants from "../utils/constants/text-constants";
import jwt from "jsonwebtoken";

export default function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnAuthenticatedError(textConstants.AUTHENTICATION_FAILED);
    }

    const token = authHeader.split(" ")[1];

    let payload: any;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET as string);
    } catch (error) {
      console.log("inside catch");

      throw new UnAuthenticatedError(textConstants.AUTHENTICATION_FAILED);
    }
    (req as any).user = {
      userId: payload.userId,
    };

    next();
  } catch (error) {
    next(error);
  }
}
