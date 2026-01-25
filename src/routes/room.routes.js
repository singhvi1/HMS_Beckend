import { Router } from "express";
import { adjustRoomCapacity, createRoom, deleteRoom, getAllRooms, getRoomById, toggleRoomStatus, updateRoom } from "../controllers/room.controller.js";
import { auth } from "../middlewares/auth.js";
import { authorizeRoles } from "../middlewares/role.auth.js";



const router = Router();


router.get("/", auth, authorizeRoles("admin"), getAllRooms);

router.get("/:id", auth, authorizeRoles("admin"), getRoomById);

router.post("/", auth, authorizeRoles("admin"), createRoom);

router.patch("/adjust-capacity", auth, authorizeRoles("admin"), adjustRoomCapacity)

router.patch("/:id", auth, authorizeRoles("admin"), updateRoom);

router.patch("/:id/toggle", auth, authorizeRoles("admin"), toggleRoomStatus);

router.delete("/:id", auth, authorizeRoles("admin"), deleteRoom);








export default router;