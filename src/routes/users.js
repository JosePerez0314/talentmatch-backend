import express from "express";
import { catchAsync } from "../lib/catchAsync.js";
import { createUser, loginUser } from "../controllers/usersController.js";
import { validate } from "../middlewares/validation/validateMiddleware.js"
import { createUserSchema, loginSchema } from "../validations/userValidation.js";
import { identifyUserDemo } from "../middlewares/auth/demoTrialMiddleware.js";

const router = express.Router();

router.post('/', validate(createUserSchema), catchAsync(createUser));

router.post('/login', validate(loginSchema), catchAsync(identifyUserDemo), catchAsync(loginUser));

export default router;