import Student from "../models/student_profile.model.js";
import User from "../models/user.model.js";
import logger from "../utils/logger.js";
import Room from "../models/room.model.js"
import bcrypt from "bcryptjs";
import mongoose from "mongoose";


const createUserStudent = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const {
      full_name,
      email, phone,
      password,
      role = "student",
      sid,
      permanent_address,
      guardian_name,
      guardian_contact,
      branch,
      room_number,
      block,
    } = req.body;
//TODO : romove room_number and block 
    if (req.user.role !== "admin") {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message: "User must have admin role : forbidden "
      });
    }

    if (!full_name || !email || !phone || !password || !sid || !permanent_address || !guardian_name || !guardian_contact || !branch || !room_number || !block) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided"
      });
    }

    if (sid.length !== 8 || !/^\d+$/.test(sid)) {
      return res.status(400).json({
        success: false,
        message: "Student ID must be exactly 8 digits"
      });
    }

    if (guardian_contact.toString().length !== 10 || !/^\d+$/.test(guardian_contact.toString())) {
      return res.status(400).json({
        success: false,
        message: "Guardian contact must be 10 digits"
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format"
      });
    }

    if (phone.length !== 10 || !/^\d+$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Phone number must be  equal to 10 digits"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long"
      });
    }

    const existingUser = await User.findOne(
      { $or: [{ email }, { phone }] }, null, { session });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: existingUser.email === email
          ? "User with this email already exists"
          : "User with this phone number already exists"
      });
    }
    //NOTE : User.create([{ ... }], { session }) rule:
    //[user] : mean take the first arr[0] => user =arr[0];

    const hashedPassword = await bcrypt.hash(password, 10);
    const [user] = await User.create([{
      full_name: full_name.trim(),
      email: email.toLowerCase().trim(),
      phone,
      password: hashedPassword,
      role: role,
    }], { session });

    //checking room : 
    let roomId = null;
    const room = await Room.findOneAndUpdate(
      {
        block: block.toLowerCase(),
        room_number,
        $expr: { $lt: ["$occupancy", "$capacity"] }
      },
      {
        $inc: { occupancy: 1 }
      },
      {
        new: true,
        session
      }
    );
    if (!room) {
      // Check if room exists but is full
      const existingRoom = await Room.findOne(
        { block: block.toLowerCase(), room_number },
        null,
        { session }
      );

      if (existingRoom) {
        throw new Error("Room is full");
      }

      // Room does NOT exist → create it
      const [newRoom] = await Room.create(
        [
          {
            block: block.toLowerCase(),
            room_number,
            capacity: 3,
            occupancy: 1
          }
        ],
        { session }
      );

      roomId = newRoom._id;
    } else {
      roomId = room._id;
    }

    // Create student profile
    const [student] = await Student.create([{
      user_id: user._id,
      room_id: roomId,
      sid,
      permanent_address: permanent_address.trim(),
      guardian_name: guardian_name?.trim(),
      guardian_contact,
      branch: branch.trim(),
      room_number,
      block: block.toLowerCase().trim()
    }], { session });

    await session.commitTransaction();
    session.endSession();

    await student.populate([
      { path: "user_id", select: "full_name email phone role" },
      { path: "room_id", select: "block room_number capacity  occupancy" }
    ]);

    return res.status(201).json({
      success: true,
      data: { user, student },
      message: "Student created successfully"
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(409).json({
        success: false,
        message: `User with this ${field} already exists`
      });
    }

    logger.error("Failed to add user", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add user"
    });
  }

}

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
  deleteStudentProfile,
  createUserStudent,
};

