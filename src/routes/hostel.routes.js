import { Router } from "express";
import { auth } from "../middlewares/auth.js";
import { createHostel, deleteHostel, getAllHostels, getHostelById, toggleHostelStatus, updateHostel } from "../controllers/hostelController.js";
import { authorizeRoles } from "../middlewares/role.auth.js";


const router = Router();

router.post("/", auth, authorizeRoles("admin"), createHostel);

router.get("/", auth, authorizeRoles("admin"), getAllHostels);

router.get("/:id", auth, authorizeRoles("admin"), getHostelById);

router.patch("/:id",auth, authorizeRoles("admin"),  updateHostel);

router.patch("/:id/toggle", auth, authorizeRoles("admin"), toggleHostelStatus);

router.delete("/:id", auth, authorizeRoles("admin"), deleteHostel);

export default router;