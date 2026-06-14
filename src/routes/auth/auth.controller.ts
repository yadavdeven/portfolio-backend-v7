import { NextFunction, Request, Response } from "express";
import {
  isValidEmail,
  isValidMobile,
} from "../../utils/helper-functions/validators";
import {
  createUser,
  findUserByEmail,
  findUserByEmailOrMobile,
  findUserByFirebaseUid,
} from "../../models/user.model";
import { generateRefreshToken } from "../../utils/helper-functions/refreshTokenService";
import UnAuthenticatedError from "../../utils/errors/unauthenticated-error";
import httpStatusCodes from "../../utils/constants/http-status-codes";
import getFirebaseAdmin from "../../utils/helper-functions/firebase-admin";
import RefreshTokenModel from "../../models/refreshToken.mongo";
import BadRequestError from "../../utils/errors/bad-request";
import UserModel from "../../models/user.mongo";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";

const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      throw new BadRequestError("Email and password are required");

    if (!isValidEmail(email))
      throw new BadRequestError("Please provide a valid email address");

    const user = await findUserByEmail(email);
    if (!user) throw new UnAuthenticatedError("Invalid credentials");

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) throw new UnAuthenticatedError("Invalid credentials");

    const updatedGuid = uuidv4();
    user.guid = updatedGuid;
    await user.save();

    // ✅ await the Promise here
    const accessToken = await user.createJWT();

    // generate refresh token
    const { token, tokenHash, expiresAt } = generateRefreshToken();

    await RefreshTokenModel.create({
      userId: user._id,
      tokenHash,
      expiresAt,
    });

    res.status(httpStatusCodes.OK).json({
      isSuccess: true,
      message: "Login successful",
      responseData: {
        id: user._id,
        token: accessToken,
        refreshToken: token,
        guid: user.guid,
        email,
      },
    });
  } catch (error) {
    next(error);
  }
};

const register = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { name, email, mobile, password } = req.body;

    // Validate input
    if (!name || !email || !mobile || !password) {
      throw new BadRequestError(
        "Name, email, mobile, and password are required",
      );
    }
    if (name.length < 3 || name.length > 50) {
      throw new BadRequestError("Name must be between 3 and 50 characters");
    }
    if (!isValidEmail(email)) {
      throw new BadRequestError("Please provide a valid email address");
    }
    if (!isValidMobile(mobile)) {
      throw new BadRequestError("Please provide a valid mobile number");
    }
    if (password.length < 6) {
      throw new BadRequestError("Password must be at least 6 characters long");
    }

    // Check for existing user
    const existingUser = await findUserByEmailOrMobile(email, mobile);
    if (existingUser) {
      if (existingUser.email === email) {
        throw new BadRequestError("Email already in use");
      }
      if (existingUser.mobile === mobile) {
        throw new BadRequestError("Mobile number already in use");
      }
    }

    // Generate new GUID
    const newGuid = uuidv4();

    // Create user with explicit GUID
    const user = await createUser({
      name,
      email,
      mobile,
      password,
      authProvider: "email",
      guid: newGuid,
    });

    const accessToken = await user.createJWT();

    const { token, tokenHash, expiresAt } = generateRefreshToken();

    await RefreshTokenModel.create({
      userId: user._id,
      tokenHash,
      expiresAt,
    });

    res.status(httpStatusCodes.CREATED).json({
      isSuccess: true,
      message: "Registration successful",
      responseData: {
        id: user._id,
        token: accessToken,
        refreshToken: token,
        guid: user.guid,
        email,
      },
    });
  } catch (error) {
    next(error);
  }
};

const googleAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      throw new BadRequestError(
        "ID token is required for Google authentication",
      );
    }

    // 🔐 Verify the Firebase ID token. A verification failure (expired, malformed,
    // wrong project, revoked) is an authentication problem, not a server fault — map
    // it to 401 instead of letting it bubble up as an opaque 500.
    let decodedToken;
    try {
      const admin = await getFirebaseAdmin();
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch {
      throw new UnAuthenticatedError(
        "Invalid or expired Google session. Please sign in again.",
      );
    }

    const {
      uid: firebaseUid,
      email,
      email_verified: emailVerified,
      name,
    } = decodedToken;

    if (!email) {
      throw new UnAuthenticatedError("Google account has no email address");
    }

    // Only trust verified emails. An unverified email could belong to someone
    // else, so accepting it would allow account takeover by email collision.
    if (emailVerified === false) {
      throw new UnAuthenticatedError(
        "Your Google email is not verified. Please verify it and try again.",
      );
    }

    const normalizedEmail = email.toLowerCase();

    // Resolve identity by the stable Firebase UID first; fall back to email so we
    // can link Google to a pre-existing account (legacy users, or someone who
    // first registered with email/password). Email is the trusted link key here
    // precisely because we required `email_verified` above.
    let user = await findUserByFirebaseUid(firebaseUid);
    if (!user) {
      user = await findUserByEmail(normalizedEmail);
    }

    const newGuid = uuidv4();

    if (user) {
      // 🟢 Returning user — or first-time linking of Google to an existing account.
      user.firebaseUid = firebaseUid;
      if (name && !user.name) user.name = name;
      user.guid = newGuid;
      await user.save();
    } else {
      // 🟡 New Google user.
      user = await createUser({
        name: name || "Google User",
        email: normalizedEmail,
        authProvider: "google",
        firebaseUid,
        guid: newGuid,
      });
    }

    // 🔐 Issue our own backend session (access + rotating refresh token).
    const accessToken = await user.createJWT();

    const { token, tokenHash, expiresAt } = generateRefreshToken();

    await RefreshTokenModel.create({
      userId: user._id,
      tokenHash,
      expiresAt,
    });

    res.status(httpStatusCodes.OK).json({
      isSuccess: true,
      message: "Google authentication successful",
      responseData: {
        id: user._id,
        token: accessToken,
        refreshToken: token,
        guid: user.guid,
        email: user.email,
      },
    });
  } catch (error) {
    next(error);
  }
};

const refreshAccessToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new BadRequestError("Refresh token is required");
    }

    // 🔍 find matching token in RefreshToken collection
    const allTokens = await RefreshTokenModel.find();

    let matchedTokenDoc = null;

    for (const tokenDoc of allTokens) {
      const isMatch = await bcrypt.compare(refreshToken, tokenDoc.tokenHash);
      if (isMatch) {
        matchedTokenDoc = tokenDoc;
        break;
      }
    }

    if (!matchedTokenDoc) {
      throw new UnAuthenticatedError("Invalid refresh token");
    }

    const user = await UserModel.findById(matchedTokenDoc.userId);
    if (!user) {
      throw new UnAuthenticatedError("User not found");
    }

    // 🔁 ROTATION → delete old token
    await matchedTokenDoc.deleteOne();

    // create new access token
    const newAccessToken = await user.createJWT();

    // create new refresh token
    const { token, tokenHash, expiresAt } = generateRefreshToken();

    await RefreshTokenModel.create({
      userId: user._id,
      tokenHash,
      expiresAt,
    });

    return res.status(httpStatusCodes.OK).json({
      isSuccess: true,
      responseData: {
        token: newAccessToken,
        refreshToken: token,
      },
    });
  } catch (error) {
    next(error);
  }
};

const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new BadRequestError("Refresh token is required");
    }

    // find matching token
    const allTokens = await RefreshTokenModel.find();

    for (const tokenDoc of allTokens) {
      const isMatch = await bcrypt.compare(refreshToken, tokenDoc.tokenHash);
      if (isMatch) {
        await tokenDoc.deleteOne();
        break;
      }
    }

    return res.status(httpStatusCodes.OK).json({
      isSuccess: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};

export { login, register, googleAuth, refreshAccessToken, logout };
