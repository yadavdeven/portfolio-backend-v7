import { loadConfig } from "./utils/helper-functions/configLoader";
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
    const envName = process.env.NODE_ENV || "dev";
    const config = await loadConfig(envName);

    await connectToMongoDB(config.mongoUri);
    console.log("Connected to MongoDB");

    // Wrap express app AFTER setup
    cachedHandler = serverlessExpress({ app });
  }

  return cachedHandler(event, context);
};
