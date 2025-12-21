import Payment from "../models/payment.model.js";
import User from "../models/user.model.js";
import Student from "../models/student_profile.model.js";
import logger from "../utils/logger.js";

// Create payment record
const createPayment = async (req, res) => {
  try {
    const { user_id, amount, status, transaction_id } = req.body;

    // Validation
    if (!user_id || !amount || !status) {
      return res.status(400).json({
        success: false,
        message: "User ID, amount, and status are required"
      });
    }

    if (!["success", "failed"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be either 'success' or 'failed'"
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than 0"
      });
    }

    // Check if user exists (optimized - single DB call)
    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Check access: students can only create payments for themselves
    if (req.user.role === "student" && req.user._id.toString() !== user_id) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only create payments for yourself"
      });
    }

    const payment = await Payment.create({
      user_id,
      amount,
      status,
      transaction_id: transaction_id?.trim()
    });

    // Populate user details (optimized - single populate call)
    await payment.populate("user_id", "full_name email phone role");

    return res.status(201).json({
      success: true,
      payment,
      message: "Payment record created successfully"
    });

  } catch (error) {
    logger.error("CREATE PAYMENT", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create payment record"
    });
  }
};

// Get all payments
const getAllPayments = async (req, res) => {
  try {
    const { page = 1, limit = 10, user_id, status, start_date, end_date } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    const query = {};

    // Students can only see their own payments
    if (req.user.role === "student") {
      query.user_id = req.user._id;
    } else if (user_id) {
      // Admin/staff can filter by user
      query.user_id = user_id;
    }

    if (status && ["success", "failed"].includes(status)) {
      query.status = status;
    }

    // Date range filter
    if (start_date || end_date) {
      query.createdAt = {};
      if (start_date) {
        query.createdAt.$gte = new Date(start_date);
      }
      if (end_date) {
        query.createdAt.$lte = new Date(end_date);
      }
    }

    // Optimized: Get payments with populated user data in single query
    const payments = await Payment.find(query)
      .populate("user_id", "full_name email phone role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Payment.countDocuments(query);

    // Calculate total amount for successful payments
    const totalAmount = await Payment.aggregate([
      { $match: { ...query, status: "success" } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    return res.status(200).json({
      success: true,
      payments,
      totalAmount: totalAmount[0]?.total || 0,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      message: "Payments fetched successfully"
    });

  } catch (error) {
    logger.error("GET ALL PAYMENTS", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch payments"
    });
  }
};

// Get single payment
const getPayment = async (req, res) => {
  try {
    const { id } = req.params;

    const payment = await Payment.findById(id)
      .populate("user_id", "full_name email phone role");

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found"
      });
    }

    // Check access: students can only see their own payments
    if (req.user.role === "student" && payment.user_id._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    return res.status(200).json({
      success: true,
      payment,
      message: "Payment fetched successfully"
    });

  } catch (error) {
    logger.error("GET PAYMENT", error);
    
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid payment ID"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to fetch payment"
    });
  }
};

// Get payment statistics (admin/staff only)
const getPaymentStats = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    // Build match query
    const matchQuery = {};
    if (start_date || end_date) {
      matchQuery.createdAt = {};
      if (start_date) matchQuery.createdAt.$gte = new Date(start_date);
      if (end_date) matchQuery.createdAt.$lte = new Date(end_date);
    }

    // Optimized: Use aggregation pipeline for statistics
    const stats = await Payment.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" }
        }
      }
    ]);

    const totalPayments = await Payment.countDocuments(matchQuery);
    const successfulPayments = await Payment.countDocuments({ ...matchQuery, status: "success" });
    const failedPayments = await Payment.countDocuments({ ...matchQuery, status: "failed" });

    const totalAmountResult = await Payment.aggregate([
      { $match: { ...matchQuery, status: "success" } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        totalPayments,
        successfulPayments,
        failedPayments,
        totalAmount: totalAmountResult[0]?.total || 0,
        breakdown: stats
      },
      message: "Payment statistics fetched successfully"
    });

  } catch (error) {
    logger.error("GET PAYMENT STATS", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch payment statistics"
    });
  }
};

// Update payment (admin/staff only)
const updatePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, status, transaction_id } = req.body;

    const payment = await Payment.findById(id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found"
      });
    }

    // Update fields
    if (amount !== undefined) {
      if (amount <= 0) {
        return res.status(400).json({
          success: false,
          message: "Amount must be greater than 0"
        });
      }
      payment.amount = amount;
    }

    if (status) {
      if (!["success", "failed"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Status must be either 'success' or 'failed'"
        });
      }
      payment.status = status;
    }

    if (transaction_id !== undefined) {
      payment.transaction_id = transaction_id?.trim();
    }

    await payment.save();
    await payment.populate("user_id", "full_name email phone role");

    return res.status(200).json({
      success: true,
      payment,
      message: "Payment updated successfully"
    });

  } catch (error) {
    logger.error("UPDATE PAYMENT", error);
    
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid payment ID"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update payment"
    });
  }
};

// Delete payment (admin only)
const deletePayment = async (req, res) => {
  try {
    const { id } = req.params;

    const payment = await Payment.findByIdAndDelete(id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Payment deleted successfully"
    });

  } catch (error) {
    logger.error("DELETE PAYMENT", error);
    
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid payment ID"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to delete payment"
    });
  }
};

export {
  createPayment,
  getAllPayments,
  getPayment,
  getPaymentStats,
  updatePayment,
  deletePayment
};

