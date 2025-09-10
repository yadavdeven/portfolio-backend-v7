import connectToMongoDB from "./utils/dbConnect/mongoDBConnect";
import serverlessExpress from "@codegenie/serverless-express";
import app from "./app";

// Locally: load .env.{dev|prod}
if (process.env.AWS_EXECUTION_ENV === undefined) {
  console.log("Loading local .env file");
  const dotenv = require("dotenv");
  dotenv.config({ path: `.env.${process.env.NODE_ENV || "dev"}` });
}

let cachedHandler: any;

export const handler = async (event: any, context: any) => {
  if (!cachedHandler) {
    // Connect to MongoDB (internally resolves MONGO_URI from .env or SSM SecureString)
    await connectToMongoDB();
    console.log("✅ Connected to MongoDB");

    // Wrap express app AFTER setup
    cachedHandler = serverlessExpress({ app });
  }

  return cachedHandler(event, context);
};
