import { Router } from "express";
import { auth } from "../middlewares/auth.js";
import { authorizeRoles } from "../middlewares/role.auth.js";
import {
  createAnnouncement,
  getAllAnnouncements,
  getAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  uploadAnnouncemnetFiles
} from "../controllers/annoucement.controller.js";
import { announcementGalleryMulter, announcementPdfsMulter } from "../middlewares/multer.middleware.js";

const router = Router();

router.post("/", auth, authorizeRoles("admin", "staff"), createAnnouncement);

router.post("/upload/images/:id", auth, authorizeRoles("admin", "staff"),
  announcementGalleryMulter, uploadAnnouncemnetFiles
);
router.post("/upload/pdfs/:id", auth, authorizeRoles("admin", "staff"),
  announcementPdfsMulter, uploadAnnouncemnetFiles
);


router.get("/", auth, getAllAnnouncements);

router.get("/:id", auth, getAnnouncement);


router.patch("/:id", auth, authorizeRoles("admin", "staff"), updateAnnouncement);


router.delete("/:id", auth, authorizeRoles("admin", "staff"), deleteAnnouncement);

export default router;

