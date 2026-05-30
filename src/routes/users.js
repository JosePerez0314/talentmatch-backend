import express from "express";
import { catchAsync } from "../lib/catchAsync.ts";
<<<<<<< HEAD
import { createUser, loginUser } from "../controllers/users.controller.js";
import { validate } from "../middlewares/validation/validate.middleware.js"
=======
import { createUser, loginUser } from "../controllers/usersController.js";
import { validate } from "../middlewares/validation/validateMiddleware.js"
>>>>>>> features
import { createUserSchema, loginSchema } from "../validations/userValidation.js";

const router = express.Router();

router.post('/', validate(createUserSchema), catchAsync(createUser));

router.post('/login', validate(loginSchema), catchAsync(loginUser));

export default router;