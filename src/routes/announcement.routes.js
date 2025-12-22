import { Router } from "express";
import { auth } from "../middlewares/auth.js";
import { authorizeRoles } from "../middlewares/role.auth.js";
import {
  createAnnouncement,
  getAllAnnouncements,
  getAnnouncement,
  updateAnnouncement,
  deleteAnnouncement
} from "../controllers/annoucement.controller.js";

const router = Router();

// Create announcement (admin/staff only)
router.post("/", auth, authorizeRoles("admin", "staff"), createAnnouncement);

// Get all announcements (all logedin users)
router.get("/", auth, getAllAnnouncements);

// Get single announcement (all logined users)
router.get("/:id", auth,getAnnouncement);

// Update announcement (admin/staff or creator)
router.patch("/:id", auth,authorizeRoles("admin","staff"), updateAnnouncement);

// Delete announcement (admin/staff or creator)
router.delete("/:id", auth,authorizeRoles("admin","staff"), deleteAnnouncement);

export default router;

