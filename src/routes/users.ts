import express from "express";
import { catchAsync } from "../lib/catchAsync.js";
import { createUser, loginUser } from "../controllers/users.controller.js";
import { validate } from "../middlewares/validation/validate.middleware.js"
import { createUserSchema, loginSchema } from "../validations/user.validation.js";

const router = express.Router();

router.post('/', validate(createUserSchema), catchAsync(createUser));

router.post('/login', validate(loginSchema), catchAsync(loginUser));

export default router;