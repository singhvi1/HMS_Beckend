import { Router } from "express";
import { getAllotmentQuickInfo, getMyAllotmentStatus, getPhaseARooms, getRoomById, getVerificationRequests, phaseARegisterStudent, phaseBRegisterStudent, verifyStudentAndAllocate, toggleAllotment, getAllotmentStatus, adjustRoomCapacity } from "../controllers/allotment.controllers.js";
import { authorizeRoles } from "../middlewares/role.auth.js";
import { auth } from "../middlewares/auth.js"


const router = Router();

router.get('/quickInfo', getAllotmentQuickInfo);
router.get('/rooms', getPhaseARooms);
router.get("/room/:roomId", getRoomById)

router.get('/status/me', auth, getMyAllotmentStatus);
router.get('/status', getAllotmentStatus);

router.get('/verification-requests', auth, authorizeRoles("admin"), getVerificationRequests)


router.post("/phase-a/register", phaseARegisterStudent)
router.post("/phase-b/register", phaseBRegisterStudent)


router.patch("/capacity", auth, authorizeRoles("admin"), adjustRoomCapacity);
router.patch("/:studentUserId/verify", auth, authorizeRoles("admin"), verifyStudentAndAllocate);
router.patch("/toggle", authorizeRoles("admin"), toggleAllotment)

export default router;