import Student from "../models/student_profile.model.js";
import User from "../models/user.model.js";
import logger from "../utils/logger.js";
import Room from "../models/room.model.js"
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import RoomRequest from "../models/roomRequest.model.js";
import Hostel from "../models/hostel.model.js";
import Issue from "../models/issue.model.js";
import IssueComment from "../models/issue_comment.model.js";
import LeaveRequest from "../models/leave_request.model.js";


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
      throw new Error("Admin role required");
    }

    if (!full_name || !email || !phone || !password || !sid || !permanent_address || !guardian_name || !guardian_contact || !branch || (!roomId && (!room_number || !block))) {
      throw new Error("Missing required fields");
    }

    //validate all data  -> sid trim email 


    const normalizedEmail = email.trim().toLowerCase();
    const normalizedSid = sid.trim();


    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      throw new Error("check your email please xyz@gmail.com")
    }

    if (normalizedSid.length !== 8 || !/^\d+$/.test(normalizedSid)) {
      throw new Error("Sid length must be 8 digit 22104109 ")
    }

    if (String(guardian_contact).length !== 10 ||
      !/^\d+$/.test(String(guardian_contact))) {
      throw new Error("Guardian Mobile number must be exactly 10 digit")
    }

    if (String(phone).length !== 10 || !/^\d+$/.test(String(phone))) {
      throw new Error("Phone number must be  equal to 10 digits")
    }

    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters long")
    }

    //check user already exist s or not 
    const existingUser = await User.findOne({ email: normalizedEmail }, { phone }, null, { session });
    if (existingUser) {
      throw new Error("User with this email already exists")
    }
    const existingStudent = await Student.findOne({ sid: normalizedSid }).session(session);//both are correct prefer this
    if (existingStudent) {
      throw new Error("Student with this SID already exists");
    }

    //? why did we use NUll :-> findOne(( filter, projection(full_name:1 info we want), options(session lean) ))
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
  const session = mongoose.startSession();
  try {
    (await session).startTransaction();

    const { user_id } = req.params;
    const student = await Student.findOneAndDelete({ user_id });

    if (!student) {
      throw new Error("No such student found")
    }
    if (student.room_id) {
      await Room.findOneAndUpdate(
        { _id: student.room_id },
        { $inc: { occupied_count: -1 } },
        { session }
      );
    }

    await RoomRequest.deleteMany(
      { student_id: student._id },
      { session }
    );
    const issues = await Issue.find(
      { raised_by: student._id },
      { _id: 1 }
    ).session(session);
    const issueIds = issues.map(i => i._id);

    await Promise.all([
      IssueComment.deleteMany({ issue_id: { $in: issueIds } }).session(session),
      Issue.deleteMany({ raised_by: student._id }).session(session),
      LeaveRequest.deleteMany({ student_id: student._id }).session(session),
    ]);

    await Student.deleteOne({ _id: student._id }).session(session);

    await User.deleteOne({ _id: student.user_id }).session(session);

    await session.commitTransaction();



    return res.status(200).json({
      success: true,
      message: "Student profile deleted successfully"
    });

  } catch (error) {
    logger.error("DELETE STUDENT PROFILE", error);
    (await session).abortTransaction();
    return res.status(500).json({
      success: false,
      message: "Failed to delete student profile"
    });
  } finally {
    (await session).endSession();
  }
};



//allotment: 
export const getPhaseARooms = async (_req, res) => {

  try {
    const rooms = await Room.find(
      {
        is_active: true, allocation_status: "AVAILABLE",
        $expr: { $lt: ["$occupied_count", "$capacity"] }
      })
      .select(`block room_number capacity occupied_count yearly_rent allocation_status`)
      .sort({ block: 1, room_number: 1 })
      .lean();


    return res.status(200).json({
      success: true,
      count: rooms.length,
      data: rooms
    })
  } catch (error) {
    logger.error("GetAllotMentRoom:Error to get allotement Rooms", error || "");
    return res.status(500).json({
      success: false,
      message: "Failed to get room for allotment"
    });
  }
}

export const phaseARegisterStudent = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const {
      full_name, email, phone, password,
      sid, branch, permanent_address, guardian_name, guardian_contact,
      room_id,
    } = req.body
    //check whether allocation phase On :
    const hostel = await Hostel.findOne({ is_active: true }).session(session);
    if (!hostel) {
      throw new Error("No hostel found");
    }
    if (hostel.allotment_status !== "PHASE_A") {
      throw new Error("Phase-A registration is closed");
    }
    //validat all incoming data ;
    //check existing user student ;

    if (!full_name || !email || !phone || !password || !sid || !room_id) {
      throw new Error("Missing required fields");
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedSid = sid.trim();


    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      throw new Error("check your email please xyz@gmail.com")
    }

    if (normalizedSid.length !== 8 || !/^\d+$/.test(normalizedSid)) {
      throw new Error("Sid length must be 8 digit 22104109 ")
    }

    if (String(guardian_contact).length !== 10 ||
      !/^\d+$/.test(String(guardian_contact))) {
      throw new Error("Guardian Mobile number must be exactly 10 digit")
    }

    if (String(phone).length !== 10 || !/^\d+$/.test(String(phone))) {
      throw new Error("Phone number must be  equal to 10 digits")
    }

    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters long")
    }


    const existingUser = await User.findOne({ email: normalizedEmail }).session(session);
    if (existingUser) {
      throw new Error("User with this email already exists")
    }
    const existingStudent = await Student.findOne({ sid: normalizedSid }).session(session);
    if (existingStudent) {
      throw new Error("Student with this SID already exists");
    }



    //create user 
    const hashedPassword = await bcrypt.hash(password, 10);
    const [user] = await User.create([{
      full_name,
      email: normalizedEmail,
      phone,
      password: hashedPassword,
      role: "student",
      status: "active",
    }], { session })

    //create student
    // check room availibility inc Occp validate student atomicity
    //room -> aviable -> student :allotment_status:alloted,veri:pending
    //for verification: roomrequest crate 


    const room = await Room.findOneAndUpdate(
      {
        _id: room_id,
        is_active: true,
        allocation_status: "AVAILABLE",
        $expr: { $lt: ["$occupied_count", "$capacity"] }
      },
      { $inc: { occupied_count: 1 }, },
      { new: true, session }
    )
    if (!room) {
      throw new Error("Room not found or Not available ")
    }

    const [student] = await Student.create([{
      user_id: user._id,
      sid: normalizedSid,
      branch, permanent_address, guardian_contact, guardian_name,
      room_id: room._id,
      allotment_phase: "A",
      allotment_status: "TEMP_LOCKED",
      verification_status: "PENDING",
    }], { session })


    await RoomRequest.create([{
      student_id: student._id,
      phase: "A",
      requested_room_id: room._id,
      status: "TEMP_LOCKED",
      processed_at: new Date(),
    }], { session });

    await session.commitTransaction();

    const populatedStudent = await Student.findById(student._id)
      .populate("user_id", "full_name email phone role status")
      .populate("room_id", "block room_number capacity yearly_rent")
      .lean();

    const token = user.generateAccessToken();

    return res.status(201).json({
      success: true,
      message: "Phase-A registration successful. Room temporarily reserved.",
      data: {
        student: populatedStudent,
        token
      }
    });

  } catch (error) {
    await session.abortTransaction();
    logger.error("Phase-A Allotment Failed", {
      message: error.message,
      stack: error.stack,
    });

    return res.status(400).json({
      success: false,
      message: "failed to createUserStudent PhaseA: " + error.message || "Failed to create New User with student for allotment"
    });
  } finally {
    session.endSession();
  }
}

export const phaseBRegisterStudent = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();


    const {
      full_name, email, phone, password,
      sid, branch, permanent_address, guardian_name, guardian_contact,
    } = req.body

    const hostel = await Hostel.findOne({ is_active: true }).session(session);
    if (!hostel) throw new Error("No hostel found");

    if (hostel.allotment_status !== "PHASE_B") {
      throw new Error("Phase-B registration is closed");
    }

    //validate all data  -> sid trim email 
    if (!full_name || !email || !password || !sid || !phone || !guardian_contact) {
      throw new Error("Missing required fields");
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedSid = sid.trim();
    const normalizedPhone = String(phone).trim();
    const normalizedGuardianContact = String(guardian_contact).trim();


    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      throw new Error("Invalid email address");
    }

    if (normalizedSid.length !== 8 || !/^\d+$/.test(normalizedSid)) {
      throw new Error("Student ID must be exactly 8 digits");
    }

    if (normalizedPhone.length !== 10 || !/^\d+$/.test(normalizedPhone)) {
      throw new Error("Phone number must be exactly 10 digits");
    }

    if (normalizedGuardianContact.length !== 10 || !/^\d+$/.test(normalizedGuardianContact)) {
      throw new Error("Guardian contact must be exactly 10 digits");
    }


    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters long")
    }

    //check user already exist s or not 
    const existingUser = await User.findOne({ email: normalizedEmail }).session(session);
    if (existingUser) {
      throw new Error("User with this email already exists")
    }
    const existingStudent = await Student.findOne({ sid: normalizedSid }).session(session);
    if (existingStudent) {
      throw new Error("Student with this SID already exists");
    }



    //create user 
    const hashedPassword = await bcrypt.hash(password, 10);
    const [user] = await User.create([{
      full_name,
      email: normalizedEmail,
      phone,
      password: hashedPassword,
      role: "student",
      status: "active",
    }], { session })

    const [student] = await Student.create([{
      user_id: user._id,
      sid: normalizedSid,
      permanent_address,
      guardian_name,
      guardian_contact,
      branch,
      allotment_phase: "B",
      allotment_status: "PENDING",
      verification_status: "PENDING"
    }], { session });

    //crate room request : 
    await RoomRequest.create([{
      student_id: student._id,
      phase: "B",
      status: "PENDING"
    }], { session })


    await session.commitTransaction();
    const token = user.generateAccessToken();
    const populatedStudent = await Student.findById(student._id)
      .populate("user_id", "full_name email phone role status")
      .lean();

    return res.status(201).json({
      success: true,
      message: "Registration successfull Room will be alloted Soon",
      data: {
        populatedStudent,
        token,
      }
    })

  } catch (error) {
    await session.abortTransaction()
    logger.error("Phase-B Allotment Failed", {
      message: error.message,
      stack: error.stack,
    });

    return res.status(400).json({
      success: false,
      message: "failed to createUserStudent Phase B: " + error.message || "Failed to create New User with student for allotment"
    });
  } finally {
    session.endSession();
  }
}




export const verifyStudentAndAllocate = async (req, res) => {
  const { studentUserId } = req.params;
  const { status } = req.body;

  if (!["VERIFIED", "REJECTED"].includes(status)) {
    return res.status(400).json({
      message: "Status must be verfied or rejected"
    });
  }
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    //verify student ;
    const student = await Student.findOne({
      user_id: studentUserId,
      allotment_status: "PENDING",
      verification_status: "PENDING"
    }).session(session);


    if (!student) {
      throw new Error("Student not found ");
    }
    //check Phase : A -> status ->  VERIFIED:updata:
    // stdent ->verificationStatus allotemnet_status roomRequest.status 
    // A -> status REJECTED : -> update all status and update room as vacant_upgrad

    const roomRequest = await RoomRequest.findOne({
      student_id: student._id,
      status: { $in: ["PENDING", "TEMP_LOCKED"] },
    }).session(session);

    if (!roomRequest) {
      throw new Error("No Active room Requests found");
    }

    //phase validation
    if (roomRequest.phase === "A") {
      if (roomRequest.status !== "TEMP_LOCKED" ||
        !roomRequest.requested_room_id) {
        throw new Error(`Invalid Phase-A room request status ${roomRequest.status}`);
      }
    }
    if (roomRequest.phase === "B") {
      if (roomRequest.status !== "PENDING" || roomRequest.requested_room_id) {
        throw new Error(`Invalid Phase-B room request state ${roomRequest.status}`);
      }
    }


    //phase A actions: ["VERIFIED", "REJECTED"]
    if (roomRequest.phase === "A") {
      if (status === "VERIFIED") {
        const room = await Room.findOneAndUpdate(
          {
            _id: roomRequest.requested_room_id,
            is_active: true,
            $expr: { $lt: ["$occupied_count", "$capacity"] }
          },
          {
            $inc: { occupied_count: 1 }
          },
          { new: true, session }
        );

        if (!room) {
          throw new Error("Room is already full or unavailable");
        }

        student.verification_status = "VERIFIED";
        student.allotment_status = "ALLOTTED";

        roomRequest.status = "SUCCESS";
        roomRequest.allocated_room_id = room._id;
        roomRequest.processed_at = new Date();
      }
      else if (status === "REJECTED") {
        student.verification_status = "REJECTED";
        student.allotment_status = "CANCELLED";
        roomRequest.status = "FAILED";
        roomRequest.processed_at = new Date();


        // const room = await Room.findById(roomRequest.requested_room_id).session(session);
        // if (room) {
        //   room.occupied_count -= 1;
        //   room.allocation_status = "VACANT_UPGRADE";
        //   await room.save({ session });
        // }
        await Room.findByIdAndUpdate(roomRequest.requested_room_id,
          {
            $set: { allocation_status: "VACANT_UPGRADE" },
          },
          {
            session, new: true
          }
        )
      }
    }

    //pahse B : -> status: VERIFIED : ["VERIFIED", "REJECTED"] 
    if (roomRequest.phase === "B") {
      if (status === "VERIFIED") {
        student.verification_status = "VERIFIED";
        const room = await Room.findOneAndUpdate(
          {
            is_active: true,
            allocation_status: { $in: ["AVAILABLE", "VACANT_UPGRADE"] },
            $expr: { $lt: ["$occupied_count", "$capacity"] }
          },
          { $inc: { occupied_count: 1 } },
          {
            sort: { allocation_status: 1, filling_order: 1 },
            new: true,
            session
          }
        )
        if (!room) {
          student.allotment_status = "CANCELLED";
          roomRequest.status = "FAILED";
          roomRequest.processed_at = new Date();
        } else {
          student.room_id = room._id;
          student.allotment_status = "ALLOTTED";

          roomRequest.status = "SUCCESS";
          roomRequest.requested_room_id = room._id;
          roomRequest.allocated_room_id = room._id;
          roomRequest.processed_at = new Date();
        }
      }
      //RoomRequest remains PENDING until admin assigns a room
      if (status === "REJECTED") {
        student.verification_status = "REJECTED";
        student.allotment_status = "CANCELLED";
        roomRequest.status = "FAILED";
        roomRequest.processed_at = new Date();
      }
    }

    await student.save({ session });
    await roomRequest.save({ session });
    await session.commitTransaction();

    return res.status(200).json({
      message: `student ${student.sid} status updated to ${status.toLowerCase()} successfully`,
      studentUserId,
    })
  } catch (error) {
    await session.abortTransaction()
    logger.error("verifyStudent Failed: not able to verify student", {
      message: error.message,
      stack: error.stack,
    });

    return res.status(400).json({
      success: false,
      message: "verifyStudent Failed: " + error.message || "Not Able to verify student verifyStudent Failed"
    });
  } finally {
    session.endSession();
  }
}

export const getMyAllotmentStatus = async (req, res) => {
  try {
    const studentId = req.studentId;

    const student = await Student.findById(studentId)
      .populate("room_id")
      .lean();

    if (!student) {
      return res.status(404).json({
        message: "Student not found"
      });
    }

    const roomRequest = await RoomRequest.findOne({
      student_id: studentId
    })
      .sort({ createdAt: -1 }).populate("requested_room_id")
      .lean();

    return res.status(200).json({
      phase: roomRequest?.phase || null,
      allotment_status: student.allotment_status,
      verification_status: student.verification_status,
      requested_room: roomRequest?.requested_room_id || null,
      allocated_room:
        student.room_id && student.allotment_status === "ALLOTTED"
          ? student.room_id
          : null
    });
  } catch (error) {
    logger.error("Get allotment status error:", error);
    return res.status(500).json({
      message: "Internal server error"
    });
  }
}

/*export const getVerificationRequests = async (req, res) => {
  //NOTE :convert it to aggregation pipeline please
  try {
    let { phase, page = 1, limit = 10 } = req.query;
    page = Math.max(parseInt(page), 1);
    limit = Math.min(Math.max(parseInt(limit), 1), 25);
    const skip = (page - 1) * limit;

    const filter = {
      status: { $in: ["TEMP_LOCKED", "PENDING"] }
    };

    if (phase) {
      filter.phase = phase;
    }

    const requests = await RoomRequest.find(filter)
      .populate({
        path: "student_id",
        match: {
          verification_status: "PENDING",
          allotment_status: { $ne: "CANCELLED" }
        },
        populate: {
          path: "user_id",
          select: "full_name email phone"
        }
      })
      .populate("requested_room_id", "block room_number capacity")
      .sort({ createdAt: 1 }).skip(skip).limit(limit)
      .lean();

    const cleaned = requests.filter(r => r.student_id);
    const total = await RoomRequest.countDocuments(filter);


    return res.status(200).json({
      pagination: {
        total, page, limit, totalPages: Math.ceil(total / limit)
      },
      count: cleaned.length,
      data: cleaned.map(r => ({
        request_id: r._id,
        phase: r.phase,
        request_status: r.status,
        verification_status: r.student_id.verification_status,
        student: {
          sid: r.student_id.sid,
          branch: r.student_id.branch,
          name: r.student_id.user_id.full_name,
          email: r.student_id.user_id.email,
          phone: r.student_id.user_id.phone
        },
        room: r.requested_room_id || null,
        createdAt: r.createdAt
      }))
    });

  } catch (error) {
    logger.error("Failed to fetch verification requests")

    return res.status(500).json({
      message: "Failed to fetch verification requests",
      error: error.message
    });
  }
}*/

export const getVerificationRequests = async (req, res) => {
  try {
    //search as name or sid
    let { page = 1, limit = 10, phase, search } = req.query;
    page = Math.max(parseInt(page), 1);
    limit = Math.min(Math.max(parseInt(limit), 1), 50);
    const skip = (page - 1) * limit;

    const matchStage = {
      status: { $in: ["TEMP_LOCKED", "PENDING"] }
    };

    if (phase) {
      matchStage.phase = phase;
    }

    const searchMatch = search
      ? {
        $or: [
          { "student.sid": { $regex: search, $options: "i" } },
          { "user.full_name": { $regex: search, $options: "i" } }
        ]
      }
      : {};

    const pipeline = [
      // 1️⃣ Match active requests
      { $match: matchStage },

      // 2️⃣ Join student
      {
        $lookup: {
          from: "students",
          localField: "student_id",
          foreignField: "_id",
          as: "student"
        }
      },
      { $unwind: "$student" },

      // 3️⃣ Student filters
      {
        $match: {
          "student.verification_status": "PENDING",
          "student.allotment_status": { $ne: "CANCELLED" }
        }
      },

      // 4️⃣ Join user
      {
        $lookup: {
          from: "users",
          localField: "student.user_id",
          foreignField: "_id",
          as: "user"
        }
      },
      { $unwind: "$user" },

      // 5️⃣ Search filter (SID / Name)
      ...(search ? [{ $match: searchMatch }] : []),

      // 6️⃣ Join room
      {
        $lookup: {
          from: "rooms",
          localField: "requested_room_id",
          foreignField: "_id",
          as: "room"
        }
      },
      { $unwind: { path: "$room", preserveNullAndEmptyArrays: true } },

      // 7️⃣ Phase priority (A first)
      {
        $addFields: {
          phasePriority: {
            $cond: [{ $eq: ["$phase", "A"] }, 1, 2]
          }
        }
      },

      // 8️⃣ Sorting
      {
        $sort: {
          phasePriority: 1,
          createdAt: 1
        }
      },

      // 9️⃣ Pagination + exact count
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 0,
                request_id: "$_id",
                phase: 1,
                request_status: "$status",
                verification_status: "$student.verification_status",
                createdAt: 1,
                student: {
                  sid: "$student.sid",
                  branch: "$student.branch",
                  name: "$user.full_name",
                  email: "$user.email",
                  phone: "$user.phone"
                },
                room: {
                  $cond: [
                    { $ifNull: ["$room", false] },
                    {
                      block: "$room.block",
                      room_number: "$room.room_number",
                      capacity: "$room.capacity"
                    },
                    null
                  ]
                }
              }
            }
          ],
          totalCount: [{ $count: "count" }]
        }
      }
    ];

    const [result] = await RoomRequest.aggregate(pipeline);

    const total = result.totalCount[0]?.count || 0;

    return res.status(200).json({
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      count: result.data.length,
      data: result.data
    });

  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch verification requests",
      error: error.message
    });
  }
};



