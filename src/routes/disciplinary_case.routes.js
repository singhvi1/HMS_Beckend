import { Router } from "express";
import { auth } from "../middlewares/auth.js";
import { authorizeRoles } from "../middlewares/role.auth.js";
import {
  createDisciplinaryCase,
  getAllDisciplinaryCases,
  getDisciplinaryCase,
  updateDisciplinaryCase,
  deleteDisciplinaryCase
} from "../controllers/disciplinary_case.controller.js";

const router = Router();

// Create disciplinary case (admin/staff only)
router.post("/", auth, authorizeRoles("admin", "staff"), createDisciplinaryCase);

// Get all disciplinary cases
router.get("/", auth, getAllDisciplinaryCases);

// Get single disciplinary case
router.get("/:id", auth, getDisciplinaryCase);

// Update disciplinary case (admin/staff only)
router.patch("/:id", auth, authorizeRoles("admin", "staff"), updateDisciplinaryCase);

// Delete disciplinary case (admin only)
router.delete("/:id", auth, authorizeRoles("admin"), deleteDisciplinaryCase);

export default router;

