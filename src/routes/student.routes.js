import { Router } from "express";
import { auth } from "../middlewares/auth.js";
import { authorizeRoles } from "../middlewares/role.auth.js";
import {
  createStudentProfile, getStudentProfile, getAllStudents, updateStudentProfile, deleteStudentProfile, createUserStudent, toggleStudentStatus, downloadStudentDocument, uploadStudentProfilePhoto,
} from "../controllers/student_profile.controller.js";
import { studentMulter } from "../middlewares/multer.middleware.js";

const router = Router();

router.post("/", auth, authorizeRoles("admin", "staff"), createStudentProfile);//future sutdent only 

//create user + student with old / new room   
router.post("/create", auth, authorizeRoles("admin", "staff"), studentMulter, createUserStudent);

router.post("/upload/profile/:id", auth,
  studentMulter, uploadStudentProfilePhoto
);


router.patch("/:user_id", auth, updateStudentProfile);

router.patch("/edit/:user_id", auth, authorizeRoles("admin", "staff"), updateStudentProfile,);

router.patch("/status/:user_id", auth, authorizeRoles("admin", "staff"), toggleStudentStatus);

router.delete("/:user_id", auth, authorizeRoles("admin"), deleteStudentProfile);





router.get("/getall", auth, authorizeRoles("admin", "staff"), getAllStudents);

router.get("/profile", auth, getStudentProfile);

router.get("/profile/:id", auth, authorizeRoles("admin", "staff"), getStudentProfile);

router.get("/document/:user_id", auth, downloadStudentDocument);



export default router;

