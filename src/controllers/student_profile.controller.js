import Student from "../models/student_profile.model.js";
import User from "../models/user.model.js";
import logger from "../utils/logger.js";
import Room from "../models/room.model.js"
import bcrypt from "bcryptjs";
import mongoose from "mongoose";


export const createUserStudent = async (req, res) => {
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
      roomId = null,
    } = req.body;
    //TODO : romove room_number and block after aggregation pipeline
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "User must have admin role : forbidden "
      });
    }

    if (!full_name || !email || !phone || !password || !sid || !permanent_address || !guardian_name || !guardian_contact || !branch || (!roomId && (!room_number || !block))) {
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

    //? why did we use NUll :-> findOne(( filter, projection, options ))

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


    let room;
    if (roomId) {
      room = await Room.findById(roomId).session(session);
      if (!room) {
        throw new Error("Room not found");
      }
      const studentCount = await Student.countDocuments({
        room_id: room._id
      }).session(session);

      if (studentCount >= room.capacity) {
        throw new Error("Room is already full");
      }
    } else {
      room = await Room.findOne({ block, room_number }).session(session);
      if (room) throw new Error("Duplicate Room exist ");

      const [newRoom] = await Room.create(
        [{
          block: block.toLowerCase(),
          room_number,
          capacity: req.body.capacity ?? 1
        }],
        { session }
      );
      room = newRoom;
    }

    const [student] = await Student.create([{
      user_id: user._id,
      room_id: room._id,
      sid,
      permanent_address: permanent_address.trim(),
      guardian_name: guardian_name?.trim(),
      guardian_contact,
      branch: branch.trim(),
    }], { session });

    await session.commitTransaction();
    await student.populate([
      { path: "user_id", select: "full_name email phone role status" },
      { path: "room_id", select: "block room_number capacity " }
    ]);

    return res.status(201).json({
      success: true,
      data: { user, student },
      message: "Student created successfully"
    });
  } catch (error) {
    await session.abortTransaction();

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
      message: error.message || "Failed to add user"
    });
  } finally {
    session.endSession();
  }

}
export const createStudentProfile = async (req, res) => {
  try {
    const {
      studentUser_id,
      sid,
      permanent_address,
      guardian_name,
      guardian_contact,
      branch,
      room_number,
      block,
      room_id,
    } = req.body;


    if (!sid || !permanent_address || !guardian_contact || !branch || !room_number || !block || !room_id) {
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

    const user = req.user;

    if (user.role !== "admin") {
      return res.status(400).json({
        success: false,
        message: "User must have admin role"
      });
    }

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

    const student = await Student.create({
      user_id: studentUser_id,
      sid,
      permanent_address: permanent_address.trim(),
      guardian_name: guardian_name?.trim(),
      guardian_contact,
      branch: branch.trim(),
      room_number,
      room_id,
      block: block.toLowerCase().trim()
    });

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

export const getStudentProfile = async (req, res) => {
  try {
    let targetUserId = req.params.id || req.user._id;
    const student = await Student.findOne({ user_id: targetUserId })
      .populate([
        { path: "user_id", select: "full_name email phone role status" },
        { path: "room_id", select: "block room_number capacity  " }
      ])


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
//NOTE this is not optimised i need to learn aggregate Pipeline;
export const getAllStudents = async (req, res) => {
  try {
    const { page = 1, limit = 10, block, branch, search, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    //search : name sid block room_number    block branch status 
    // Build query
    const query = {};
    if (block) query.block = block.toLowerCase();
    if (branch) query.branch = new RegExp(branch, "i");
    let filteredUserIds = null;

    if (search) {
      const regex = new RegExp(search, "i");
      const students = await Student.find({ $or: [{ sid: regex }, { room_number: regex }, { block: regex }] })
        .select("user_id");
      const studentList = students.map(s => s.user_id.toString());

      // Then get matching users by name/email
      const userMatches = await User.find({
        $or: [
          { full_name: new RegExp(search, "i") }
        ],
        role: "student"
      }).select("_id");

      const userIds = userMatches.map(u => u._id.toString());

      // Combine both results
      filteredUserIds = new Set([...userIds, ...studentList]);

    }
    if (status) {
      const userStatusList = await User.find({ status: new RegExp(status, "i"), role: "student" }).select("_id");
      const statusIds = userStatusList.map(u => u._id.toString());


      filteredUserIds = filteredUserIds ? new Set([filteredUserIds.filter(id => statusIds.includes(id))])
        : new Set([...statusIds]);
    }
    if (filteredUserIds) {
      query.user_id = { $in: [...filteredUserIds] };
    }

    // Optimized: Get students with populated user data in single query

    const students = await Student.find(query)
      .populate([
        { path: "user_id", select: "full_name email phone role status" },
        { path: "room_id", select: "block room_number capacity  " }
      ])
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
export const updateStudentProfile = async (req, res) => {
  try {
    const { user_id } = req.params;
    const { guardian_contact, } = req.body;


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


    let newRoomId = null;
    if (isAdminRoute && req.body?.block && req.body?.room_number) {
      const room = await Room.findOne({
        block: req.body.block.toLowerCase(),
        room_number: req.body.room_number
      });
      if (!room) {
        return res.status(404).json({
          success: false,
          message: "Room Not Avialable"
        })
      }

      const occupantsCount = await Student.countDocuments({
        room_id: room._id,
        _id: { $ne: student._id }
      });
      if (occupantsCount >= room.capacity) {
        return res.status(400).json({
          success: false,
          message: "Room Fulled or not aviable"
        })
      }
      newRoomId = room._id;
    }


    const allowedFields = isAdminRoute
      ? [
        "permanent_address",
        "guardian_name",
        "guardian_contact",
        "branch",
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
    const hasRoomChange = newRoomId && newRoomId.toString() !== student.room_id?.toString();

    if (!hasRealChange && !hasRoomChange) {
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
    if (newRoomId) {
      student.room_id = newRoomId;
    }

    await student.save();
    await student.populate([
      { path: "user_id", select: "full_name email phone role status" },
      { path: "room_id", select: "block room_number capacity" }
    ]);

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

export const toggleStudentStatus = async (req, res) => {
  try {
    const { user_id } = req.params;

    const user = await User.findById(user_id);

    if (!user) {
      logger.warn("TOGGLE_STUDENT_STATUS: User not found", { user_id });
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (user.role !== "student") {
      return res.status(400).json({
        success: false,
        message: "User is not a student"
      });
    }

    user.status = user.status === "active" ? "inactive" : "active";
    await user.save();

    logger.info("TOGGLE_STUDENT_STATUS: Status updated", {
      user_id,
      status: user.status
    });

    return res.status(200).json({
      success: true,
      message: `Student is now ${user.status}`,
      data: {
        user_id: user._id,
        status: user.status
      }
    });

  } catch (error) {
    logger.error("TOGGLE_STUDENT_STATUS: Error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to toggle student status"
    });
  }
};


export const deleteStudentProfile = async (req, res) => {
  try {
    const { user_id } = req.params;
    console.log(req.params, "this is req.paramas")
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

