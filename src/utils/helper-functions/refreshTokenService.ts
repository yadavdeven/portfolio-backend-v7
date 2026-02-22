import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";

export const generateRefreshToken = () => {
  const token = uuidv4(); // plain token sent to client
  const tokenHash = bcrypt.hashSync(token, 10); // stored in DB

  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  );

  return {
    token, // send to client
    tokenHash, // store in DB
    expiresAt,
  };
};
