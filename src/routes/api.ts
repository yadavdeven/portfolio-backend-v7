import express, { Response, Router } from "express";
import authRouter from "./auth/auth.router";

const api: Router = express.Router();

api.get("/", (_, res: Response) =>
  res.json({
    message: `Portfolio APIs running in ${process.env.NODE_ENV} environment!`,
  })
);

api.use("/auth", authRouter);

export default api;
