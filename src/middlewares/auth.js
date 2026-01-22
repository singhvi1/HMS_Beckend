import User from "../models/user.model.js";
import jwt from "jsonwebtoken";

export const auth = async (req, res, next) => {
  const istTimestamp = () =>
    new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
      hour12: false,
    });

  console.log("AUTH HIT:", req.method, req.originalUrl, istTimestamp());

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
      await user.populate("student", "_id")

      if (!user.student) {
        return res.status(403).json({
          success: false,
          message: "Student profile not created yet. Contact admin."
        });
      }
      req.studentId = user.student._id;
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