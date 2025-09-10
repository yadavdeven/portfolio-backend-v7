import mongoose from "mongoose";

mongoose.connection.once("open", () => {
  console.log(`✅ Connected to MongoDB in ${process.env.NODE_ENV} environment`);
});

mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB connection error:", err);
});

let isConnected = false; // For Lambda connection reuse

async function getMongoDBUri(uri?: string): Promise<string> {
  if (uri) return uri; // From loadConfig
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not defined in environment variables");
  }
  return process.env.MONGO_URI;
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
