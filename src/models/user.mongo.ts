import mongoose, { Document, Schema } from "mongoose";
import { retrieveEnvVariables } from "../utils/helper-functions/retrieveENVVariables";
import jwt, { SignOptions } from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import validator from "validator";
import bcrypt from "bcryptjs";

export type AuthProvider = "email" | "google";

export interface IUser extends Document {
  name: string;
  email: string;
  mobile?: string;
  password?: string;
  authProvider: AuthProvider;
  guid?: string;
  createdAt: Date;
  updatedAt: Date;
  createJWT: () => Promise<string>;
  comparePassword: (candidatePassword: string) => Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: [validator.isEmail, "Invalid email"],
    },
    mobile: {
      type: String,
      unique: true,
      sparse: true,
      validate: [
        validator.isMobilePhone,
        "Please provide a valid mobile number",
      ],
    },
    password: {
      type: String,
      minlength: 6,
      select: false,
      required: function (this: IUser) {
        return this.authProvider === "email";
      },
    },
    authProvider: {
      type: String,
      enum: ["email", "google"],
      required: true,
    },
    guid: {
      type: String,
      unique: true,
      default: uuidv4,
    },
  },
  { timestamps: true },
);

// 🔐 Cache JWT secret & expiry (to avoid multiple SSM calls)
let cachedJwtSecret: string | null = null;
let cachedJwtExpiresIn: string | null = null;

userSchema.pre("save", async function (next) {
  if (!this.password || !this.isModified("password")) {
    return next();
  }

  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.createJWT = async function (): Promise<string> {
  if (!cachedJwtSecret || !cachedJwtExpiresIn) {
    if (process.env.AWS_EXECUTION_ENV === undefined) {
      cachedJwtSecret = process.env.JWT_SECRET || "";
      cachedJwtExpiresIn = process.env.JWT_EXPIRES_IN || "600";
    } else {
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
  candidatePassword: string,
): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

const UserModel = mongoose.model<IUser>("User", userSchema);
export default UserModel;
