import Issue from "../models/issue.model.js";
import Student from "../models/student_profile.model.js";
import logger from "../utils/logger.js";

// Create issue (student only)
const createIssue = async (req, res) => {
  try {
    const { title, description, category } = req.body;

    // Validation
    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: "Title and description are required"
      });
    }

    if (title.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: "Title must be at least 3 characters long"
      });
    }

    if (description.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: "Description must be at least 10 characters long"
      });
    }

    if (description.trim().length > 500) {
      return res.status(400).json({
        success: false,
        message: "Description must not exceed 500 characters"
      });
    }

    // Validate category
    const validCategories = ["drinking-water", "plumbing", "furniture", "electricity", "other"];
    if (category && !validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Category must be one of: ${validCategories.join(", ")}`
      });
    }

    // Check if student profile exists (optimized - single DB call)
    const student = await Student.findOne({ user_id: req.user._id });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found. Please create your profile first"
      });
    }

    // Create issue
    const issue = await Issue.create({
      title: title.trim(),
      description: description.trim(),
      category: category || "other",
      raised_by: student._id
    });

    // Populate student details (optimized - single populate call)
    await issue.populate({
      path: "raised_by",
      select: "sid branch room_number block",
      populate: {
        path: "user_id",
        select: "full_name email phone"
      }
    });

    return res.status(201).json({
      success: true,
      issue,
      message: "Issue created successfully"
    });

  } catch (error) {
    logger.error("CREATE ISSUE", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create issue"
    });
  }
};

// Get all issues
const getAllIssues = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, category, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    const query = {};

    // Students can only see their own issues
    if (req.user.role === "student") {
      const student = await Student.findOne({ user_id: req.user._id });
      if (!student) {
        return res.status(404).json({
          success: false,
          message: "Student profile not found"
        });
      }
      query.raised_by = student._id;
    }

    if (status && ["pending", "resolved"].includes(status)) {
      query.status = status;
    }

    if (category && ["drinking-water", "plumbing", "furniture", "electricity", "other"].includes(category)) {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { title: new RegExp(search, "i") },
        { description: new RegExp(search, "i") }
      ];
    }

    // Optimized: Get issues with populated student data in single query
    const issues = await Issue.find(query)
      .populate({
        path: "raised_by",
        select: "sid branch room_number block",
        populate: {
          path: "user_id",
          select: "full_name email phone"
        }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Issue.countDocuments(query);

    return res.status(200).json({
      success: true,
      issues,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      message: "Issues fetched successfully"
    });

  } catch (error) {
    logger.error("GET ALL ISSUES", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch issues"
    });
  }
};

// Get single issue
const getIssue = async (req, res) => {
  try {
    const { id } = req.params;

    const issue = await Issue.findById(id)
      .populate({
        path: "raised_by",
        select: "sid branch room_number block",
        populate: {
          path: "user_id",
          select: "full_name email phone"
        }
      });

    if (!issue) {
      return res.status(404).json({
        success: false,
        message: "Issue not found"
      });
    }

    // Check access: students can only see their own issues
    if (req.user.role === "student") {
      const student = await Student.findOne({ user_id: req.user._id });
      if (!student || issue.raised_by._id.toString() !== student._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Access denied"
        });
      }
    }

    return res.status(200).json({
      success: true,
      issue,
      message: "Issue fetched successfully"
    });

  } catch (error) {
    logger.error("GET ISSUE", error);
    
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid issue ID"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to fetch issue"
    });
  }
};

// Update issue status (admin/staff only)
const updateIssueStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validation
    if (!status || !["pending", "resolved"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be either 'pending' or 'resolved'"
      });
    }

    const issue = await Issue.findById(id);

    if (!issue) {
      return res.status(404).json({
        success: false,
        message: "Issue not found"
      });
    }

    // Update status
    issue.status = status;
    await issue.save();

    // Populate data for response
    await issue.populate({
      path: "raised_by",
      select: "sid branch room_number block",
      populate: {
        path: "user_id",
        select: "full_name email phone"
      }
    });

    return res.status(200).json({
      success: true,
      issue,
      message: `Issue ${status} successfully`
    });

  } catch (error) {
    logger.error("UPDATE ISSUE STATUS", error);
    
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid issue ID"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update issue status"
    });
  }
};

// Update issue (student can update own pending issues)
const updateIssue = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, category } = req.body;

    const issue = await Issue.findById(id);

    if (!issue) {
      return res.status(404).json({
        success: false,
        message: "Issue not found"
      });
    }

    // Check access
    if (req.user.role === "student") {
      const student = await Student.findOne({ user_id: req.user._id });
      if (!student || issue.raised_by.toString() !== student._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only update your own issues"
        });
      }

      // Students can only update pending issues
      if (issue.status !== "pending") {
        return res.status(400).json({
          success: false,
          message: "You can only update pending issues"
        });
      }
    }

    // Update fields
    if (title) {
      if (title.trim().length < 3) {
        return res.status(400).json({
          success: false,
          message: "Title must be at least 3 characters long"
        });
      }
      issue.title = title.trim();
    }

    if (description) {
      if (description.trim().length < 10) {
        return res.status(400).json({
          success: false,
          message: "Description must be at least 10 characters long"
        });
      }
      if (description.trim().length > 500) {
        return res.status(400).json({
          success: false,
          message: "Description must not exceed 500 characters"
        });
      }
      issue.description = description.trim();
    }

    if (category) {
      const validCategories = ["drinking-water", "plumbing", "furniture", "electricity", "other"];
      if (!validCategories.includes(category)) {
        return res.status(400).json({
          success: false,
          message: `Category must be one of: ${validCategories.join(", ")}`
        });
      }
      issue.category = category;
    }

    await issue.save();
    await issue.populate({
      path: "raised_by",
      select: "sid branch room_number block",
      populate: {
        path: "user_id",
        select: "full_name email phone"
      }
    });

    return res.status(200).json({
      success: true,
      issue,
      message: "Issue updated successfully"
    });

  } catch (error) {
    logger.error("UPDATE ISSUE", error);
    
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid issue ID"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update issue"
    });
  }
};

// Delete issue (student can delete own pending issues, admin/staff can delete any)
const deleteIssue = async (req, res) => {
  try {
    const { id } = req.params;

    const issue = await Issue.findById(id);

    if (!issue) {
      return res.status(404).json({
        success: false,
        message: "Issue not found"
      });
    }

    // Check access
    if (req.user.role === "student") {
      const student = await Student.findOne({ user_id: req.user._id });
      if (!student || issue.raised_by.toString() !== student._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Access denied"
        });
      }

      // Students can only delete pending issues
      if (issue.status !== "pending") {
        return res.status(400).json({
          success: false,
          message: "You can only delete pending issues"
        });
      }
    }

    await Issue.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Issue deleted successfully"
    });

  } catch (error) {
    logger.error("DELETE ISSUE", error);
    
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid issue ID"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to delete issue"
    });
  }
};

export {
  createIssue,
  getAllIssues,
  getIssue,
  updateIssueStatus,
  updateIssue,
  deleteIssue
};

