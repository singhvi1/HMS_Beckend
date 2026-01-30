import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.config.js";
import logger from "../utils/logger.js";

/**
 * Generic Cloudinary uploader
 * @param {String} baseFolder  e.g. "students", "staff", "announcements"
 * @param {String} entityId    MongoDB _id
 * @param {String} fileName   profile | aadhaar | notice | image | pdf
 */


export const cloudinaryUploader = (
  { baseFolder, entityId, fileName = null, maxSizeMB = 3, resourceType = "auto", allowedFormats = [], }) => {


  const storage = new CloudinaryStorage({
    cloudinary,
    params: async () => ({
      folder: `HMS/${baseFolder}/${entityId}`,
      public_id: fileName || undefined,
      resource_type: resourceType,
      allowed_formats: allowedFormats.length > 0 ? allowedFormats : ["jpg", "jpeg", "png", "webp"],
      tags: ["temp", baseFolder],
    }),
  });

  return multer({
    storage,
    limits: {
      fileSize: maxSizeMB * 1024 * 1024,
    },
  });
};


export const deleteMulter = async (public_id, resource_type = "image") => {
  if (!public_id) return;

  const result = await cloudinary.uploader.destroy(public_id, {
    resource_type: resource_type,
  });
  logger.info("CLOUDINARY DELETE RESULT", result);
  if (result.result !== "ok" && result.result !== "not found") {
    throw new Error(`Cloudinary delete failed: ${public_id}`);
  }
  return result;
};

export const studentMulter = (req, res, next) => {
  logger.info("STUDENT MULTER MIDDLEWARE", req.file);
  const upload = cloudinaryUploader({
    baseFolder: "students",
    entityId: "Temp",
    fileName: "profile",
    resourceType: "image",
    allowedFormats: ["jpg", "jpeg", "png", "webp"],
    maxSizeMB: 3,
  });

  upload.single("file")(req, res, (err) => {
    if (err) {
      logger.error("STUDENT MULTER ERROR", err.message);
      err.statusCode = 400;
      err.source = "STUDENT_MULTER";
      return next(err);
    }
    if (req.file) {
      req.uploadedFile = {
        public_id: req.file.filename,
        url: req.file.path,
      };
    }
    logger.info("STUDENT MULTER FILE", req.file);
    next();
  });
}
export const announcementGalleryMulter = (req, res, next) => {
  logger.info("IMAGE MULTER MIDDLEWARE", req.body);
  const upload = cloudinaryUploader({
    baseFolder: "announcements",
    entityId: req.params.id ?? "unknown_id",
    resourceType: "image",
    allowedFormats: ["jpg", "jpeg", "png", "webp",],
    maxSizeMB: 10,
  });

  upload.array("files", 5)(req, res, (err) => {
    if (err) {
      logger.error("ANNOUNCEMENT GALLERY MULTER ERROR", err.message);
      err.statusCode = 400;
      err.source = "ANNOUNCEMENT_GALLERY";
      return next(err);
    }
    next();
  });

};

export const announcementPdfsMulter = (req, res, next) => {
  logger.info("PDF MULTER MIDDLEWARE", req.body);
  const upload = cloudinaryUploader({
    baseFolder: "announcements",
    entityId: req.params.id,
    resourceType: "raw",
    fileName: "file.pdf",
    allowedFormats: ["pdf"],
    maxSizeMB: 10,
  });
  upload.array("files", 5)(req, res, (err) => {
    if (err) {
      err.statusCode = 400;
      err.source = "ANNOUNCEMENT_PDFS";
      const message =
        err.message.includes("Invalid image file") ||
          err.message.includes("Invalid format")
          ? "Only PDF files are allowed"
          : err.message;
      logger.error(message);
      return next(err);
    }

    next();
  });
};


