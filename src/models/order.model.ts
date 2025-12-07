import OrderModel from "./order.mongo";
import { Types } from "mongoose";

export type GetOrdersParams = {
  userId: string;
  skip: number;
  numberOfRecords: number;
  fromDate?: Date | null;
  toDate?: Date | null;
  productName?: string;
  orderId?: string;
};

export type GetOrdersCountParams = Omit<
  GetOrdersParams,
  "skip" | "numberOfRecords"
>;

function buildQuery(params: GetOrdersCountParams): Record<string, any> {
  const { userId, fromDate, toDate, productName, orderId } = params;

  const query: Record<string, any> = {
    userId: new Types.ObjectId(userId), // ✅ IMPORTANT FIX
  };

  // Date range filter using orderDate (correct field)
  if (fromDate || toDate) {
    query.orderDate = {};
    if (fromDate) query.orderDate.$gte = fromDate;
    if (toDate) query.orderDate.$lte = toDate;
  }

  if (orderId) {
    query.orderId = { $regex: orderId, $options: "i" };
  }

  if (productName) {
    query.productName = { $regex: productName, $options: "i" };
  }

  return query;
}

export async function getOrdersFromDB(params: GetOrdersParams): Promise<any[]> {
  const { skip, numberOfRecords, ...rest } = params;

  const query = buildQuery(rest);

  console.log("query: ", query);

  const orders = await OrderModel.find(query)
    .sort({ orderDate: -1 }) // ✅ FIX: correct sort field
    .skip(skip)
    .limit(numberOfRecords)
    .lean();

  return orders;
}

export async function getOrdersCountFromDB(
  params: GetOrdersCountParams
): Promise<number> {
  const query = buildQuery(params);
  const totalCount = await OrderModel.countDocuments(query);
  return totalCount;
}
