import mongoose from "mongoose";
import Room from "../models/room.model.js";
import RoomRequest from "../models/roomRequest.model.js";
import Student from "../models/student_profile.model.js";
import logger from "../utils/logger.js";
import Hostel from "../models/hostel.model.js";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";

export const toggleAllotment = async (req, res) => {

  try {
    const { id } = req.params;
    const { allotment_status } = req.body;

    if (!["CLOSED", "PHASE_A", "PHASE_B"].includes(allotment_status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid allotment status"
      })
    };
    const hostel = await Hostel.findById(id);

    if (!hostel) {
      logger.warn("TOGGLE_ALLOTMENT: Hostel not found", { hostel_id: id });

      return res.status(404).json({
        success: false,
        message: "Hostel not found",
      });
    }
    const currentStatus = hostel.allotment_status;
    const allowedNextStates = {
      CLOSED: ["PHASE_A"],
      PHASE_A: ["PHASE_B", "CLOSED"],
      PHASE_B: ["CLOSED"]
    };
    if (!allowedNextStates[currentStatus].includes(allotment_status)) {
      return res.status(409).json({
        success: false,
        message: `Invalid transition from ${currentStatus} to ${allotment_status}`
      });
    }
    hostel.allotment_status = allotment_status;
    await hostel.save();

    logger.info("TOGGLE_ALLOTMENT: Allotment status changed", {
      hostel_id: id,
      allotment: hostel.allotment,
    });

    return res.status(200).json({
      success: true,
      message: `Allotment moved from ${currentStatus} → ${allotment_status}`,
      data: { allotment_status, id }
    });
  } catch (error) {
    logger.error("TOGGLE_ALLOTMENT: Error toggling allotment", error);

    return res.status(500).json({
      success: false,
      message: "Failed to toggle allotment",
    });
  }
};
export const getAllotmentStatus = async (_req, res) => {
  try {
    const hostel = await Hostel.findOne().select("allotment_status");
    const allotment_status = hostel.allotment_status || "Not Found"
    if (!hostel) {
      logger.warn("ALLOTMENT_Status: Hostel not found");

      return res.status(404).json({
        success: false,
        message: "Hostel not found",
      });
    }


    logger.info("ALLOTMENT_Status: Allotment status Found", {
      allotment: allotment_status,
    });

    return res.status(200).json({
      success: true,
      message: `Allotment Status is `,
      data: { hostel }
    });
  } catch (error) {
    logger.error("ALLOTMENT_Status: Error Finding  allotment Status", error);

    return res.status(500).json({
      success: false,
      message: "Failed to toggle allotment",
    });
  }
}
export const getAllotmentQuickInfo = async (_req, res) => {
  try {
    const [totalActiveRooms, availableRooms, fullyOccupiedRooms, upgradeRooms, pendingAllotmentReq, allotmentSuccessFul, pendingVerificationAllotmentPhaseA, failedAllotment, totalActiveStudents, totalInactiveStudents, totalStudents] = await Promise.all([
      Room.countDocuments({ is_active: true }),
      Room.countDocuments({ allocation_status: "AVAILABLE" }),
      Room.countDocuments({ allocation_status: "FULL" }),
      Room.countDocuments({ allocation_status: "VACANT_UPGRADE" }),
      RoomRequest.countDocuments({ status: "PENDING" }),
      RoomRequest.countDocuments({ status: "SUCCESS" }),
      RoomRequest.countDocuments({ status: "TEMP_LOCKED" }),
      RoomRequest.countDocuments({ status: "FAILED" }),
      User.countDocuments({ status: "active", role: "student" }),
      User.countDocuments({ status: "inactive", role: "student" }),
      User.countDocuments({ role: "student" }),
    ])
    res.json({
      success: true,
      data: {
        totalActiveRooms, availableRooms, fullyOccupiedRooms, upgradeRooms,
        pendingAllotmentReq, allotmentSuccessFul, pendingVerificationAllotmentPhaseA, failedAllotment, totalInactiveStudents, totalActiveStudents, totalStudents
      },
    });
  } catch (err) {
    logger.error("Not able to find QuickInfo", err)
    res.status(500).json(
      { success: false, message: "Not able to find QuickInfo" });
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
export const getPhaseARooms = async (_req, res) => {

  try {
    const rooms = await Room.find(
      {
        is_active: true, allocation_status: "AVAILABLE",
        $expr: { $lt: ["$occupied_count", "$capacity"] }
      })
      .select(`block room_number capacity is_active occupied_count yearly_rent allocation_status filling_order`)
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
export const getRoomById = async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findById(roomId)

    if (!room) {
      logger.warn("GET_ROOM_BY_ID: Room not found", { room_id: roomId });

      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    logger.info("GET_ROOM_BY_ID: Room fetched", { room_id: roomId });

    return res.status(200).json({
      success: true,
      room: room
    });

  } catch (error) {
    logger.error("GET_ROOM_BY_ID: Error fetching room", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch room"
    });
  }
};
export const getVerificationRequests = async (req, res) => {
  try {
    //search as name or sid
    let { page = 1, limit = 10, phase, search, verification_status = "PENDING" } = req.query;
    page = Math.max(parseInt(page), 1);
    limit = Math.min(Math.max(parseInt(limit), 1), 50);
    const skip = (page - 1) * limit;

    const matchStage = {
      status: { $in: ["PENDING", "SUCCESS", "FAILED", "TEMP_LOCKED"] }
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
    const studentMatch = {};

    if (verification_status) {
      studentMatch["student.verification_status"] = verification_status;
    }

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
      // {
      //   $match: {
      //     "student.verification_status": "PENDING",
      //     "student.allotment_status": { $ne: "CANCELLED" }
      //   }
      // },
      {
        $match: studentMatch
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
                  phone: "$user.phone",
                  user_id: "$user._id"
                },
                room: {
                  $cond: [
                    { $ifNull: ["$room", false] },
                    {
                      block: "$room.block",
                      room_number: "$room.room_number",
                      capacity: "$room.capacity",
                      order: "$room.filling_order"
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

    const accessToken = user.generateAccessToken();

    return res
      .cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24)
      })
      .status(201).json({
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
    const accessToken = user.generateAccessToken();
    const populatedStudent = await Student.findById(student._id)
      .populate("user_id", "full_name email phone role status")
      .lean();

    return res
      .cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24)
      }).status(201).json({
        success: true,
        message: "Registration successfull Room will be alloted Soon",
        data: {
          populatedStudent,
          accessToken,
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


export const adjustRoomCapacity = async (req, res) => {
  const action = Number(req.body.action);
  const roomCount = Number(req.body.roomCount);
  const maxCapcity = 2;
  if (![-1, +1, 1].includes(action)) {
    return res.status(400).json({
      success: false,
      message: "action of +1/-1 only allowed",
      data: action,
    })
  }
  if (!roomCount || roomCount <= 0) {
    return res.status(400).json({
      message: "RoomCount should be greater than 0"
    })
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();
    // Find Room -> loop -> update

    const rooms = await Room.find(
      {
        filling_order: { $ne: null }
      }).sort({ filling_order: -1 }).limit(roomCount).session(session);

    if (rooms.length === 0) {
      throw new Error("No rooms eligible for capacity adjustment as per filling order");
    }
    const preview = [];
    for (const room of rooms) {
      const newCapacity = room.capacity + action;
      if (newCapacity > maxCapcity) {
        throw new Error(
          `Cannot increase capacity beyond ${maxCapcity} for room ${room.block}-${room.room_number}`
        );

      }

      if (room?.occupied_count > newCapacity) {
        throw new Error(`Cannot reduce capacity of room ${room.block}-${room.room_number}. ` + `Occupied: ${room?.occupied_count},  Capacity: ${room.capacity}`)
      }

      const newStatus = room.occupied_count === newCapacity ? 'FULL' : "AVAILABLE";

      preview.push({
        room: `${room.block}-${room.room_number}`,
        currentCapacity: room.capacity, newCapacity,
        occupied: room.occupied_count,
        statusAfter: newStatus,
      });
      await Room.updateOne(
        { _id: room._id },
        {
          capacity: newCapacity,
          allocation_status: newStatus,
        },
        { session }
      )
    }
    await session.commitTransaction();
    return res.status(200).json({
      message: "Room capacity action applied successfully",
      action,
      actionOnRoom: rooms.length,
      rooms: preview,
    })

  } catch (error) {
    await session.abortTransaction()
    logger.error("Action for capacity Failed", {
      message: error.message,
      stack: error.stack,
    });

    return res.status(400).json({
      success: false,
      message: "Action for capacity Failed: " + error.message || "Action for capacity Failed"
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
      allotment_status: { $in: ["PENDING", "TEMP_LOCKED"] },
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
    if (roomRequest.status === "SUCCESS" || roomRequest.status === "FAILED") {
      throw new Error("Room request already processed");
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
        student.verification_status = "VERIFIED";
        student.allotment_status = "ALLOTTED";

        roomRequest.status = "SUCCESS";
        roomRequest.allocated_room_id = roomRequest?.requested_room_id;
        roomRequest.processed_at = new Date();
      }
      else if (status === "REJECTED") {
        student.verification_status = "REJECTED";
        student.allotment_status = "CANCELLED";
        roomRequest.status = "FAILED";
        roomRequest.processed_at = new Date();
        await Room.findOneAndUpdate(
          {
            _id: roomRequest.requested_room_id,
            $expr: { $gt: ["$occupied_count", 0] }
          },
          {
            $inc: { occupied_count: -1 },
            $set: { allocation_status: "VACANT_UPGRADE" }
          },
          { session }
        );
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
          {
            $inc: { occupied_count: 1 },
            $set: { filling_order: null }
          },
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