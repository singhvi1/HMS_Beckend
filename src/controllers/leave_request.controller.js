import LeaveRequest from "../models/leave_request.model.js";
import Student from "../models/student_profile.model.js";
import logger from "../utils/logger.js";

export const createLeaveRequest = async (req, res) => {
  try {
    const { from_date, to_date, destination, reason } = req.body;

    if (!from_date || !to_date) {
      return res.status(400).json({
        success: false,
        message: "From date and to date are required"
      });
    }
    if (!destination?.trim() || !reason?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Destination and reason are required"
      });
    }
    const normalizeDate = (dateStr) => {
      const [y, m, d] = dateStr.split("-").map(Number);
      return new Date(y, m - 1, d);
    };
    const fromDate = normalizeDate(from_date)
    const toDate = normalizeDate(to_date)

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format"
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (fromDate < today) {
      return res.status(400).json({
        success: false,
        message: "From date cannot be in the past"
      });
    }

    if (toDate < fromDate) {
      return res.status(400).json({
        success: false,
        message: "To date must be same as or after from date"

      });
    }
    const overlappingLeave = await LeaveRequest.findOne({
      student_id: req.studentId,
      status: { $in: ["pending", "approved"] },
      from_date: { $lte: toDate },
      to_date: { $gte: fromDate }
    });

    if (overlappingLeave) {
      return res.status(409).json({
        success: false,
        message: "You already have a leave request for this period"
      });
    }

    const leaveRequest = await LeaveRequest.create({
      student_id: req.user.student._id,
      from_date: fromDate,
      to_date: toDate,
      destination: destination?.trim(),
      reason: reason?.trim()
    });

    await leaveRequest.populate({
      path: "student_id",
      select: "sid branch room_number block",
      populate: {
        path: "user_id",
        select: "full_name email phone"
      }
    });

    return res.status(201).json({
      success: true,
      leaveRequest,
      message: "Leave request created successfully"
    });

  } catch (error) {
    logger.error("CREATE LEAVE REQUEST", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create leave request"
    });
  }
};

export const getAllLeaveRequests = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, studentId, sid, block, from_date, to_date, room_number } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {};

    if (req.user.role === "student") {
      query.student_id = req.studentId;
    }
    if ((req.user.role === "admin" || req.user.role === "staff") &&
      studentId
    ) {
      query.student_id = studentId;
    }
    let studentSearchId = []
    if ((sid || block || room_number) && req.user.role == "admin") {
      const studentQuery = {};

      if (sid?.trim()) {
        studentQuery.sid = new RegExp(sid, "i")
      }

      if (block) {
        studentQuery.block = block.trim().toLowerCase();
      }
      if (room_number?.trim()) {
        studentQuery.room_number = new RegExp(room_number, "i")
      }


      const students = await Student.find(studentQuery).select("_id");
      if (students.length > 0) {
        studentSearchId = students.map(s => s._id)
      }
    }

    if (studentSearchId.length > 0) {
      if (query.student_id) {
        // merge with existing condition
        query.student_id = {
          $in: studentSearchId.filter(id =>
            id.toString() === query.student_id.toString()
          )
        };
      } else {
        query.student_id = { $in: studentSearchId };
      }
    }


    if (from_date || to_date) {
      query.from_date = {};
      if (from_date) query.from_date.$gte = new Date(from_date);
      if (to_date) query.from_date.$lte = new Date(to_date);
    }
    if (status && ["pending", "approved", "rejected"].includes(status)) {
      query.status = status;
    }

    const leaveRequests = await LeaveRequest.find(query)
      .populate({
        path: "student_id",
        select: "sid branch room_number block",
        populate: {
          path: "user_id",
          select: "full_name email phone"
        }
      })
      .populate("approved_by", "full_name email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await LeaveRequest.countDocuments(query);

    return res.status(200).json({
      success: true,
      message: "Leave requests fetched successfully",
      leaveRequests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
    });

  } catch (error) {
    logger.error("GET ALL LEAVE REQUESTS", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch leave requests"
    });
  }
};

export const getLeaveRequest = async (req, res) => {
  try {
    const { id } = req.params;

    const leaveRequest = await LeaveRequest.findById(id)
      .populate({
        path: "student_id",
        select: "sid branch room_number block user_id",
        populate: {
          path: "user_id",
          select: "full_name email phone"
        }
      })
      .populate("approved_by", "full_name email role");

    if (!leaveRequest) {
      return res.status(404).json({
        success: false,
        message: "Leave request not found"
      });
    }

    // Check access: students can only see their own requests
    if (req.user.role === "student" &&
      leaveRequest.student_id.user_id._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }


    return res.status(200).json({
      success: true,
      leaveRequest,
      message: "Leave request fetched successfully"
    });

  } catch (error) {
    logger.error("GET LEAVE REQUEST", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid leave request ID"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to fetch leave request"
    });
  }
};

export const updateLeaveRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status || !["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be either 'approved' or 'rejected'"
      });
    }

    const leaveRequest = await LeaveRequest.findOneAndUpdate({ _id: id, status: "pending" }, {
      status,
      approved_by: req.user._id
    }, {
      new: true
    }).populate({
      path: "student_id",
      select: "sid branch room_number block",
      populate: {
        path: "user_id",
        select: "full_name email phone"
      }
    }).populate("approved_by", "full_name email role");;

    if (!leaveRequest) {
      return res.status(404).json({
        success: false,
        message: "Leave request not found"
      });
    }

    return res.status(200).json({
      success: true,
      leaveRequest,
      message: `Leave request ${status} successfully`
    });

  } catch (error) {
    logger.error("UPDATE LEAVE REQUEST STATUS", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid leave request ID"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update leave request status"
    });
  }
};

export const deleteLeaveRequest = async (req, res) => {
  try {
    const { id } = req.params;

    const leaveRequest = await LeaveRequest.findById(id);

    if (!leaveRequest) {
      return res.status(404).json({
        success: false,
        message: "Leave request not found"
      });
    }

    // Check access
    /*if (req.user.role === "student") {
      const student = await Student.findOne({ user_id: req.user._id });
      if (!student || leaveRequest.student_id.toString() !== student._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Access denied"
        });
      }

      // Students can only delete pending requests
      if (leaveRequest.status !== "pending") {
        return res.status(400).json({
          success: false,
          message: "You can only delete pending leave requests"
        });
      }
    }*/
    // STUDENT RULES
    if (req.user.role === "student") {
      // student already populated in auth middleware
      if (!req.user.student) {
        return res.status(403).json({
          success: false,
          message: "Student profile not found"
        });
      }

      // Must be own leave request
      if (leaveRequest.student_id.toString() !== req.user.student._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Access denied"
        });
      }

      // Can delete only pending
      if (leaveRequest.status !== "pending") {
        return res.status(400).json({
          success: false,
          message: "You can only delete pending leave requests"
        });
      }
    }

    // await LeaveRequest.findByIdAndDelete(id);
    await leaveRequest.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Leave request deleted successfully"
    });

  } catch (error) {
    logger.error("DELETE LEAVE REQUEST", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid leave request ID"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to delete leave request"
    });
  }
};

