import express, { Response, Router } from "express";
import sslPinningRouter from "./ssl-pinning/ssl-pinning.router";
import authenticate from "../middlewares/authenticate";
import orderRouter from "./orders/order.router";
import authRouter from "./auth/auth.router";

const api: Router = express.Router();

api.get("/", (_, res: Response) => {
  res.json({
    message: `Portfolio APIs running in ${process.env.NODE_ENV} environment!`,
  });
});

api.use("/auth", authRouter);
api.use("/orders", authenticate, orderRouter);
api.use("/ssl-pinning", sslPinningRouter);

export default api;
