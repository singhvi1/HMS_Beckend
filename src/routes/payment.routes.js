import { Router } from "express";
import { auth } from "../middlewares/auth.js";
import { authorizeRoles } from "../middlewares/role.auth.js";
import {
  createPayment,
  getAllPayments,
  getPayment,
  getPaymentStats,
  updatePayment,
  deletePayment
} from "../controllers/payment.controller.js";

const router = Router();

// Create payment record
router.post("/", auth, createPayment);

// Get all payments
router.get("/", auth, getAllPayments);

// Get payment statistics (admin/staff only)
router.get("/stats", auth, authorizeRoles("admin", "staff"), getPaymentStats);

// Get single payment
router.get("/:id", auth, getPayment);

// Update payment (admin/staff only)
router.patch("/:id", auth, authorizeRoles("admin", "staff"), updatePayment);

// Delete payment (admin only)
router.delete("/:id", auth, authorizeRoles("admin"), deletePayment);

export default router;

