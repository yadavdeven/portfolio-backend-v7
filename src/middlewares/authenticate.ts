import { NextFunction, Request, Response } from "express";
import { retrieveEnvVariables } from "../utils/helper-functions/retrieveENVVariables";
import UnAuthenticatedError from "../utils/errors/unauthenticated-error";
import textConstants from "../utils/constants/text-constants";
import jwt from "jsonwebtoken";

let cachedJwtSecret: string | null = null; // cache like MongoDB util

async function getJwtSecret(): Promise<string> {
  // 1️⃣ If cached, return immediately
  if (cachedJwtSecret) return cachedJwtSecret;

  // 2️⃣ If present in process.env (local dev or preloaded), use it
  if (process.env.JWT_SECRET) {
    cachedJwtSecret = process.env.JWT_SECRET;
    return cachedJwtSecret;
  }

  // 3️⃣ Must fetch from SSM
  const params = await retrieveEnvVariables(process.env.NODE_ENV || "dev", [
    { key: "JWT_SECRET", secure: true },
  ]);

  cachedJwtSecret = params.JWT_SECRET;

  if (!cachedJwtSecret) {
    throw new Error("JWT_SECRET could not be loaded from SSM or env");
  }

  return cachedJwtSecret;
}

export default async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // 1️⃣ Validate authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnAuthenticatedError(textConstants.AUTHENTICATION_FAILED);
    }

    const token = authHeader.split(" ")[1];

    // 2️⃣ Load JWT secret (cached after first call)
    const secret = await getJwtSecret();

    // 3️⃣ Verify JWT
    let payload: any;
    try {
      payload = jwt.verify(token, secret);
    } catch (err) {
      console.error("❌ JWT verification failed:", err);
      throw new UnAuthenticatedError(textConstants.AUTHENTICATION_FAILED);
    }

    // 4️⃣ Attach payload to request
    (req as any).user = { userId: payload.userId };

    next();
  } catch (error) {
    next(error);
  }
}
