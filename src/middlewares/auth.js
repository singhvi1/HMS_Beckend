import User from "../models/user.model.js";
import jwt from "jsonwebtoken";

export const auth = async (req, res, next) => {
  try {
    const token = req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access"
      });
    }

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    let user = await User.findById(decodedToken._id).select("-password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    if (user?.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Account is inactive"
      });
    }
    
    if (user.role == "student") {
      await user?.populate("student", "_id sid branch room_number block")
    }
    if (user.role == "student" && !user.student) {
    return res.status(403).json({
      success: false,
      message: "Student profile not created yet. Contact admin."
    });
  }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Token expired or invalid"
    });
  }
};