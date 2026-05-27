import express from "express";
import { catchAsync } from "../lib/catchAsync.ts";
import { createUser, loginUser } from "../controllers/users.controller.js";
import { validate } from "../middlewares/validation/validate.middleware.js"
import { createUserSchema, loginSchema } from "../validations/userValidation.js";
import { identifyUserDemo } from "../middlewares/auth/demoTrialMiddleware.js";

const router = express.Router();

router.post('/', validate(createUserSchema), catchAsync(createUser));

router.post('/login', validate(loginSchema), catchAsync(identifyUserDemo), catchAsync(loginUser));

export default router;