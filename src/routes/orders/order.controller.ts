import { NextFunction, Request, Response } from "express";
import UnAuthenticatedError from "../../utils/errors/unauthenticated-error";
import httpStatusCodes from "../../utils/constants/http-status-codes";
import textConstants from "../../utils/constants/text-constants";
import {
  getOrdersCountFromDB,
  getOrdersFromDB,
} from "../../models/order.model";

const DEFAULT_RECORDS_PER_PAGE = 10;

const fetchOrdersByUserId = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId)
      throw new UnAuthenticatedError(textConstants.AUTHENTICATION_FAILED);

    const page = Number(req.body.page) || 1;
    const numberOfRecords =
      Number(req.body.numberOfRecords) || DEFAULT_RECORDS_PER_PAGE;
    const skip = (page - 1) * numberOfRecords;

    const fromDate = req.body.fromDate ? new Date(req.body.fromDate) : null;
    const toDate = req.body.toDate ? new Date(req.body.toDate) : null;
    const productName = req.body.productName
      ? String(req.body.productName).trim()
      : "";
    const orderId = req.body.orderId ? String(req.body.orderId).trim() : "";

    const baseParams = {
      userId,
      fromDate,
      toDate,
      productName,
      orderId,
    };

    // 1) Get paginated data
    const orders = await getOrdersFromDB({
      ...baseParams,
      skip,
      numberOfRecords,
    });

    // 2) Only get total count on page 1
    let totalRecords: number | null = null;
    let totalPages: number | null = null;

    if (page === 1) {
      totalRecords = await getOrdersCountFromDB(baseParams);
      totalPages =
        numberOfRecords > 0 ? Math.ceil(totalRecords / numberOfRecords) : 0;
    }

    const hasMore = orders.length === numberOfRecords; // simple flag for infinite scroll

    res.status(httpStatusCodes.OK).json({
      isSuccess: true,
      message: "Orders fetched successfully",
      responseData: {
        data: orders,
        pagination: {
          page,
          numberOfRecords,
          totalRecords, // null for page > 1
          totalPages, // null for page > 1
          hasMore,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export { fetchOrdersByUserId };
