import Student from "../models/student_profile.model.js";
import User from "../models/user.model.js";
import logger from "../utils/logger.js";

// Create student profile
const createStudentProfile = async (req, res) => {
  try {
    const {
      studentUser_id,
      sid,
      permanent_address,
      guardian_name,
      guardian_contact,
      branch,
      room_number,
      block
    } = req.body;


    // Validation
    if (!sid || !permanent_address || !guardian_contact || !branch || !room_number || !block) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided"
      });
    }

    // Validate SID format
    if (sid.length !== 8 || !/^\d+$/.test(sid)) {
      return res.status(400).json({
        success: false,
        message: "Student ID must be exactly 8 digits"
      });
    }

    // Validate guardian contact
    if (guardian_contact.toString().length !== 10 || !/^\d+$/.test(guardian_contact.toString())) {
      return res.status(400).json({
        success: false,
        message: "Guardian contact must be 10 digits"
      });
    }

    const user = req.user;

    if (user.role !== "admin") {
      return res.status(400).json({
        success: false,
        message: "User must have admin role"
      });
    }

    // Check if student profile already exists
    const existingProfile = await Student.findOne({
      $or: [{ user_id: studentUser_id }, { sid }]
    });

    if (existingProfile) {
      return res.status(409).json({
        success: false,
        message: existingProfile.user_id.toString() === studentUser_id

          ? "Student profile already exists for this user"
          : "Student ID already exists"
      });
    }

    // Create student profile
    const student = await Student.create({
      user_id: studentUser_id,
      sid,
      permanent_address: permanent_address.trim(),
      guardian_name: guardian_name?.trim(),
      guardian_contact,
      branch: branch.trim(),
      room_number,
      block: block.toLowerCase().trim()
    });

    // Populate user details in response (optimized - single populate call)
    await student.populate("user_id", "full_name email phone role");

    return res.status(201).json({
      success: true,
      student,
      message: "Student profile created successfully"
    });

  } catch (error) {
    logger.error("CREATE STUDENT PROFILE", error);

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(409).json({
        success: false,
        message: `Student with this ${field} already exists`
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create student profile"
    });
  }
};

// Get student profile by user ID
const getStudentProfile = async (req, res) => {
  try {
    // const user_id = req.user._id
    console.log("DEBUG req.user:", req.user);
    //if req.user.role-> student -> /:id -> req.user._id
    //if req.user.role-> admin/staff -> /:id -> req.params
    let targetUserId = req.params.user_id || req.user._id;
    console.log(targetUserId)
    console.log("Target user id check ")

    /*if (req.user.role === "student") {
      targetUserId = req.user._id;

    } else if (req.user.role === "admin" || req.user.role === "staff") {
      targetUserId = req.params.user_id || req.user._id;  //?if we want to show staff profile too
    } else {

      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }*/


    const student = await Student.findOne({ user_id: targetUserId })
      .populate("user_id", "full_name email phone role status");

    //? we need to add staff too if we need 
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found"
      });
    }

    return res.status(200).json({
      success: true,
      student,
      message: "Student profile fetched successfully"
    });

  } catch (error) {
    logger.error("GET STUDENT PROFILE", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch student profile"
    });
  }
};

// Get all students (admin/staff only)
const getAllStudents = async (req, res) => {
  try {
    const { page = 1, limit = 10, block, branch, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    const query = {};
    if (block) query.block = block.toLowerCase();
    if (branch) query.branch = new RegExp(branch, "i");

    // Search by name, email, or SID (optimized - single aggregation query)
    if (search) {
      // First, get matching students by SID
      const sidMatches = await Student.find({ sid: new RegExp(search, "i") }).select("user_id");
      const sidUserIds = sidMatches.map(s => s.user_id);

      // Then get matching users by name/email
      const userMatches = await User.find({
        $or: [
          { full_name: new RegExp(search, "i") },
          { email: new RegExp(search, "i") }
        ],
        role: "student"
      }).select("_id");

      const userIds = userMatches.map(u => u._id);

      // Combine both results
      const allUserIds = [...new Set([...userIds, ...sidUserIds].map(id => id.toString()))];
      query.user_id = { $in: allUserIds };
    }

    // Optimized: Get students with populated user data in single query
    const students = await Student.find(query)
      .populate("user_id", "full_name email phone role status")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Student.countDocuments(query);

    return res.status(200).json({
      success: true,
      students,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      message: "Students fetched successfully"
    });

  } catch (error) {
    logger.error("GET ALL STUDENTS", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch students"
    });
  }
};

// Update student profile by student(some) and admin(all);
const updateStudentProfile = async (req, res) => {
  try {
    const { user_id } = req.params;

    const {
      permanent_address,
      guardian_name,
      guardian_contact,
      branch,
      room_number,
      block
    } = req.body;


    const student = await Student.findOne({ user_id });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found"
      });
    }


    const isAdminRoute = req.originalUrl.includes("/edit");
    const isAdminUser = ["admin", "staff"].includes(req.user.role);

    //means if login student doest not match with /:user_id
    if (!isAdminRoute && req.user._id.toString() != user_id) {
      return res.status(403).json({
        success: false,
        message: "You can update only your own profile"
      });
    }

    if (isAdminRoute && !isAdminUser) {
      return res.status(403).json({
        success: false,
        message: "Admin privileges required"
      });
    }



    const allowedFields = isAdminRoute
      ? [
        "permanent_address",
        "guardian_name",
        "guardian_contact",
        "branch",
        "room_number",
        "block"
      ]
      : [
        "permanent_address",
        "guardian_name",
      ];

    const hasRealChange = allowedFields.some(field => {
      if (req.body[field] === undefined) return false;
      const newValue =
        typeof req.body[field] === "string"
          ? req.body[field].trim()
          : req.body[field];
      return newValue != student[field];
    });

    if (!hasRealChange) {
      return res.status(400).json({
        success: false,
        message: "No changes detected"
      });
    }


    // Validate guardian contact if provided
    if (isAdminRoute && guardian_contact !== undefined && (guardian_contact.toString().length !== 10 ||
      !/^\d+$/.test(guardian_contact.toString()))) {

      return res.status(400).json({
        success: false,
        message: "Guardian contact must be 10 digits"
      });
    }

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        student[field] =
          typeof req.body[field] === "string"
            ? req.body[field].trim()
            : req.body[field];
      }
    }

    await student.save();
    await student.populate("user_id", "full_name email phone role status");

    return res.status(200).json({
      success: true,
      student,
      message: "Student profile updated successfully"
    });

  } catch (error) {
    logger.error("UPDATE STUDENT PROFILE", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update student profile"
    });
  }
};

// Delete student profile (admin only)
const deleteStudentProfile = async (req, res) => {
  try {
    const { user_id } = req.paramas;

    const student = await Student.findOneAndDelete({ user_id });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Student profile deleted successfully"
    });

  } catch (error) {
    logger.error("DELETE STUDENT PROFILE", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete student profile"
    });
  }
};

export {
  createStudentProfile,
  getStudentProfile,
  getAllStudents,
  updateStudentProfile,
  deleteStudentProfile
};

