import Room from "../models/room.model.js";
import logger from "../utils/logger.js";


export const createRoom = async (req, res) => {
  try {
    const { room_number, block, floor, yearly_rent = 75000, capacity = 1 } = req.body;

    if (!room_number || !block) {
      logger.warn("CREATE_ROOM: Validation failed", { body: req.body });

      return res.status(400).json({
        success: false,
        message: "room_number and block  are required"
      });
    }

    const roomExists = await Room.findOne({ block, room_number });

    if (roomExists) {
      logger.warn("CREATE_ROOM: Room already exists", { block, room_number });

      return res.status(409).json({
        success: false,
        message: "Room already exists in this block"
      });
    }

    const room = await Room.create({
      room_number,
      block: block?.toLowerCase(),
      floor,
      capacity,
      yearly_rent,
    });

    logger.info("CREATE_ROOM: Room created", {
      room_id: room._id,
      block,
      room_number
    });

    return res.status(201).json({
      success: true,
      data: room,
    });

  } catch (error) {
    logger.error("CREATE_ROOM: Error creating room", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create room"
    });
  }
};

export const getAllRooms = async (req, res) => {
  try {
    const { block, floor, is_active } = req.query;

    const filter = {};

    if (block) filter.block = block;
    if (floor !== undefined) filter.floor = Number(floor);
    if (is_active !== undefined) filter.is_active = is_active === "true";

    const rooms = await Room.find(filter)
      .populate({
        path: "occupants",
        select: "sid permanent_address guardian_name guardian_contact leaving_date branch",
        populate: {
          path: "user_id",
          select: "full_name email phone role status"
        }
      })
      .sort({ block: 1, room_number: 1 })


    logger.info("GET_ALL_ROOMS: Rooms fetched", {
      count: rooms.length,
      filter
    });

    return res.status(200).json({
      success: true,
      count: rooms.length,
      data: rooms
    });

  } catch (error) {
    logger.error("GET_ALL_ROOMS: Error fetching rooms", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch rooms"
    });
  }
};

export const getRoomById = async (req, res) => {
  try {
    const { id } = req.params;

    const room = await Room.findById(id)
      .populate({
        path: "occupants",
        select: "sid permanent_address guardian_name guardian_contact leaving_date branch",
        populate: {
          path: "user_id",
          select: "full_name email phone role status"
        }

      });

    if (!room) {
      logger.warn("GET_ROOM_BY_ID: Room not found", { room_id: id });

      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    logger.info("GET_ROOM_BY_ID: Room fetched", { room_id: id });

    return res.status(200).json({
      success: true,
      data: room
    });

  } catch (error) {
    logger.error("GET_ROOM_BY_ID: Error fetching room", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch room"
    });
  }
};

export const updateRoom = async (req, res) => {
  try {
    const { id } = req.params;

    const room = await Room.findById(id);

    if (!room) {
      logger.warn("UPDATE_ROOM: Room not found", { room_id: id });

      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    const updatedRoom = await Room.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );

    logger.info("UPDATE_ROOM: Room updated", {
      room_id: id,
      updates: Object.keys(req.body)
    });

    return res.status(200).json({
      success: true,
      data: updatedRoom
    });

  } catch (error) {
    logger.error("UPDATE_ROOM: Error updating room", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update room"
    });
  }
};

export const toggleRoomStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const room = await Room.findById(id);

    if (!room) {
      logger.warn("TOGGLE_ROOM_STATUS: Room not found", { room_id: id });

      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    room.is_active = !room.is_active;
    await room.save();

    logger.info("TOGGLE_ROOM_STATUS: Room status changed", {
      room_id: id,
      is_active: room.is_active
    });

    return res.status(200).json({
      success: true,
      message: `Room is now ${room.is_active ? "active" : "inactive"}`,
      data: room
    });

  } catch (error) {
    logger.error("TOGGLE_ROOM_STATUS: Error toggling room status", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update room status"
    });
  }
};

export const deleteRoom = async (req, res) => {
  try {
    const { id } = req.params;

    const room = await Room.findById(id);

    if (!room) {
      logger.warn("DELETE_ROOM: Room not found", { room_id: id });

      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    await Room.findByIdAndDelete(id);

    logger.info("DELETE_ROOM: Room deleted", { room_id: id });

    return res.status(200).json({
      success: true,
      message: "Room deleted successfully"
    });

  } catch (error) {
    logger.error("DELETE_ROOM: Error deleting room", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete room"
    });
  }
};