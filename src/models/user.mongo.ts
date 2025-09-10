import mongoose, { Document, Schema } from "mongoose";
import { retrieveEnvVariables } from "../utils/helper-functions/retrieveENVVariables";
import jwt, { SignOptions } from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import validator from "validator";
import bcrypt from "bcryptjs";

export interface IUser extends Document {
  name: string;
  email: string;
  mobile: string;
  password: string;
  guid?: string;
  createdAt: Date;
  updatedAt: Date;
  createJWT: () => Promise<string>;
  comparePassword: (candidatePassword: string) => Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      minlength: [3, "Name must be at least 3 characters long"],
      maxlength: [50, "Name must be at most 50 characters long"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      validate: [validator.isEmail, "Please provide a valid email address"],
    },
    mobile: {
      type: String,
      required: [true, "Mobile number is required"],
      unique: true,
      validate: [
        validator.isMobilePhone,
        "Please provide a valid mobile number",
      ],
    },
    password: {
      type: String,
      required: true,
      minlength: [6, "Password must be at least 6 characters long"],
      select: false,
    },
    guid: {
      type: String,
      unique: true,
      default: uuidv4,
    },
  },
  {
    timestamps: true,
  }
);

// 🔐 Cache JWT secret & expiry (to avoid multiple SSM calls)
let cachedJwtSecret: string | null = null;
let cachedJwtExpiresIn: string | null = null;

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.createJWT = async function (): Promise<string> {
  if (!cachedJwtSecret || !cachedJwtExpiresIn) {
    if (process.env.AWS_EXECUTION_ENV === undefined) {
      // Local dev → .env
      cachedJwtSecret = process.env.JWT_SECRET || "";
      cachedJwtExpiresIn = process.env.JWT_EXPIRES_IN || "600";
    } else {
      // Lambda → fetch from SSM
      const envName = process.env.NODE_ENV || "dev";
      const params = await retrieveEnvVariables(envName, [
        { key: "JWT_SECRET", secure: true },
        { key: "JWT_EXPIRES_IN", secure: false },
      ]);
      cachedJwtSecret = params.JWT_SECRET;
      cachedJwtExpiresIn = params.JWT_EXPIRES_IN;
    }
  }

  if (!cachedJwtSecret) {
    throw new Error("JWT_SECRET is missing from environment or SSM");
  }

  const options: SignOptions = {
    expiresIn: parseInt(cachedJwtExpiresIn || "600", 10),
  };

  return jwt.sign({ userId: this._id }, cachedJwtSecret, options);
};

userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

const UserModel = mongoose.model<IUser>("User", userSchema);
export default UserModel;
