import UserModel, { IUser } from "./user.mongo";

// Input interface for creating a user
export type AuthProvider = "email" | "google";

export interface IUserCreate {
  name: string;
  email: string;
  mobile?: string;
  password?: string;
  authProvider: AuthProvider;
  guid?: string;
}

// Find user by email (for login)
const findUserByEmail = async (email: string): Promise<IUser | null> => {
  return await UserModel.findOne({ email }).select("+password");
};

// Find user by email or mobile (for register)
const findUserByEmailOrMobile = async (
  email: string,
  mobile: string,
): Promise<IUser | null> => {
  return await UserModel.findOne({ $or: [{ email }, { mobile }] });
};

// Create a user
const createUser = async ({
  name,
  email,
  mobile,
  password,
  authProvider,
  guid,
}: IUserCreate): Promise<IUser> => {
  return await UserModel.create({
    name,
    email,
    mobile,
    password,
    authProvider,
    guid,
  });
};

export { findUserByEmail, findUserByEmailOrMobile, createUser };
