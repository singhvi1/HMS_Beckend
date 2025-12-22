import { Router } from "express";
import { login, logout, getCurrentUser, addUser } from "../controllers/user.controller.js";
import { auth } from "../middlewares/auth.js";
import { authorizeRoles } from "../middlewares/role.auth.js";

const router = Router();

router.post("/register", auth, authorizeRoles("admin", "staff"), addUser);
//NOTE i think here we need to add patch route too to edit info ;
router.post("/login", login);
router.post("/logout", auth, logout);
router.get("/me", auth, getCurrentUser);

export default router;