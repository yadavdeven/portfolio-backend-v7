import { NextFunction, Request, Response } from "express";
import httpStatusCodes from "../../utils/constants/http-status-codes";

const echoRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(httpStatusCodes.OK).json({
      isSuccess: true,
      message: "Echo successful",
      responseData: {
        query: req.query,
        body: req.body,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

export { echoRequest };
