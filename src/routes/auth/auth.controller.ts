import { NextFunction, Request, Response } from "express";
import UnAuthenticatedError from "../../utils/errors/unauthenticated-error";
import {
  isValidEmail,
  isValidMobile,
} from "../../utils/helper-functions/validators";
import BadRequestError from "../../utils/errors/bad-request";
import {
  createUser,
  findUserByEmail,
  findUserByEmailOrMobile,
} from "../../models/user.model";
import httpStatusCodes from "../../utils/constants/http-status-codes";
import { v4 as uuidv4 } from "uuid";

const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      throw new BadRequestError("Email and password are required");

    if (!isValidEmail(email))
      throw new BadRequestError("Please provide a valid email address");

    const user = await findUserByEmail(email);
    if (!user) throw new UnAuthenticatedError("Invalid credentials");

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) throw new UnAuthenticatedError("Invalid credentials");

    const updatedGuid = uuidv4();
    user.guid = updatedGuid;
    await user.save();

    // ✅ await the Promise here
    const token = await user.createJWT();

    res.status(httpStatusCodes.OK).json({
      isSuccess: true,
      message: "Login successful",
      responseData: {
        id: user._id,
        token,
        guid: user.guid,
      },
    });
  } catch (error) {
    next(error);
  }
};

const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, email, mobile, password } = req.body;

    // Validate input
    if (!name || !email || !mobile || !password) {
      throw new BadRequestError(
        "Name, email, mobile, and password are required"
      );
    }
    if (name.length < 3 || name.length > 50) {
      throw new BadRequestError("Name must be between 3 and 50 characters");
    }
    if (!isValidEmail(email)) {
      throw new BadRequestError("Please provide a valid email address");
    }
    if (!isValidMobile(mobile)) {
      throw new BadRequestError("Please provide a valid mobile number");
    }
    if (password.length < 6) {
      throw new BadRequestError("Password must be at least 6 characters long");
    }

    // Check for existing user
    const existingUser = await findUserByEmailOrMobile(email, mobile);
    if (existingUser) {
      if (existingUser.email === email) {
        throw new BadRequestError("Email already in use");
      }
      if (existingUser.mobile === mobile) {
        throw new BadRequestError("Mobile number already in use");
      }
    }

    // Generate new GUID
    const newGuid = uuidv4();

    // Create user with explicit GUID
    const user = await createUser({
      name,
      email,
      mobile,
      password,
      guid: newGuid,
    });

    // ✅ await here too
    const token = await user.createJWT();

    res.status(httpStatusCodes.CREATED).json({
      isSuccess: true,
      message: "Registration successful",
      responseData: {
        id: user._id,
        token,
        guid: user.guid,
      },
    });
  } catch (error) {
    next(error);
  }
};

export { login, register };
