import Student from "../models/student_profile.model.js";
import User from "../models/user.model.js";
import logger from "../utils/logger.js";
import Room from "../models/room.model.js"
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import RoomRequest from "../models/roomRequest.model.js";
import Issue from "../models/issue.model.js";
import IssueComment from "../models/issue_comment.model.js";
import LeaveRequest from "../models/leave_request.model.js";
import puppeteer from "puppeteer";
import { studentProfileHTML } from "../utils/templates.js";
import { deleteMulter } from "../middlewares/multer.middleware.js";
import { formatDate, validateRoomInput, validateStudentCreate, validateVerificationIds } from "../utils/helperFunctions.js";
import QRCode from "qrcode";
import ExcelJS from "exceljs";

//new or old room with new student
export const createUserStudent = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    //TODO : romove room_number and block after aggregation pipeline
    if (req.user.role !== "admin") {
      throw new Error("Admin role required");
    }

    const { full_name, email, phone, password, sid, permanent_address, guardian_name, guardian_contact, branch } = validateStudentCreate(req.body);

    const { room_number, block, roomId, capacity } = validateRoomInput(req.body)
    let { verificationIds } = req.body;

    if (typeof verificationIds === "string") {
      verificationIds = JSON.parse(verificationIds);
    }
    verificationIds = validateVerificationIds(verificationIds);


    //? why did we use NUll :-> findOne(( filter, projection(full_name:1 info we want), options(session lean) ))
    //NOTE : User.create([{ ... }], { session }) rule:
    //[user] : mean take the first arr[0] => user =arr[0];

    const hashedPassword = await bcrypt.hash(password, 10);
    const [user] = await User.create([{
      full_name: full_name,
      email: email,
      phone,
      password: hashedPassword,
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
          block: block,
          room_number,
          occupied_count: 1,
          capacity: capacity ?? 1
        }],
        { session }
      );
      room = newRoom;
    }


    const uploadedFile = req.file
      ? {
        url: req.file.path,
        public_id: req.file.filename,
      }
      : null;

    const [student] = await Student.create([{
      user_id: user._id,
      room_id: room._id,
      sid,
      permanent_address: permanent_address,
      guardian_name: guardian_name,
      guardian_contact,
      verification_status: "VERIFIED",
      allotment_status: "ALLOTTED",
      branch: branch,
      profile_photo: uploadedFile,
      verificationIds: verificationIds,
    }], { session });

    await session.commitTransaction();

    await student.populate([
      { path: "user_id", select: "full_name email phone role status" },
      { path: "room_id", select: "block room_number capacity " }
    ]);
    logger.info("Student created successfully", { student: student });
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
    // test this too
    // console.log(req.file ?? "not foudnd")
    deleteMulter(req.file?.filename, "image").catch((err) => {
      logger.error("Failed to delete uploaded file after user creation error", err);
    });
    logger.error("Failed to add user", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to add user"
    });
  } finally {
    session.endSession();
  }

}

// New student with existing  room  and user not used anywhere else
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


    if (!sid || !permanent_address || !guardian_contact || !branch || !room_id) {
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

// Update student profile by student(some) and admin(all expect user);
export const updateStudentProfile = async (req, res) => {
  try {
    const { user_id } = req.params;


    if (typeof req.body.verificationIds === "string") {
      req.body.verificationIds = JSON.parse(req.body.verificationIds);
    }
    req.body.verificationIds = validateVerificationIds(req.body.verificationIds || {});
    const student = await Student.findOne({ user_id });
    if (!student) {
      const err = new Error("Student not found");
      err.statusCode = 404;
      err.source = "UPDATE_STUDENT_PROFILE";
      throw err;
    }


    const isAdminRoute = req.originalUrl.includes("/edit");
    const isAdminUser = ["admin", "staff"].includes(req.user.role);

    //means if login student doest not match with /:user_id
    if (!isAdminRoute && req.user._id.toString() != user_id) {
      const err = new Error("You can update only your own profile");
      err.statusCode = 403;
      err.source = "UPDATE_STUDENT_PROFILE";
      throw err;
    }

    if (isAdminRoute && !isAdminUser) {
      const err = new Error("isAdmin role required to update other student's profile");
      err.statusCode = 403;
      err.source = "UPDATE_STUDENT_PROFILE";
      throw err;
    }


    let newRoomId = null;
    if (req.body.room_number && req.body.room_number.trim() !== student.room_number) {
      if (isAdminRoute && req.body?.block && req.body?.room_number) {
        const room = await Room.findOne({
          is_active: true,
          block: req.body.block.toLowerCase(),
          room_number: req.body.room_number,
          allocation_status: { $in: ["AVAILABLE", "VACANT_UPGRADE"] }
        });
        logger.info("ROOM FOUND FOR STUDENT ROOM CHANGE", { room: room });
        if (!room) {
          const err = new Error("Room Not Available");
          err.statusCode = 404;
          err.source = "UPDATE_STUDENT_PROFILE";
          throw err;
        }

        if (room.occupied_count >= room.capacity) {
          const err = new Error("Room Full or not available");
          err.statusCode = 400;
          err.source = "UPDATE_STUDENT_PROFILE";
          throw err;
        }
        newRoomId = room._id;
      } else {
        const err = new Error("Block and Room Number required to change room");
        err.statusCode = 400;
        err.source = "UPDATE_STUDENT_PROFILE";
        throw err;
      }
    }

    const allowedFields = isAdminRoute
      ? ["permanent_address", "guardian_name", "guardian_contact", "branch", "sid", "verificationIds",]
      : ["permanent_address", "guardian_name",];

    const hasRealChange = allowedFields.some(field => {
      if (req.body[field] === undefined) return false;
      const newValue =
        typeof req.body[field] === "string"
          ? req.body[field].trim()
          : req.body[field];
      return newValue != student[field];
    });

    const hasRoomChange = newRoomId && newRoomId.toString() !== student.room_id?.toString();
    const hasFileChange = Boolean(req.file);

    if (!hasRealChange && !hasRoomChange && !hasFileChange) {
      const err = new Error("No changes detected");
      err.statusCode = 400;
      err.source = "UPDATE_STUDENT_PROFILE";
      throw err;
    }

    //aplly changes
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        student[field] =
          typeof req.body[field] === "string"
            ? req.body[field]?.trim()
            : req.body[field];
      }
    }
    if (newRoomId) {
      student.room_id = newRoomId;
    }
    if (req.uploadedFile) {
      // if (student.profile_photo?.public_id) {
      //   deleteMulter(student.profile_photo.public_id, "image").catch((err) => {
      //     logger.error("Failed to delete old profile photo during update", err);
      //   });
      // }
      student.profile_photo = req.uploadedFile

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

export const downloadStudentDocument = async (req, res) => {
  try {
    const { user_id } = req.params;

    const student = await Student.findOne({ user_id: user_id })
      .populate("room_id")
      .populate("user_id");
    logger.info("Generating PDF for student", { student: student });

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }
    const qrPayload = {
      sid: student?.sid,
      name: student?.user_id?.full_name,
      email: student?.user_id?.email,
      phone: student?.user_id?.phone,
      branch: student?.branch,
      room: (student?.room_id?.block + " " + student?.room_id?.room_number) || null,
      address: student?.permanent_address,
      StudentId: student?.verificationIds?.studentId?.idType + "- " + student?.verificationIds?.studentId?.idValue || null,
      guardian_name: student?.guardian_name || null,
      guardian_contact: student?.guardian_contact || null,
      verifiedAt: formatDate(student?.updatedAt),
      v: 1
    };

    const qrCodeDataUrl = await QRCode.toDataURL(
      JSON.stringify(qrPayload),
      {
        errorCorrectionLevel: "H",
        margin: 1,
        width: 140
      }
    );

    const html = studentProfileHTML(student, qrCodeDataUrl);

    const browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });


    const page = await browser.newPage();
    await page.emulateMediaType("screen");

    await page.setContent(html, { waitUntil: "networkidle0" });
    await new Promise(resolve => setTimeout(resolve, 500));

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true
    });

    await browser.close();

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=${student.sid}_verification.pdf`,
    });

    res.send(pdfBuffer);

  } catch (error) {
    logger.error("DOWNLOAD STUDENT DOCUMENT", error);
    res.status(500).json({ message: "Failed to generate PDF" });
  }
}

export const exportAccountantExcel = async (_req, res) => {
  const students = await Student.find()
    .populate("user_id", "full_name phone")
    .select("sid verificationIds verification_status");

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Payments");

  sheet.columns = [
    { header: "SID", key: "sid", width: 15 },
    { header: "Student Name", key: "name", width: 25 },
    { header: "Phone", key: "phone", width: 15 },
    { header: "Payment ID", key: "paymentId", width: 30 },
    { header: "Payment Method", key: "method", width: 20 },
    { header: "Payment Date", key: "paymentDate", width: 20 },
    { header: "Verification Status", key: "verification", width: 20 },
  ];

  students.forEach(s => {
    sheet.addRow({
      sid: s.sid,
      name: s.user_id?.full_name,
      phone: s.user_id?.phone,
      paymentId: s.verificationIds?.paymentId?.idValue,
      method: s.verificationIds?.paymentId?.idType,
      paymentDate: s.verificationIds?.paymentId?.paymentDate,
      verification: s.verification_status,
    });
  });

  res.setHeader(
    "Content-Disposition",
    "attachment; filename=accountant-payments.xlsx"
  );
  await workbook.xlsx.write(res);
  res.end();
};

export const exportStudentWiseExcel = async (req, res) => {
  try {
    const students = await Student.find({
      allotment_status: "ALLOTTED",
    })
      .populate("user_id", "full_name phone email")
      .select(
        "sid block room_number permanent_address guardian_name guardian_contact"
      )
      .sort({ block: 1, room_number: 1 });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Student Wise");

    sheet.columns = [
      { header: "SID", key: "sid", width: 15 },
      { header: "Student Name", key: "name", width: 25 },
      { header: "Room No", key: "room", width: 15 },
      { header: "Phone", key: "phone", width: 15 },
      { header: "Permanent Address", key: "address", width: 35 },
      { header: "Guardian Name", key: "guardianName", width: 25 },
      { header: "Guardian Contact", key: "guardianPhone", width: 15 },
    ];

    students.forEach((s) => {
      sheet.addRow({
        sid: s.sid,
        name: s.user_id?.full_name,
        room: s.block && s.room_number
          ? `${s.block.toUpperCase()}-${s.room_number}`
          : "Not Assigned",
        phone: s.user_id?.phone,
        address: s.permanent_address,
        guardianName: s?.guardian_name,
        guardianPhone: s?.guardian_contact,
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=student-wise-allotment.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Student-wise Excel export failed" });
  }
};


export const exportRoomWiseExcel = async (req, res) => {
  try {
    const rooms = await Room.find()
      .populate({
        path: "occupants",
        populate: {
          path: "user_id",
          select: "full_name phone",
        },
      })
      .sort({ block: 1, room_number: 1 });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Room Wise");

    sheet.columns = [
      { header: "Block", key: "block", width: 10 },
      { header: "Room No", key: "room", width: 15 },
      { header: "SID", key: "sid", width: 15 },
      { header: "Student Name", key: "name", width: 25 },
      { header: "Phone", key: "phone", width: 15 },
    ];

    rooms.forEach((room) => {
      if (!room.occupants.length) {
        sheet.addRow({
          block: room.block,
          room: room.room_number,
          sid: "-",
          name: "VACANT",
          phone: "-",
        });
      } else {
        room.occupants.forEach((student) => {
          sheet.addRow({
            block: room.block,
            room: room.room_number,
            sid: student.sid,
            name: student.user_id?.full_name,
            phone: student.user_id?.phone,
          });
        });
      }
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=room-wise.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Room-wise Excel export failed" });
  }
};

export const deleteStudentProfile = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();;

    const { user_id } = req.params;
    const student = await Student.findOne({ user_id }).session(session);

    if (!student) {
      throw new Error("No such student found")
    }
    const profilePublicId = student.profile_photo?.public_id || null;

    if (student.room_id) {
      await Room.findOneAndUpdate(
        {
          _id: student.room_id,
          occupied_count: { $gt: 0 }
        },
        { $inc: { occupied_count: -1 } },
        { session }
      );
    }



    await Promise.all([
      RoomRequest.deleteMany({ student_id: student._id }).session(session),
      Issue.deleteMany({ raised_by: student._id }).session(session),
      LeaveRequest.deleteMany({ student_id: student._id }).session(session),
      IssueComment.deleteMany({ commented_by: student.user_id }).session(session),
      Student.deleteOne({ _id: student._id }).session(session),
      User.deleteOne({ _id: student.user_id }).session(session),
    ]);
    await session.commitTransaction();

    if (profilePublicId) {
      deleteMulter(profilePublicId, "image").catch((err) => {
        logger.error("Failed to delete profile photo after student deletion", err);
      });
    }

    return res.status(200).json({
      success: true,
      message: "Student profile deleted successfully"
    });

  } catch (error) {
    logger.error("DELETE STUDENT PROFILE", error);
    await session.abortTransaction();
    return res.status(500).json({
      success: false,
      message: "Failed to delete student profile"
    });
  } finally {
    session.endSession();
  }
};


export const uploadStudentProfilePhoto = async (req, res) => {
  try {
    logger.time("UPLOAD STUDENT PROFILE PHOTO");
    if (!req.uploadedFile) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }
    logger.info(req.studentId)
    const student = await Student.findOneAndUpdate(
      { user_id: req.params.userId },
      {
        profile_photo: req.uploadedFile,
      },
      { new: true }
    );




    logger.info("student Aftre upload ", student)

    logger.timeEnd("UPLOAD STUDENT PROFILE PHOTO");
    return res.status(200).json({
      success: true,
      message: "Profile photo uploaded successfully",
      profile_photo: student.profile_photo,
    });
  } catch (error) {
    logger.error("UPLOAD STUDENT PROFILE PHOTO", error);
    return res.status(500).json({
      success: false,
      message: "Failed to upload profile photo",
    });
  }
};

