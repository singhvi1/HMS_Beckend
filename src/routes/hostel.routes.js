import { Router } from "express";
import { auth } from "../middlewares/auth.js";
import { createHostel, deleteHostel, getAllHostels, getHostelById, toggleAllotment, toggleHostelStatus, updateHostel } from "../controllers/hostelController.js";
import { authorizeRoles } from "../middlewares/role.auth.js";


const router = Router();

router.post("/", auth, authorizeRoles("admin"), createHostel);

router.get("/", getAllHostels);
// router.get("/", auth, authorizeRoles("admin"), getAllHostels);

router.post("/:id/allotment", auth, authorizeRoles("admin"), toggleAllotment);

router.patch("/:id/toggle", auth, authorizeRoles("admin"), toggleHostelStatus);

router.get("/:id", auth, authorizeRoles("admin"), getHostelById);

router.patch("/:id", auth, authorizeRoles("admin"), updateHostel);


router.delete("/:id", auth, authorizeRoles("admin"), deleteHostel);

export default router;