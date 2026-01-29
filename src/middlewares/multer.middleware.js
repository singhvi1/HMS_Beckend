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
  { baseFolder, entityId, fileName, maxSizeMB = 3, resourceType = "auto", allowedFormats = [], }) => {


  const storage = new CloudinaryStorage({
    cloudinary,
    params: async () => ({
      folder: `HMS/${baseFolder}/${entityId}`,
      public_id: fileName,
      resource_type: resourceType,
      allowed_formats: allowedFormats.length > 0 ? allowedFormats : ["jpg", "jpeg", "png", "webp"],
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

  const upload = cloudinaryUploader({
    baseFolder: "students",
    entityId: req.params.id,
    fileName: "profile",
  });

  upload.single("file")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });

}
export const announcementGalleryMulter = (req, res, next) => {
  logger.info("IMAGE MULTER MIDDLEWARE", req.body);
  const upload = cloudinaryUploader({
    baseFolder: "announcements",
    entityId: req.params.id,
    resourceType: "image",
    allowedFormats: ["jpg", "jpeg", "png", "webp",],
    maxSizeMB: 10,
  });

  upload.array("files", 5)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
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
      const message =
        err.message.includes("Invalid image file") ||
          err.message.includes("Invalid format")
          ? "Only PDF files are allowed"
          : err.message;
      logger.error(message);
      return res.status(400).json({ error: message || "not able to upload image" });
    }

    next();
  });
};


