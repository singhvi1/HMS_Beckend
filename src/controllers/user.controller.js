import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import logger from "../utils/logger.js";
import Student from "../models/student_profile.model.js";
import Room from "../models/room.model.js";
import Issue from "../models/issue.model.js";

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide all the necessary details"
      });
    }

    // Find user with email only (optimized - single DB call)
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // Check if user is active
    if (user.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Account is inactive. Please contact administrator"
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // Generate token
    const accessToken = user.generateAccessToken();

    // Sanitize user object
    const sanitizedUser = user.toObject();
    delete sanitizedUser.password;

    return res
      .cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: true,
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24)
      })
      .status(200)
      .json({
        success: true,
        user: sanitizedUser,
        message: "User logged in successfully"
      });

  } catch (error) {
    logger.error("Login failed", error);
    return res.status(500).json({
      success: false,
      message: "Login failed"
    });
  }
};

export const logout = async (_req, res) => {
  try {
    return res
      .clearCookie("accessToken", {
        httpOnly: true,
      })
      .status(200)
      .json({
        success: true,
        message: "User logged out successfully"
      });
  } catch (error) {
    logger.error("Logout failed", error);
    return res.status(500).json({
      success: false,
      message: "Logout failed"
    });
  }
};

export const addUser = async (req, res) => {
  try {
    const { full_name, email, phone, password, role } = req.body;

    // Validation
    if (!full_name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided"
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format"
      });
    }

    // Phone validation
    if (phone.length > 10 || !/^\d+$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Phone number must be equal to 10 digits"
      });
    }

    // Password validation
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long"
      });
    }

    // Role validation
    const validRoles = ["student", "admin", "staff"];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role. Must be one of: student, admin, staff"
      });
    }

    const existingUser = await User.findOne({
      $or: [{ email }, { phone }]
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: existingUser.email === email
          ? "User with this email already exists"
          : "User with this phone number already exists"
      });
    }

    // Hash password and create user
    const hashedPassword = await bcrypt.hash(password, 10);


    const user = await User.create({
      full_name: full_name.trim(),
      email: email.toLowerCase().trim(),
      phone,
      password: hashedPassword,
      role: role || "student"
    });

    const sanitizedUser = user.toObject();
    delete sanitizedUser.password;

    return res.status(201).json({
      success: true,
      user: sanitizedUser,
      message: "User added successfully"
    });

  } catch (error) {
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
};

export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password").populate("student");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    return res.status(200).json({
      success: true,
      user,
      message: "User fetched successfully"
    });
  } catch (error) {
    logger.error("Failed to fetch user", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user"
    });
  }
};
export const getQuickInfo = async (req, res) => {
  try {
    const [totalStudents, totalRooms, activeRooms, pendingIssues,] = await Promise.all([
      Student.countDocuments(),
      Room.countDocuments(),
      Room.countDocuments({ is_active: true }),
      Issue.countDocuments({ status: "pending" }),
    ])
    res.json({
      success: true,
      data: {
        totalStudents,
        totalRooms,
        activeRooms,
        pendingIssues,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false });
  }
}