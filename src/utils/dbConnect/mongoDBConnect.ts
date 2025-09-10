import mongoose from "mongoose";
import { retrieveEnvVariables } from "../helper-functions/retrieveENVVariables";

mongoose.connection.once("open", () => {
  console.log(`✅ Connected to MongoDB in ${process.env.NODE_ENV} environment`);
});

mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB connection error:", err);
});

let isConnected = false; // For Lambda connection reuse
let cachedUri: string | null = null; // Cache SSM result

async function getMongoDBUri(uri?: string): Promise<string> {
  if (uri) return uri; // explicit override
  if (cachedUri) return cachedUri; // reuse if already fetched

  if (process.env.MONGO_URI) {
    cachedUri = process.env.MONGO_URI;
    return cachedUri;
  }

  if (!process.env.MONGO_URI_PARAM) {
    throw new Error("MONGO_URI_PARAM is not defined in environment variables");
  }

  // Fetch from SSM SecureString
  const params = await retrieveEnvVariables(process.env.NODE_ENV || "dev", [
    { key: "MONGO_URI", secure: true },
  ]);
  cachedUri = params.MONGO_URI;
  return cachedUri;
}

async function connectMongoDB(uri?: string) {
  if (isConnected && mongoose.connection.readyState === 1) {
    console.log("🔄 Reusing existing MongoDB connection");
    return;
  }

  try {
    const mongoUri = await getMongoDBUri(uri);
    await mongoose.connect(mongoUri);
    isConnected = true;
  } catch (error) {
    console.error("🚨 MongoDB connection error:", error);
    throw error; // don’t exit in Lambda, just throw
  }
}

export default connectMongoDB;
