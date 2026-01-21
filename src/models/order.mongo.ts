import mongoose, { Schema } from "mongoose";

export enum OrderStatus {
  Processing = "Processing",
  Shipped = "Shipped",
  Delivered = "Delivered",
  Cancelled = "Cancelled",
  Returned = "Returned",
}

export enum PaymentMethod {
  UPI = "UPI",
  CreditCard = "Credit Card",
  DebitCard = "Debit Card",
  NetBanking = "Net Banking",
  COD = "COD",
  Other = "Other",
}

const counterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 1000 },
});

const OrderCounter = mongoose.model("OrderCounter", counterSchema);

/**
 * IOrder interface
 */
export interface IOrder extends Document {
  orderId: string;
  userId: mongoose.Types.ObjectId | string;
  orderDate: Date;
  customerName: string;
  customerMobile: string;
  customerEmail?: string;
  productName: string;
  quantity: number;
  totalAmount: number;
  paymentMethod: PaymentMethod | string;
  currStatus: OrderStatus | string;
  createdAt: Date;
  updatedAt: Date;
}

const orderSchema = new Schema<IOrder>(
  {
    orderId: {
      type: String,
      required: [true, "Order Id is required"],
      unique: true,
      trim: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User Id is required"],
      trim: true,
      index: true,
    },
    orderDate: {
      type: Date,
      required: [true, "Order Date is required"],
      default: Date.now,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    customerMobile: {
      type: String,
      required: true,
      trim: true,
    },
    customerEmail: {
      type: String,
      required: false,
      trim: true,
      lowercase: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMethod: {
      type: String,
      enum: Object.values(PaymentMethod),
      default: PaymentMethod.UPI,
    },
    currStatus: {
      type: String,
      enum: Object.values(OrderStatus),
      default: OrderStatus.Processing,
    },
  },
  { timestamps: true }
);

/**
 * Auto-Increment Order ID: ORD-1001, ORD-1002, ...
 */
orderSchema.pre("save", async function (next) {
  if (this.orderId) return next(); // skip if already set (useful for inserts)

  try {
    const counter = await OrderCounter.findByIdAndUpdate(
      { _id: "orderId" },
      { $inc: { seq: 1 } },
      { upsert: true, new: true }
    );

    this.orderId = `ORD-${counter.seq}`;
    next();
  } catch (err) {
    next(err as mongoose.CallbackError);
  }
});

/**
 * Indexes
 */
orderSchema.index({ userId: 1, orderDate: -1 });
orderSchema.index({ orderId: 1 });

const OrderModel = mongoose.model<IOrder>("Order", orderSchema);

export default OrderModel;
