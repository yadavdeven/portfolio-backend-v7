import { NextFunction, Request, Response } from "express";
import crypto from "crypto";
import BiometricChallengeModel from "../../models/biometricChallenge.mongo";
import UserModel from "../../models/user.mongo";
import RefreshTokenModel from "../../models/refreshToken.mongo";
import { generateRefreshToken } from "../../utils/helper-functions/refreshTokenService";
import UnAuthenticatedError from "../../utils/errors/unauthenticated-error";
import BadRequestError from "../../utils/errors/bad-request";
import httpStatusCodes from "../../utils/constants/http-status-codes";
import BiometricCredentialModel from "../../models/biometricCredential.mongo";

const CHALLENGE_EXPIRY_MS = 60 * 1000;

const biometricRegisterStart = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new UnAuthenticatedError("Unauthorized");

    const challenge = crypto.randomBytes(32).toString("base64");

    // ✅ only delete registration challenges
    await BiometricChallengeModel.deleteMany({ userId, type: "registration" });
    await BiometricChallengeModel.create({
      userId,
      challenge,
      type: "registration",
      expiresAt: new Date(Date.now() + CHALLENGE_EXPIRY_MS),
    });

    res.status(httpStatusCodes.OK).json({
      isSuccess: true,
      responseData: { challenge },
    });
  } catch (error) {
    next(error);
  }
};

const biometricRegisterVerify = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnAuthenticatedError("Unauthorized");
    }

    const { publicKey, signature, deviceName, deviceId } = req.body;

    if (!publicKey || !signature || !deviceId) {
      throw new BadRequestError(
        "publicKey, signature and deviceId are required",
      );
    }

    const challengeDoc = await BiometricChallengeModel.findOne({
      userId,
      type: "registration",
    }).select("+challenge");

    if (!challengeDoc) {
      throw new BadRequestError("No registration challenge found");
    }

    if (challengeDoc.expiresAt < new Date()) {
      await challengeDoc.deleteOne();
      throw new BadRequestError("Challenge expired, please try again");
    }

    const verify = crypto.createVerify("RSA-SHA256");
    verify.update(challengeDoc.challenge);
    verify.end();

    const pemKey = `-----BEGIN PUBLIC KEY-----
${publicKey}
-----END PUBLIC KEY-----`;

    const isValid = verify.verify(pemKey, signature, "base64");

    if (!isValid) {
      throw new BadRequestError("Signature verification failed");
    }

    // Upsert by (userId, deviceId): enrolling again from the SAME device updates
    // that device's credential in place; a new device creates a new row. Other
    // devices are never touched.
    const newCredential = await BiometricCredentialModel.findOneAndUpdate(
      { userId, deviceId },
      {
        userId,
        deviceId,
        credentialId: crypto.randomUUID(),
        publicKey,
        deviceName: deviceName || "My Device",
        transports: [],
        isActive: true,
        lastUsedAt: null,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    await UserModel.findByIdAndUpdate(userId, {
      biometricEnabled: true,
    });

    await challengeDoc.deleteOne();

    res.status(httpStatusCodes.OK).json({
      isSuccess: true,
      message: "Biometric registered successfully",
      responseData: {
        credentialId: newCredential.credentialId,
      },
    });
  } catch (error) {
    next(error);
  }
};

const biometricLoginStart = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email } = req.body;
    if (!email) throw new BadRequestError("Email is required");

    const user = await UserModel.findOne({ email });
    const hasCredentials =
      !!user &&
      user.biometricEnabled &&
      (await BiometricCredentialModel.exists({
        userId: user._id,
        isActive: true,
      }));

    // Single generic failure for "unknown user", "biometrics off", and "no
    // device" so this public endpoint can't be used to enumerate accounts or
    // discover which emails have biometrics enrolled.
    if (!user || !hasCredentials) {
      throw new UnAuthenticatedError(
        "Biometric login is not available for this account",
      );
    }

    const challenge = crypto.randomBytes(32).toString("base64");

    // ✅ only delete authentication challenges
    await BiometricChallengeModel.deleteMany({
      userId: user._id,
      type: "authentication",
    });
    await BiometricChallengeModel.create({
      userId: user._id,
      challenge,
      type: "authentication",
      expiresAt: new Date(Date.now() + CHALLENGE_EXPIRY_MS),
    });

    // Only the challenge is returned — the device the user is on already knows
    // its own credentialId (stored locally at enrollment), so we never disclose
    // the account's device list to an unauthenticated caller.
    res.status(httpStatusCodes.OK).json({
      isSuccess: true,
      responseData: { challenge },
    });
  } catch (error) {
    next(error);
  }
};

const biometricLoginVerify = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email, signature, credentialId } = req.body;

    if (!email || !signature || !credentialId) {
      throw new BadRequestError(
        "Email, signature and credentialId are required",
      );
    }

    // Uniform failure for every "this didn't match" branch (unknown user,
    // missing challenge, unknown credential, bad signature) so we don't leak
    // which part failed. Replay is already prevented by the single-use,
    // 60s-expiry challenge below — no client-supplied counter required.
    const failVerification = (): never => {
      throw new UnAuthenticatedError("Biometric verification failed");
    };

    const user = await UserModel.findOne({ email });
    if (!user) failVerification();

    const challengeDoc = await BiometricChallengeModel.findOne({
      userId: user!._id,
      type: "authentication",
    }).select("+challenge");

    if (!challengeDoc) failVerification();

    if (challengeDoc!.expiresAt < new Date()) {
      await challengeDoc!.deleteOne();
      throw new BadRequestError("Challenge expired, please try again");
    }

    const storedCredential = await BiometricCredentialModel.findOne({
      userId: user!._id,
      credentialId,
      isActive: true,
    }).select("+publicKey");

    if (!storedCredential) failVerification();

    const verify = crypto.createVerify("RSA-SHA256");
    verify.update(challengeDoc!.challenge);
    verify.end();

    const pemKey = `-----BEGIN PUBLIC KEY-----
${storedCredential!.publicKey}
-----END PUBLIC KEY-----`;

    const isValid = verify.verify(pemKey, signature, "base64");

    if (!isValid) failVerification();

    await BiometricCredentialModel.findByIdAndUpdate(storedCredential!._id, {
      lastUsedAt: new Date(),
    });

    await challengeDoc!.deleteOne();

    // 🔑 Generate tokens
    const accessToken = await user!.createJWT();
    const { token, tokenHash, expiresAt } = generateRefreshToken();

    await RefreshTokenModel.create({
      userId: user!._id,
      tokenHash,
      expiresAt,
    });

    res.status(httpStatusCodes.OK).json({
      isSuccess: true,
      message: "Biometric login successful",
      responseData: {
        id: user!._id,
        token: accessToken,
        refreshToken: token,
        guid: user!.guid,
      },
    });
  } catch (error) {
    next(error);
  }
};

const biometricDisable = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user?.userId;
    const { credentialId } = req.body;

    if (!userId) throw new UnAuthenticatedError("Unauthorized");
    if (!credentialId) throw new BadRequestError("credentialId is required");

    const deleted = await BiometricCredentialModel.deleteOne({
      userId,
      credentialId,
    });

    if (!deleted.deletedCount) {
      throw new BadRequestError("Credential not found");
    }

    // If that was the user's last device, flip the account flag off so
    // login/start doesn't report biometrics as available with zero credentials.
    const remaining = await BiometricCredentialModel.countDocuments({
      userId,
      isActive: true,
    });
    if (remaining === 0) {
      await UserModel.findByIdAndUpdate(userId, { biometricEnabled: false });
    }

    res.status(httpStatusCodes.OK).json({
      isSuccess: true,
      message: "Biometric disabled for this device",
    });
  } catch (error) {
    next(error);
  }
};

export {
  biometricRegisterStart,
  biometricRegisterVerify,
  biometricLoginStart,
  biometricLoginVerify,
  biometricDisable,
};
