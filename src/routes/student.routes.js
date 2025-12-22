import { Router } from "express";
import { auth } from "../middlewares/auth.js";
import { authorizeRoles } from "../middlewares/role.auth.js";
import {
  createStudentProfile,
  getStudentProfile,
  getAllStudents,
  updateStudentProfile,
  deleteStudentProfile
} from "../controllers/student_profile.controller.js";

const router = Router();

// Create student profile (student only)
router.post("/create", auth, authorizeRoles("admin", "staff"), createStudentProfile);

// Get all students (admin/staff only) - must come before /:user_id
router.get("/getall", auth, authorizeRoles("admin", "staff"), getAllStudents);

// Get own profile (student) - specific route to avoid conflicts
router.get("/profile", auth, getStudentProfile );

// Get specific profile by user_id (admin/staff) or own profile
router.get("/profile/:user_id", auth, authorizeRoles("admin","staff") , getStudentProfile);

// Update student profile by student(not all) and Admin/staff(all info)
router.patch("/:user_id", auth, updateStudentProfile);

router.patch("/edit/:user_id", auth,authorizeRoles("admin","staff"), updateStudentProfile,);

// Delete student profile (admin only)
router.delete("/:user_id", auth, authorizeRoles("admin"), deleteStudentProfile);

export default router;

