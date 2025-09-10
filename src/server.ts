import { loadConfig } from "./utils/helper-functions/configLoader";
import connectToMongoDB from "./utils/dbConnect/mongoDBConnect";
import app from "./app";
import http from "http";

if (process.env.AWS_EXECUTION_ENV === undefined) {
  const dotenv = require("dotenv");
  dotenv.config({ path: `.env.${process.env.NODE_ENV || "dev"}` });
}

async function startServer() {
  try {
    const envName = process.env.NODE_ENV || "dev";
    const config = await loadConfig(envName);
    await connectToMongoDB(config.mongoUri);
    console.log("Connected to MongoDB");

    const server = http.createServer(app);
    const PORT = process.env.PORT || 5005;
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    server.on("error", (err) => {
      console.error("Server error:", err);
      server.close(() => {
        console.error("Server closed due to error. Exiting process.");
        process.exit(1);
      });
    });
  } catch (error) {
    console.error("Error starting the server:", error);
    process.exit(1);
  }
}

startServer();
