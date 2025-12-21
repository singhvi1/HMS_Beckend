import { Router } from "express";
import { auth } from "../middlewares/auth.js";
import { authorizeRoles } from "../middlewares/role.auth.js";
import {
  createLeaveRequest,
  getAllLeaveRequests,
  getLeaveRequest,
  updateLeaveRequestStatus,
  deleteLeaveRequest
} from "../controllers/leave_request.controller.js";

const router = Router();

// Create leave request (student only)
router.post("/", auth, authorizeRoles("student"), createLeaveRequest);

// Get all leave requests
router.get("/", auth, getAllLeaveRequests);

// Get single leave request
router.get("/:id", auth, getLeaveRequest);

// Update leave request status (admin/staff only)
router.patch("/:id/status", auth, authorizeRoles("admin", "staff"), updateLeaveRequestStatus);

// Delete leave request
router.delete("/:id", auth, deleteLeaveRequest);

export default router;

