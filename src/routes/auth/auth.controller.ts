import { NextFunction, Request, Response } from "express";
import {
  isValidEmail,
  isValidMobile,
} from "../../utils/helper-functions/validators";
import {
  createUser,
  findUserByEmail,
  findUserByEmailOrMobile,
} from "../../models/user.model";
import { generateRefreshToken } from "../../utils/helper-functions/refreshTokenService";
import UnAuthenticatedError from "../../utils/errors/unauthenticated-error";
import httpStatusCodes from "../../utils/constants/http-status-codes";
import admin from "../../utils/helper-functions/firebase-admin";
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
        "ID Token is required for Google authentication",
      );
    }

    // 🔐 Verify Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    const { email, name } = decodedToken;

    if (!email) {
      throw new UnAuthenticatedError("Invalid Google token");
    }

    // 🔎 Find user
    let user = await findUserByEmail(email);

    // 🔑 Generate new GUID
    const newGuid = uuidv4();

    if (user) {
      // 🟢 LOGIN
      user.guid = newGuid;
      await user.save();
    } else {
      console.log("inside else");

      // 🟡 REGISTER (Google user)
      user = await createUser({
        name: name || "Google User",
        email,
        authProvider: "google",
        guid: newGuid,
      });
    }

    // 🔐 Create backend JWT
    const accessToken = await user.createJWT();

    const { token, tokenHash, expiresAt } = generateRefreshToken();

    await RefreshTokenModel.create({
      userId: user._id,
      tokenHash,
      expiresAt,
    });

    return res.status(httpStatusCodes.OK).json({
      isSuccess: true,
      message: "Google authentication successful",
      responseData: {
        id: user._id,
        token: accessToken,
        refreshToken: token,
        guid: user.guid,
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
