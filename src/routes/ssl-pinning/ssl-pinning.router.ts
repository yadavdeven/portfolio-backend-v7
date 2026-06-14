import express, { Router } from "express";
import { echoRequest } from "./ssl-pinning.controller";

const sslPinningRouter: Router = express.Router();

// Echo request back to the caller (useful for SSL pinning verification)
sslPinningRouter.post("/echo-request", echoRequest);

export default sslPinningRouter;
