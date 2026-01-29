import { Router } from "express";
import { cloudinaryTest } from "../controllers/test.controller.js";
const router = Router();



router.get("/cloudinary-test", cloudinaryTest);

export default router;