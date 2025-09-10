import httpStatusCodes from "../constants/http-status-codes";
import AppError from "./app-error";

class BadRequestError extends AppError {
  constructor(message: string) {
    super(message, httpStatusCodes.BAD_REQUEST);
  }
}

export default BadRequestError;
