import httpStatusCodes from "../constants/http-status-codes";
import textConstants from "../constants/text-constants";

class AppError extends Error {
  statusCode: number;
  constructor(
    message: string = textConstants.SOMETHING_WENT_WRONG,
    statusCode: number = httpStatusCodes.INTERNAL_SERVER_ERROR
  ) {
    super(message);
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
