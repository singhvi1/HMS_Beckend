import IssueComment from "../models/issue_comment.model.js";
import Issue from "../models/issue.model.js";
import Student from "../models/student_profile.model.js";
import logger from "../utils/logger.js";

// Create comment on issue
const createComment = async (req, res) => {
  try {
    const { issue_id, comment_text } = req.body;

    // Validation
    if (!issue_id || !comment_text) {
      return res.status(400).json({
        success: false,
        message: "Issue ID and comment text are required"
      });
    }

    if (comment_text.trim().length < 1) {
      return res.status(400).json({
        success: false,
        message: "Comment text cannot be empty"
      });
    }

    if (comment_text.trim().length > 500) {
      return res.status(400).json({
        success: false,
        message: "Comment must not exceed 500 characters"
      });
    }

    // Check if issue exists (optimized - single DB call)
    const issue = await Issue.findById(issue_id);
    if (!issue) {
      return res.status(404).json({
        success: false,
        message: "Issue not found"
      });
    }

    // Create comment
    const comment = await IssueComment.create({
      issue_id,
      comment_text: comment_text.trim(),
      commented_by: req.user._id
    });

    // Populate user details (optimized - single populate call)
    await comment.populate("commented_by", "full_name email role");

    return res.status(201).json({
      success: true,
      comment,
      message: "Comment created successfully"
    });

  } catch (error) {
    logger.error("CREATE COMMENT", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid issue ID"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create comment"
    });
  }
};

// Get all comments for an issue as /:issue_id
const getIssueComments = async (req, res) => {
  try {
    const { issue_id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Check if issue exists
    const issue = await Issue.findById(issue_id);
    if (!issue) {
      return res.status(404).json({
        success: false,
        message: "Issue not found"
      });
    }

    // Check access: students can only see comments on their own issues
    if (req.user.role === "student") {
      if (!user.student || issue.raised_by.toString() !== req.user.student._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Access denied"
        });
      }
    }

    // Optimized: Get comments with populated user data in single query
    const comments = await IssueComment.find({ issue_id })
      .populate("commented_by", "full_name email role")
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await IssueComment.countDocuments({ issue_id });

    return res.status(200).json({
      success: true,
      comments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      message: "Comments fetched successfully"
    });

  } catch (error) {
    logger.error("GET ISSUE COMMENTS", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid issue ID"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to fetch comments"
    });
  }
};

// Get single comment as comment._id
const getComment = async (req, res) => {
  try {
    const { id } = req.params;

    const comment = await IssueComment.findById(id)
      .populate("commented_by", "full_name email role")
      .populate("issue_id", "title status raised_by");

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found"
      });
    }

    // Check access: students can only see comments on their own issues

    /*if (req.user.role === "student") {
      const issue = await Issue.findById(comment.issue_id._id);
      const student = await Student.findOne({ user_id: req.user._id });
      if (!student || issue.raised_by.toString() !== student._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Access denied"
        });
      }
    }*/

    if (req.user.role === "student") {
      if (!req.user.student || comment.issue_id.raised_by.toString() !== req.user.student._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Access denied to other student comments"
        })
      }
    }



    return res.status(200).json({
      success: true,
      comment,
      message: "Comment fetched successfully"
    });

  } catch (error) {
    logger.error("GET COMMENT", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid comment ID"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to fetch comment"
    });
  }
};

// Update comment (only by creator or admin/staff)
const updateComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment_text } = req.body;

    if (!comment_text) {
      return res.status(400).json({
        success: false,
        message: "Comment text is required"
      });
    }

    // if (comment_text.trim().length < 1) {
    if (!comment_text) {
      return res.status(400).json({
        success: false,
        message: "Comment text cannot be empty"
      });
    }

    if (comment_text.trim().length > 500) {
      return res.status(400).json({
        success: false,
        message: "Comment must not exceed 500 characters"
      });
    }

    const comment = await IssueComment.findById(id);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found"
      });
    }

    // Check access: only creator or admin/staff can update
    /*if (comment.commented_by.toString() !== req.user._id.toString() &&
      req.user.role !== "admin" && req.user.role !== "staff") {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only update your own comments"
      });
    }*/

    // Authorization
    const isOwner =
      comment.commented_by.toString() === req.user._id.toString();

    const isPrivileged =
      req.user.role === "admin" || req.user.role === "staff";
    //only adin can edit anyone other comments on issues;
    if (!isOwner && !isPrivileged) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only update your own comments"
      });
    }

    // Update comment
    comment.comment_text = comment_text.trim();
    await comment.save();
    await comment.populate("commented_by", "full_name email role");

    return res.status(200).json({
      success: true,
      comment,
      message: "Comment updated successfully"
    });

  } catch (error) {
    logger.error("UPDATE COMMENT", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid comment ID"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update comment"
    });
  }
};

// Delete comment (only by creator or admin/staff)
const deleteComment = async (req, res) => {
  try {
    const { id } = req.params;

    const comment = await IssueComment.findById(id);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found"
      });
    }

    // Check access: only creator or admin/staff can delete
    // Authorization
    const isOwner =
      comment.commented_by.toString() === req.user._id.toString();

    const isPrivileged =
      req.user.role === "admin" || req.user.role === "staff";

    if (!isOwner && !isPrivileged) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only de your own comments"
      });
    }

    // await IssueComment.findByIdAndDelete(id);
      await comment.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Comment deleted successfully"
    });

  } catch (error) {
    logger.error("DELETE COMMENT", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid comment ID"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to delete comment"
    });
  }
};

export {
  createComment,
  getIssueComments,
  getComment,
  updateComment,
  deleteComment
};

