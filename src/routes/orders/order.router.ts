import express, { Router } from "express";
import { fetchOrdersByUserId } from "./order.controller";

const orderRouter: Router = express.Router();

orderRouter.post("/by-user", fetchOrdersByUserId);

export default orderRouter;
