import express from "express";
import prisma from "../lib/prisma.js";
import bcrypt from "bcrypt"
import { sendResponseOr404 } from "../lib/responseHandler.js"
import { catchAsync } from "../lib/catchAsync.js";
import { createUser, loginUser } from "../controllers/usersController.js";

const router = express.Router();

router.post('/', catchAsync(async (req, res, next) => {
    createUser(req, res, next);
}));

router.post('/login', catchAsync(async (req, res, next) => {
    loginUser(req, res, next);
}));

export default router;