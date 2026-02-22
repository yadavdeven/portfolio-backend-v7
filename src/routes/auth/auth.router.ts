import express, { Router } from "express";
import {
  googleAuth,
  login,
  logout,
  refreshAccessToken,
  register,
} from "./auth.controller";

const authRouter: Router = express.Router();

authRouter.post("/login", login);
authRouter.post("/logout", logout);
authRouter.post("/register", register);
authRouter.post("/google", googleAuth);
authRouter.post("/refresh-token", refreshAccessToken);

export default authRouter;
