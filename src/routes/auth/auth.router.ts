import express, { Router } from "express";
import {
  googleAuth,
  login,
  logout,
  refreshAccessToken,
  register,
} from "./auth.controller";
import {
  biometricDisable,
  biometricLoginStart,
  biometricLoginVerify,
  biometricRegisterStart,
  biometricRegisterVerify,
} from "./biometric.controller";
import authenticate from "../../middlewares/authenticate";

const authRouter: Router = express.Router();

// Auth routes
authRouter.post("/login", login);
authRouter.post("/logout", logout);
authRouter.post("/register", register);
authRouter.post("/refresh-token", refreshAccessToken);

// Google OAuth route
authRouter.post("/google", googleAuth);

//  BIOMETRIC ROUTES

// Enable biometrics (user must be logged in)
authRouter.post(
  "/biometric/register/start",
  authenticate,
  biometricRegisterStart,
);
authRouter.post(
  "/biometric/register/verify",
  authenticate,
  biometricRegisterVerify,
);

// Login via biometrics (no JWT required)
authRouter.post("/biometric/login/start", biometricLoginStart);
authRouter.post("/biometric/login/verify", biometricLoginVerify);
authRouter.post("/biometric/disable", authenticate, biometricDisable);

export default authRouter;
