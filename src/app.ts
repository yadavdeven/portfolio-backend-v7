import express, { Express } from "express";
import api from "./routes/api";
import notFoundMiddleware from "./middlewares/not-found-handler";
import errorHandler from "./middlewares/error-handler";
import helmet from "helmet";
import cors from "cors";

const app: Express = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/v1", api);

app.use(notFoundMiddleware);
app.use(errorHandler);

export default app;
