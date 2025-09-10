import express, { Router } from "express";
import { login, register } from "./auth.controller";

const authRouter: Router = express.Router();

authRouter.post("/register", register);
authRouter.post("/login", login);

export default authRouter;
