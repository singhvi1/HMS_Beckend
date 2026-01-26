import { Router } from "express";
import { auth } from "../middlewares/auth.js";
import { authorizeRoles } from "../middlewares/role.auth.js";
import {
  createStudentProfile,
  getStudentProfile,
  getAllStudents,
  updateStudentProfile,
  deleteStudentProfile,
  createUserStudent,
  toggleStudentStatus,
  downloadStudentDocument,

} from "../controllers/student_profile.controller.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

router.post("/", auth, upload.single("file"), authorizeRoles("admin", "staff"), createStudentProfile);

//create user + student with room 
router.post("/create", auth, upload.single("file"), authorizeRoles("admin", "staff"), createUserStudent);

router.get("/getall", auth, authorizeRoles("admin", "staff"), getAllStudents);
router.get("/profile", auth, getStudentProfile);
router.get("/profile/:id", auth, authorizeRoles("admin", "staff"), getStudentProfile);

// Update student profile by student(not all) and Admin/staff(all info)
router.patch("/:user_id", auth, updateStudentProfile);

router.patch("/edit/:user_id", auth, authorizeRoles("admin", "staff"), updateStudentProfile,);

router.patch("/status/:user_id", auth, authorizeRoles("admin", "staff"), toggleStudentStatus);

router.get("/document/:user_id", auth, downloadStudentDocument);

router.delete("/:user_id", auth, authorizeRoles("admin"), deleteStudentProfile);


//allotment: 

// router.get("/room/:roomId", getRoomById)
// router.get("/rooms/phase-a", getPhaseARooms)
// router.post("/phase-a/register", phaseARegisterStudent)
// router.post("/phase-b/register", phaseBRegisterStudent)
// router.get("/allotment-status", auth, getMyAllotmentStatus)


// router.patch("/:studentUserId/verify", authorizeRoles("admin"), verifyStudentAndAllocate)
// router.get('/verification-request', authorizeRoles("admin"), getVerificationRequests)


export default router;

