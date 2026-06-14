import UserModel, { IUser } from "./user.mongo";

// Input interface for creating a user
export type AuthProvider = "email" | "google";

export interface IUserCreate {
  name: string;
  email: string;
  mobile?: string;
  password?: string;
  authProvider: AuthProvider;
  firebaseUid?: string;
  guid?: string;
}

// Find user by email (for login)
const findUserByEmail = async (email: string): Promise<IUser | null> => {
  return await UserModel.findOne({ email }).select("+password");
};

// Find user by their Firebase UID (preferred lookup for Google sign-in)
const findUserByFirebaseUid = async (
  firebaseUid: string,
): Promise<IUser | null> => {
  return await UserModel.findOne({ firebaseUid });
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
  firebaseUid,
  guid,
}: IUserCreate): Promise<IUser> => {
  return await UserModel.create({
    name,
    email,
    mobile,
    password,
    authProvider,
    firebaseUid,
    guid,
  });
};

export {
  findUserByEmail,
  findUserByEmailOrMobile,
  findUserByFirebaseUid,
  createUser,
};
