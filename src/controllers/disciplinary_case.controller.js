import DisciplinaryCase from "../models/disciplinary_case.model.js";
import Student from "../models/student_profile.model.js";
import logger from "../utils/logger.js";

// Create disciplinary case (admin/staff only)
const createDisciplinaryCase = async (req, res) => {
  try {
    const { student_id, reason, fine_amount } = req.body;

    // Validation
    if (!student_id || !reason) {
      return res.status(400).json({
        success: false,
        message: "Student ID and reason are required"
      });
    }

    if (reason.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: "Reason must be at least 10 characters long"
      });
    }

    if (fine_amount !== undefined && fine_amount < 0) {
      return res.status(400).json({
        success: false,
        message: "Fine amount cannot be negative"
      });
    }

    // Check if student exists (optimized - single DB call)
    const student = await Student.findById(student_id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    // Create disciplinary case
    const disciplinaryCase = await DisciplinaryCase.create({
      student_id,
      reason: reason.trim(),
      fine_amount: fine_amount || 0,
      decided_by: req.user._id
    });

    // Populate student and decider details (optimized - nested populate)
    await disciplinaryCase.populate({
      path: "student_id",
      select: "sid branch room_number block",
      populate: {
        path: "user_id",
        select: "full_name email phone"
      }
    });
    await disciplinaryCase.populate("decided_by", "full_name email role");

    return res.status(201).json({
      success: true,
      disciplinaryCase,
      message: "Disciplinary case created successfully"
    });

  } catch (error) {
    logger.error("CREATE DISCIPLINARY CASE", error);
    
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create disciplinary case"
    });
  }
};

// Get all disciplinary cases
const getAllDisciplinaryCases = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, student_id, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    const query = {};

    // Students can only see their own cases
    if (req.user.role === "student") {
      const student = await Student.findOne({ user_id: req.user._id });
      if (!student) {
        return res.status(404).json({
          success: false,
          message: "Student profile not found"
        });
      }
      query.student_id = student._id;
    } else if (student_id) {
      // Admin/staff can filter by student
      const student = await Student.findOne({ user_id: student_id });
      if (student) {
        query.student_id = student._id;
      }
    }

    if (status && ["open", "closed"].includes(status)) {
      query.status = status;
    }

    // Search by reason
    if (search) {
      query.reason = new RegExp(search, "i");
    }

    // Optimized: Get cases with populated data in single query
    const disciplinaryCases = await DisciplinaryCase.find(query)
      .populate({
        path: "student_id",
        select: "sid branch room_number block",
        populate: {
          path: "user_id",
          select: "full_name email phone"
        }
      })
      .populate("decided_by", "full_name email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await DisciplinaryCase.countDocuments(query);

    // Calculate total fine amount for open cases
    const totalFineResult = await DisciplinaryCase.aggregate([
      { $match: { ...query, status: "open" } },
      { $group: { _id: null, total: { $sum: "$fine_amount" } } }
    ]);

    return res.status(200).json({
      success: true,
      disciplinaryCases,
      totalFine: totalFineResult[0]?.total || 0,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      message: "Disciplinary cases fetched successfully"
    });

  } catch (error) {
    logger.error("GET ALL DISCIPLINARY CASES", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch disciplinary cases"
    });
  }
};

// Get single disciplinary case
const getDisciplinaryCase = async (req, res) => {
  try {
    const { id } = req.params;

    const disciplinaryCase = await DisciplinaryCase.findById(id)
      .populate({
        path: "student_id",
        select: "sid branch room_number block",
        populate: {
          path: "user_id",
          select: "full_name email phone"
        }
      })
      .populate("decided_by", "full_name email role");

    if (!disciplinaryCase) {
      return res.status(404).json({
        success: false,
        message: "Disciplinary case not found"
      });
    }

    // Check access: students can only see their own cases
    if (req.user.role === "student") {
      const student = await Student.findOne({ user_id: req.user._id });
      if (!student || disciplinaryCase.student_id._id.toString() !== student._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Access denied"
        });
      }
    }

    return res.status(200).json({
      success: true,
      disciplinaryCase,
      message: "Disciplinary case fetched successfully"
    });

  } catch (error) {
    logger.error("GET DISCIPLINARY CASE", error);
    
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid disciplinary case ID"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to fetch disciplinary case"
    });
  }
};

// Update disciplinary case (admin/staff only)
const updateDisciplinaryCase = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, fine_amount, status } = req.body;

    const disciplinaryCase = await DisciplinaryCase.findById(id);

    if (!disciplinaryCase) {
      return res.status(404).json({
        success: false,
        message: "Disciplinary case not found"
      });
    }

    // Update fields
    if (reason) {
      if (reason.trim().length < 10) {
        return res.status(400).json({
          success: false,
          message: "Reason must be at least 10 characters long"
        });
      }
      disciplinaryCase.reason = reason.trim();
    }

    if (fine_amount !== undefined) {
      if (fine_amount < 0) {
        return res.status(400).json({
          success: false,
          message: "Fine amount cannot be negative"
        });
      }
      disciplinaryCase.fine_amount = fine_amount;
    }

    if (status) {
      if (!["open", "closed"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Status must be either 'open' or 'closed'"
        });
      }
      disciplinaryCase.status = status;
    }

    await disciplinaryCase.save();

    // Populate data for response
    await disciplinaryCase.populate({
      path: "student_id",
      select: "sid branch room_number block",
      populate: {
        path: "user_id",
        select: "full_name email phone"
      }
    });
    await disciplinaryCase.populate("decided_by", "full_name email role");

    return res.status(200).json({
      success: true,
      disciplinaryCase,
      message: "Disciplinary case updated successfully"
    });

  } catch (error) {
    logger.error("UPDATE DISCIPLINARY CASE", error);
    
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid disciplinary case ID"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update disciplinary case"
    });
  }
};

// Delete disciplinary case (admin only)
const deleteDisciplinaryCase = async (req, res) => {
  try {
    const { id } = req.params;

    const disciplinaryCase = await DisciplinaryCase.findByIdAndDelete(id);

    if (!disciplinaryCase) {
      return res.status(404).json({
        success: false,
        message: "Disciplinary case not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Disciplinary case deleted successfully"
    });

  } catch (error) {
    logger.error("DELETE DISCIPLINARY CASE", error);
    
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid disciplinary case ID"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to delete disciplinary case"
    });
  }
};

export {
  createDisciplinaryCase,
  getAllDisciplinaryCases,
  getDisciplinaryCase,
  updateDisciplinaryCase,
  deleteDisciplinaryCase
};

