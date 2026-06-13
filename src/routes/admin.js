import express from "express";
import { authMiddleware } from "../middlewares/auth/auth.middleware.js";
import { requireRole } from "../middlewares/auth/roleMiddleware.js";
import { catchAsync } from "../lib/catchAsync.js";
import { validate } from "../middlewares/validation/validate.middleware.js";
import {
    getStats,
    getAllUsers,
    deleteUser,
    updateUserRole
} from "../controllers/adminController.js";
import { deleteUserSchema, updateUserRoleSchema } from "../validations/adminValidation.js";

const router = express.Router();

router.use(authMiddleware);
router.use(requireRole(["ADMIN"]));

// system stats
router.get("/stats", catchAsync(getStats))

// user management
router.get("/users", catchAsync(getAllUsers));
router.put("/users/:id/role", validate(updateUserRoleSchema), catchAsync(updateUserRole));
router.delete("/users/:id", validate(deleteUserSchema), catchAsync(deleteUser));

export default router;
