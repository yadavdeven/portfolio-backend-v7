import mongoose, { Document, Schema } from "mongoose";
import jwt, { SignOptions } from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import validator from "validator";
import bcrypt from "bcryptjs";
import { loadConfig } from "../utils/helper-functions/configLoader";

export interface IUser extends Document {
  name: string;
  email: string;
  mobile: string;
  password: string;
  guid?: string;
  createdAt: Date;
  updatedAt: Date;
  createJWT: () => string;
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
      select: false, // Do not return password in queries by default
    },
    guid: {
      type: String,
      unique: true,
      default: uuidv4,
    },
  },
  {
    timestamps: {
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
  }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.createJWT = async function (): Promise<string> {
  let secret;
  if (process.env.AWS_EXECUTION_ENV === undefined) {
    secret = process.env.JWT_SECRET;
  } else {
    const envName = process.env.NODE_ENV || "dev";
    const config = await loadConfig(envName);
    secret = config.jwtSecret;
  }
  if (!secret || typeof secret !== "string") {
    throw new Error(
      "JWT_SECRET is not defined or invalid in environment variables"
    );
  }
  const options: SignOptions = {
    expiresIn: parseInt(process.env.JWT_EXPIRES_IN || "600", 10),
  };
  return jwt.sign({ userId: this._id }, secret, options);
};

userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

const UserModel = mongoose.model<IUser>("User", userSchema);
export default UserModel;
