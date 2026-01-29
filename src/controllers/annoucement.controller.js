import mongoose from "mongoose";
import Announcement from "../models/announcement.model.js";
import logger from "../utils/logger.js";
import { deleteMulter } from "../middlewares/multer.middleware.js";

export const createAnnouncement = async (req, res) => {
  try {
    // console.log(req?.body || "undefined")
    const { title, message, notice_url, category } = req.body;

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
    if (category.trim().length > 20) {
      return res.status(400).json({
        success: false,
        message: "category must be atmmost 20 characters long"
      });
    }

    const announcement = await Announcement.create({
      title: title.trim(),
      message: message.trim(),
      notice_url: notice_url?.trim(),
      category: category.trim(),
      created_by: req.user._id
    });

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

export const getAllAnnouncements = async (req, res) => {
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

export const getAnnouncement = async (req, res) => {
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

export const updateAnnouncement = async (req, res) => {
  const { id } = req.params;
  const { title, message, notice_url, category, removedFileIds = [] } = req.body;
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const announcement = await Announcement.findById(id).session(session);

    if (!announcement) {
      throw new Error("Announcement not found");
    }
    // Update fields
    if (title) {
      if (title.trim().length < 3) {
        throw new Error("Title must be at least 3 characters long");
      }
      announcement.title = title.trim();
    }
    if (category) {
      announcement.category = category;
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

    if (removedFileIds.length > 0) {

      //files to be removed from cloudinary
      const filesToRemove = announcement.announcement_files.filter(file => removedFileIds.includes(file._id.toString()));

      //remove from cloudinary
      for (const file of filesToRemove) {
        await deleteMulter(file.public_id, file.file_type);
      }
      //remove from announcement files array
      announcement.announcement_files = announcement.announcement_files.filter(file => !removedFileIds.includes(file._id.toString()));
    }


    await announcement.save({ session });
    await announcement.populate("created_by", "full_name email role");
    await session.commitTransaction();
    return res.status(200).json({
      success: true,
      announcement,
      message: "Announcement updated successfully"
    });

  } catch (error) {
    await session.abortTransaction();
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
  } finally {
    session.endSession();
  }
};

export const uploadAnnouncemnetFiles = async (req, res) => {
  logger.info("UPLOAD ANNOUNCEMENT FILES REQ BODY", req.body);
  try {
    const { id } = req.params;
    logger.info("UPLOAD ANNOUNCEMENT FILES REQ FILES", req.files);
    const announcement = await Announcement.findById(id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found"
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files uploaded"
      });
    }
    const MAX_FILES = 5;
    if (
      (announcement.announcement_files?.length || 0) + req.files.length >
      MAX_FILES
    ) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${MAX_FILES} attachments allowed per announcement`,
      });
    }

    // const filesData = req.files.map(file => ({
    //   url: file.path,
    //   public_id: file.filename,
    //   file_type: file.mimetype.startsWith("image/") ? "image" : "pdf"
    // }));
    const filesData = req.files.map((file) => {
      logger.info(file)
      return {
        url: file.path,
        public_id: file.filename,
        file_type: file.mimetype.startsWith("image/") ? "image" : "pdf",
      };
    });

    announcement.announcement_files.push(...filesData);
    await announcement.save();

    return res.status(200).json({
      success: true,
      files: filesData,
      total_files: announcement.announcement_files.length ?? 0,
      message: "Files uploaded successfully"
    });

  } catch (error) {
    logger.error("UPLOAD ANNOUNCEMENT FILES", error);
    return res.status(500).json({
      success: false,
      message: "Failed to upload files"
    });
  }
}

export const deleteAnnouncement = async (req, res) => {
  const { id } = req.params;
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const announcement = await Announcement.findById(id).session(session);
    if (!announcement) {
      throw new Error("Announcement not found");
    }

    if (announcement.announcement_files.length > 0) {
      for (const file of announcement.announcement_files) {
        await deleteMulter(file.public_id, file.file_type);
      }
    }

    //future: delete comments, likes associated with announcement
    await Announcement.deleteOne({ _id: id }).session(session);
    await session.commitTransaction();
    return res.status(200).json({
      success: true,
      message: "Announcement and associated files deleted successfully"
    });
  } catch (error) {
    logger.error("DELETE ANNOUNCEMENT FILE", error);
    await session.abortTransaction();
    return res.status(500).json({
      success: false,
      message: "Failed to delete announcement file"
    });
  } finally {
    session.endSession();
  }
}