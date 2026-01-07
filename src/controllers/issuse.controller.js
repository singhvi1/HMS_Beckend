import Issue from "../models/issue.model.js";
import Student from "../models/student_profile.model.js";
import User from "../models/user.model.js";
import logger from "../utils/logger.js";

export const createIssue = async (req, res) => {
  try {
    const { title, description, category } = req.body;

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

    const validCategories = ["drinking-water", "plumbing", "furniture", "electricity", "other"];

    if (category && !validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Category must be one of: ${validCategories.join(", ")}`
      });
    }

    // Check if student profile exists (optimized - single DB call)
    // const student = await Student.findOne({ user_id: req.user._id });


    // if (!student) {
    //   return res.status(404).json({
    //     success: false,
    //     message: "Student profile not found. Please create your profile first"
    //   });
    // }

    // const issue = await Issue.create({
    //   title: title.trim(),
    //   description: description.trim(),
    //   category: category || "other",
    //   raised_by: student._id
    // });
    const issue = await Issue.create({
      title: title.trim(),
      description: description.trim(),
      category: category || "other",
      raised_by: req.studentId
    })


    // await issue.populate({
    //   path: "raised_by",
    //   select: "sid branch room_id user_id ",
    //   populate: [
    //     {
    //       path: "user_id",
    //       select: "full_name email phone role"
    //     },
    //     {
    //       path: "room_id",
    //       select: "room_number block"
    //     }]

    // });


    await issue.populate(
      {
        path: "raised_by",
        select: "sid branch room_id",
        populate: [{
          path: "user_id",
          select: " full_name email status role",
        }, {
          path: "room_id",
          select: "room_number block capacity is_active"
        }]
      })
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

export const getAllIssues = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);

    const { status, category, search, student_search, sid, block, room_number, studentId } = req.query;
    const skip = (page - 1) * limit;
    const query = {};

    if (req.user.role === "student") {
      const student = await Student.findOne({ user_id: req.user._id }).select("_id");

      if (!student) {
        return res.status(404).json({
          success: false,
          message: "Student profile not found"
        });
      }
      query.raised_by = student._id;
    }
    else if (req.user.role === "admin" || req.user.role === "staff") {
      if (studentId) {
        query.raised_by = studentId;
      }
      else if (sid || block || room_number || student_search) {

        const studentQuery = {};

        if (sid?.trim()) {
          studentQuery.sid = new RegExp(`^${sid.trim()}`, "i");
        }

        if (block) {
          studentQuery.block = block.trim().toLowerCase();
        }
        if (room_number) {
          studentQuery.room_number = new RegExp(`^${room_number.trim()}`, "i")
        }
        if (student_search?.trim()) {
          const users = await User.find({
            $or: [
              { full_name: new RegExp(student_search, "i") },
              { email: new RegExp(student_search, "i") }
            ]
          }).select("_id");

          studentQuery.user_id = { $in: users.map(u => u._id) };
        }


        const students = await Student.find(studentQuery).select("_id");
        query.raised_by = { $in: students.map(s => s._id) };
      }

    } else {
      return res.status(403).json({
        success: false,
        message: "Forbidden "
      });
    }



    if (status && ["pending", "in_progress", "resolved"].includes(status)) {
      query.status = status;
    }

    if (
      category &&
      ["drinking-water", "plumbing", "internet", "furniture", "carpentry", "electricity", "other"].includes(category)
    ) {
      query.category = category;
    }


    if (search) {
      const regex = new RegExp(search, "i");
      query.$and = [
        ...(query.$and || []),
        { $or: [{ title: regex }, { description: regex }] }
      ];
    }
    const issues = await Issue.find(query)
      .populate({
        path: "raised_by",
        select: "sid branch guardian_contact guardian_name permanent_address",
        populate: [
          {
            path: "user_id",
            select: "full_name email phone role status"
          }, {
            path: "room_id",
            select: "room_number block"
          }]
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Issue.countDocuments(query);

    return res.status(200).json({
      success: true,
      issues,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
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


export const getIssue = async (req, res) => {
  try {
    const { id } = req.params;

    const issue = await Issue.findById(id)
      .populate({
        path: "raised_by",
        select: "sid branch guardian_contact guardian_name permanent_address",
        populate: [
          {
            path: "user_id",
            select: "full_name email phone role status"
          }, {
            path: "room_id",
            select: "room_number block"
          }]
      });

    if (!issue) {
      return res.status(404).json({
        success: false,
        message: "Issue not found"
      });
    }

    if (req.user.role === "student") {
      if (issue.raised_by._id.toString() !== req.studentId.toString()) {
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

export const updateIssueStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !["pending", "resolved", "in_progress"].includes(status)) {
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

    issue.status = status;
    await issue.save();

    await issue.populate({
      path: "raised_by",
      select: "sid branch guardian_contact guardian_name permanent_address",
      populate: [
        {
          path: "user_id",
          select: "full_name email phone role status"
        }, {
          path: "room_id",
          select: "room_number block"
        }]
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
export const updateIssue = async (req, res) => {
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
      if (issue.raised_by.toString() !== req.studentId.toString()) {
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
export const deleteIssue = async (req, res) => {
  try {
    const { id } = req.params;

    const issue = await Issue.findById(id);

    if (!issue) {
      return res.status(404).json({
        success: false,
        message: "Issue not found"
      });
    }


    if (req.user.role === "student") {
      if (issue.raised_by.toString()
        !== req.studentId.toString()) {
        return res.status(403).json({
          success: false,
          message: "Access denied"
        });
      }

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


