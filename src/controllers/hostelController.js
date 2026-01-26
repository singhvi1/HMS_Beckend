import Hostel from "../models/hostel.model.js";
import logger from "../utils/logger.js";

export const createHostel = async (req, res) => {
  try {
    const { name, code, blocks, floors_per_block, rooms_per_floor, total_rooms } = req.body;
    const normalizedBlocks = blocks.map(
      (block) => block.toLowerCase()
    );
    if (
      !name ||
      !code ||
      !Array.isArray(blocks) ||
      blocks.length === 0 ||
      !floors_per_block ||
      !rooms_per_floor ||
      !total_rooms
    ) {
      logger.warn("CREATE_HOSTEL: Validation failed", { body: req.body });

      return res.status(400).json({
        success: false,
        message: "All hostel fields are required"
      });
    }

    const existingHostel = await Hostel.findOne({ code });

    if (existingHostel) {
      logger.warn("CREATE_HOSTEL: Hostel already exists", { code });

      return res.status(409).json({
        success: false,
        message: "Hostel with this code already exists"
      });
    }

    const hostel = await Hostel.create({
      name,
      code,
      blocks: normalizedBlocks,
      floors_per_block,
      rooms_per_floor,
      total_rooms: Number(total_rooms)
    });

    logger.info("CREATE_HOSTEL: Hostel created successfully", {
      hostel_id: hostel._id,
      code: hostel?.code
    });

    return res.status(201).json({
      success: true,
      data: hostel
    });

  } catch (error) {
    logger.error("CREATE_HOSTEL: Error creating hostel", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create hostel"
    });
  }
};

// no use right now 
export const getAllHostels = async (_req, res) => {
  try {
    const hostels = await Hostel.find();

    logger.info("GET_ALL_HOSTELS: Fetched hostels", {
      count: hostels.length
    });

    return res.status(200).json({
      success: true,
      count: hostels.length,
      data: hostels
    });

  } catch (error) {
    logger.error("GET_ALL_HOSTELS: Error fetching hostels", error);

    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to fetch hostels"
    });
  }
};


export const getHostelById = async (req, res) => {
  try {
    const { id } = req.params;

    const hostel = await Hostel.findById(id);
    if (!hostel) {
      logger.warn("GET_HOSTEL_BY_ID: Hostel not found", { hostel_id: id });

      return res.status(404).json({
        success: false,
        message: "Hostel not found"
      });
    }

    logger.info("GET_HOSTEL_BY_ID: Hostel fetched", { hostel_id: id });

    return res.status(200).json({
      success: true,
      data: hostel
    });

  } catch (error) {
    logger.error("GET_HOSTEL_BY_ID: Error fetching hostel", error);

    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to fetch hostel"
    });
  }
};

//updateHostel
export const updateHostel = async (req, res) => {
  try {
    const { id } = req.params;

    const hostel = await Hostel.findById(id);

    if (!hostel) {
      logger.warn("UPDATE_HOSTEL: Hostel not found", { hostel_id: id });

      return res.status(404).json({
        success: false,
        message: "Hostel not found"
      });
    }
    const allowedUpdates = [
      "name",
      "blocks",
      "floors_per_block",
      "rooms_per_floor"
    ];

    const updates = {};
    allowedUpdates.forEach((key) => {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    });

    const updatedHostel = await Hostel.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    );

    logger.info("UPDATE_HOSTEL: Hostel updated", {
      hostel_id: id,
      updates: Object.keys(req.body)
    });

    return res.status(200).json({
      success: true,
      data: updatedHostel
    });

  } catch (error) {
    logger.error("UPDATE_HOSTEL: Error updating hostel", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update hostel"
    });
  }
};

export const toggleHostelStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const hostel = await Hostel.findById(id);

    if (!hostel) {
      logger.warn("TOGGLE_HOSTEL_STATUS: Hostel not found", { hostel_id: id });

      return res.status(404).json({
        success: false,
        message: "Hostel not found"
      });
    }

    hostel.is_active = !hostel.is_active;
    await hostel.save();

    logger.info("TOGGLE_HOSTEL_STATUS: Hostel status changed", {
      hostel_id: id,
      is_active: hostel.is_active
    });

    return res.status(200).json({
      success: true,
      message: `Hostel is now ${hostel.is_active ? "active" : "inactive"}`,
      data: hostel
    });

  } catch (error) {
    logger.error("TOGGLE_HOSTEL_STATUS: Error toggling status", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update hostel status"
    });
  }
};

export const deleteHostel = async (req, res) => {

  try {
    const { id } = req.params;

    const hostel = await Hostel.findById(id);

    if (!hostel) {
      logger.warn("DELETE_HOSTEL: Hostel not found", { hostel_id: id });

      return res.status(404).json({
        success: false,
        message: "Hostel not found"
      });
    }

    await Hostel.findByIdAndDelete(id);

    logger.info("DELETE_HOSTEL: Hostel deleted", { hostel_id: id });

    return res.status(200).json({
      success: true,
      message: "Hostel deleted successfully"
    });

  } catch (error) {
    logger.error("DELETE_HOSTEL: Error deleting hostel", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete hostel"
    });
  }
};

//allotment
export const toggleAllotment = async (req, res) => {

  try {
    const { id } = req.params;
    const { allotment_status } = req.body;

    if (!["CLOSED", "PHASE_A", "PHASE_B"].includes(allotment_status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid allotment status"
      })
    };
    const hostel = await Hostel.findById(id);

    if (!hostel) {
      logger.warn("TOGGLE_ALLOTMENT: Hostel not found", { hostel_id: id });

      return res.status(404).json({
        success: false,
        message: "Hostel not found",
      });
    }
    const currentStatus = hostel.allotment_status;
    const allowedNextStates = {
      CLOSED: ["PHASE_A"],
      PHASE_A: ["PHASE_B", "CLOSED"],
      PHASE_B: ["CLOSED"]
    };
    if (!allowedNextStates[currentStatus].includes(allotment_status)) {
      return res.status(409).json({
        success: false,
        message: `Invalid transition from ${currentStatus} to ${allotment_status}`
      });
    }
    hostel.allotment_status = allotment_status;
    await hostel.save();

    logger.info("TOGGLE_ALLOTMENT: Allotment status changed", {
      hostel_id: id,
      allotment: hostel.allotment,
    });

    return res.status(200).json({
      success: true,
      message: `Allotment moved from ${currentStatus} → ${allotment_status}`,
      data: { allotment_status, id }
    });
  } catch (error) {
    logger.error("TOGGLE_ALLOTMENT: Error toggling allotment", error);

    return res.status(500).json({
      success: false,
      message: "Failed to toggle allotment",
    });
  }
};