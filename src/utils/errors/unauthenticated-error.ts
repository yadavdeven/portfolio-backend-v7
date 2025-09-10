import httpStatusCodes from "../constants/http-status-codes";
import AppError from "./app-error";

class UnAuthenticatedError extends AppError {
  constructor(message: string) {
    super(message, httpStatusCodes.UNAUTHORIZED);
  }
}

export default UnAuthenticatedError;
