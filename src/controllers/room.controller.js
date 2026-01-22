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
      .lean()


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


export const adjustRoomCapacity = async (req, res) => {
  const { action, roomCount } = req.body;
  const maxCapcity = 3;
  if (![-1, +1].includes(action)) {
    return res.status(400).json({
      message: "action of +1/-1 only allowed"
    })
  }
  if (!roomCount || roomCount <= 0) {
    return res.status(400).json({
      message: "RoomCount should be greater than 0"
    })
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();
    // Find Room -> loop -> update

    const rooms = await Room.find(
      {
        filling_order: { $ne: null }
      }).sort({ filling_order: -1 }).limit(roomCount).session(session);

    if (rooms.length === 0) {
      throw new Error("No rooms eligible for capacity adjustment");
    }
    const preview = [];
    for (const room of rooms) {
      const newCapacity = room.capacity + action;

      if (newCapacity > maxCapcity) {
        throw new Error(
          `Cannot increase capacity beyond ${maxCapcity} for room ${room.block}-${room.room_number}`
        );
      }

      if (room?.occupied_count > newCapacity) {
        throw new Error(`Cannot reduce capacity of room ${room.block}-${room.room_number}. ` + `Occupied: ${room?.occupied_count},  Capacity: ${room.capacity}`)
      }

      const newStatus = room.occupied_count === newCapacity ? 'FULL' : "AVAILABLE";

      preview.push({
        room: `${room.block}-${room.room_number}`,
        currentCapacity: room.capacity, newCapacity,
        occupied: room.occupied_count,
        statusAfter: newStatus,
      });
      await Room.updateOne(
        { _id: room._id },
        {
          capacity: newCapacity,
          allocation_status: newStatus,
        },
        { session }
      )
    }
    await session.commitTransaction();

    return res.status(200).json({
      message: "Room capacity action applied successfully",
      action,
      actionOnRoom: rooms.length,
      rooms: preview,
    })

  } catch (error) {
    await session.abortTransaction()
    logger.error("Action for capacity Failed", {
      message: error.message,
      stack: error.stack,
    });

    return res.status(400).json({
      success: false,
      message: "Action for capacity Failed: " + error.message || "Action for capacity Failed"
    });
  } finally {
    session.endSession();
  }
}





