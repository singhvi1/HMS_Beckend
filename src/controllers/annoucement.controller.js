import Announcement from "../models/announcement.model.js";
import logger from "../utils/logger.js";

// Create announcement (admin/staff only)
const createAnnouncement = async (req, res) => {
  try {
    const { title, message, notice_url, category } = req.body;

    // Validation
    if (!title || !message || !category) {
      return res.status(400).json({
        success: false,
        message: "Title and message with category are required"
      });
    }

    if (title.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: "Title must be at least 3 characters long"
      });
    }

    if (message.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: "Message must be at least 10 characters long"
      });
    }
    if (category.trim().length > 10) {
      return res.status(400).json({
        success: false,
        message: "category must be atmmost 10 characters long"
      });
    }

    const announcement = await Announcement.create({
      title: title.trim(),
      message: message.trim(),
      notice_url: notice_url?.trim(),
      category: category.trim(),
      created_by: req.user._id
    });

    // Populate creator details (optimized - single populate call)
    await announcement.populate("created_by", "full_name email role");

    return res.status(201).json({
      success: true,
      announcement,
      message: "Announcement created successfully"
    });

  } catch (error) {
    logger.error("CREATE ANNOUNCEMENT", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create announcement"
    });
  }
};

const getAllAnnouncements = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {};
    if (search) {
      query.$or = [
        { title: new RegExp(search, "i") },
        { message: new RegExp(search, "i") }
      ];
    }

    const announcements = await Announcement.find(query)
      .populate("created_by", "full_name email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Announcement.countDocuments(query);

    return res.status(200).json({
      success: true,
      announcements,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      message: "Announcements fetched successfully"
    });

  } catch (error) {
    logger.error("GET ALL ANNOUNCEMENTS", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch announcements"
    });
  }
};

// Get single announcement
const getAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;

    const announcement = await Announcement.findById(id)
      .populate("created_by", "full_name email role");

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found"
      });
    }

    return res.status(200).json({
      success: true,
      announcement,
      message: "Announcement fetched successfully"
    });

  } catch (error) {
    logger.error("GET ANNOUNCEMENT", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid announcement ID"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to fetch announcement"
    });
  }
};

// Update/create announcement (admin/staff only, or creator)
const updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, message, notice_url, category } = req.body;

    const announcement = await Announcement.findById(id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found"
      });
    }
    // Update fields
    if (title) {
      if (title.trim().length < 3) {
        return res.status(400).json({
          success: false,
          message: "Title must be at least 3 characters long"
        });
      }
      announcement.title = title.trim();
    }
    if(category){
      announcement.category=category;
    }
    if (message) {
      if (message.trim().length < 10) {
        return res.status(400).json({
          success: false,
          message: "Message must be at least 10 characters long"
        });
      }
      announcement.message = message.trim();
    }

    if (notice_url !== undefined) {
      announcement.notice_url = notice_url?.trim();
    }

    await announcement.save();
    await announcement.populate("created_by", "full_name email role");

    return res.status(200).json({
      success: true,
      announcement,
      message: "Announcement updated successfully"
    });

  } catch (error) {
    logger.error("UPDATE ANNOUNCEMENT", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid announcement ID"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update announcement"
    });
  }
};

// Delete announcement (admin/staff only, or creator)
const deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;

    const announcement = await Announcement.findById(id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found"
      });
    }
    await Announcement.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Announcement deleted successfully"
    });

  } catch (error) {
    logger.error("DELETE ANNOUNCEMENT", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid announcement ID"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to delete announcement"
    });
  }
};

export {
  createAnnouncement,
  getAllAnnouncements,
  getAnnouncement,
  updateAnnouncement,
  deleteAnnouncement
};

