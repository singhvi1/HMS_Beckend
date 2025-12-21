import { Router } from "express";
import { auth } from "../middlewares/auth.js";
import {
  createComment,
  getIssueComments,
  getComment,
  updateComment,
  deleteComment
} from "../controllers/issue_comment.controller.js";

const router = Router();

// Create comment on issue
router.post("/", auth, createComment);

// Get all comments for an issue
router.get("/issue/:issue_id", auth, getIssueComments);

// Get single comment
router.get("/:id", auth, getComment);

// Update comment
router.patch("/:id", auth, updateComment);

// Delete comment
router.delete("/:id", auth, deleteComment);

export default router;

