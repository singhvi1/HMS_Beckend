import { Router } from "express";
import { auth } from "../middlewares/auth.js";
import { authorizeRoles } from "../middlewares/role.auth.js";
import {
  createIssue,
  getAllIssues,
  getIssue,
  updateIssueStatus,
  updateIssue,
  deleteIssue
} from "../controllers/issuse.controller.js";

const router = Router();

// Create issue (student only)
router.post("/create", auth, createIssue);

// Get all issues
router.get("/", auth, getAllIssues);

// Get single issue
router.get("/:id", auth, getIssue);

// Update issue status (admin/staff only)
router.patch("/:id/status", auth, authorizeRoles("admin", "staff"), updateIssueStatus);

// Update issue (student can update own pending issues)
router.patch("/:id", auth, updateIssue);

// Delete issue
router.delete("/:id", auth, deleteIssue);

export default router;

