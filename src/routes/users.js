import express from "express";
import { catchAsync } from "../lib/catchAsync.js";
import { createUser, loginUser } from "../controllers/usersController.js";

const router = express.Router();

router.post('/', catchAsync(createUser));

router.post('/login', catchAsync(loginUser));

export default router;