import { Request, Response } from "express";
import httpStatusCodes from "../utils/constants/http-status-codes";

const notFoundMiddleware = (req: Request, res: Response) => {
  res.status(httpStatusCodes.NOT_FOUND).json({ error: "Route does not exist" });
};

export default notFoundMiddleware;
