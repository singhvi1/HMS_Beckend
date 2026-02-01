import { Router } from "express";
import { auth } from "../middlewares/auth.js";
import { authorizeRoles } from "../middlewares/role.auth.js";
import {
  createStudentProfile, getStudentProfile, getAllStudents, updateStudentProfile, deleteStudentProfile, createUserStudent, toggleStudentStatus, downloadStudentDocument, uploadStudentProfilePhoto,
  exportAccountantExcel,
  exportStudentWiseExcel,
  exportRoomWiseExcel,
  exportAllotmentExcel,
} from "../controllers/student_profile.controller.js";
import { studentMulter } from "../middlewares/multer.middleware.js";

const router = Router();

router.post("/", auth, authorizeRoles("admin", "staff"), createStudentProfile);//future sutdent only 

//create user + student with old / new room   
router.post("/create", auth, authorizeRoles("admin", "staff"), studentMulter, createUserStudent);

router.post("/upload/profile/:userId", auth,
  studentMulter, uploadStudentProfilePhoto
);


router.patch("/:user_id", auth, studentMulter, updateStudentProfile);

router.patch("/edit/:user_id", auth, authorizeRoles("admin", "staff"), studentMulter, updateStudentProfile,);

router.patch("/status/:user_id", auth, authorizeRoles("admin", "staff"), toggleStudentStatus);

router.delete("/:user_id", auth, authorizeRoles("admin"), deleteStudentProfile);





router.get("/getall", auth, authorizeRoles("admin", "staff"), getAllStudents);

router.get("/profile", auth, getStudentProfile);

router.get("/profile/:id", auth, authorizeRoles("admin", "staff"), getStudentProfile);

router.get("/document/:user_id", auth, downloadStudentDocument);

router.get("/export/accountant", auth, authorizeRoles("admin", "staff"), exportAccountantExcel);

router.get("/export/studentwise", auth, authorizeRoles("admin", "staff"), exportStudentWiseExcel);

router.get("/export/roomwise", auth, authorizeRoles("admin", "staff"), exportRoomWiseExcel);

router.get("/export/allotment", auth, authorizeRoles("admin", "staff"), exportAllotmentExcel);


export default router;

