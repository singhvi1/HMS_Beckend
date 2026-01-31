import cloudinary from "../../config/cloudinary.config.js";
import { deleteMulter } from "../../middlewares/multer.middleware.js";
import logger from "../logger.js";

export const handleProfilePhotoOnVerification = async ({ student, status }) => {
  if (!student.profile_photo?.public_id) return;

  const oldPublicId = student.profile_photo.public_id;
  let newPublicId;

  try {
    if (status === "VERIFIED") {
      newPublicId = `HMS/students/${student.sid}/profile`;
      logger.time("CLOUDINARY RENAME TIME 01");
      const renamed = await cloudinary.uploader.rename(
        oldPublicId,
        newPublicId,
        { overwrite: true, invalidate: true }
      );
      logger.info("CLOUDINARY RENAME RESULT", renamed);
      logger.timeEnd("CLOUDINARY RENAME TIME 01");

      logger.time("CLOUDINARY UPDATE TIME 02");
      await cloudinary.api.update(newPublicId, {
        asset_folder: `HMS/students/${student.sid}`,
      });
      logger.timeEnd("CLOUDINARY UPDATE TIME 02");

      logger.time("CLOUDINARY REMOVE TAG TIME 03");
      await cloudinary.uploader.remove_tag("temp", [newPublicId]);
      logger.timeEnd("CLOUDINARY REMOVE TAG TIME 03");

      student.profile_photo = {
        public_id: newPublicId,
        url: renamed.secure_url,
      };
    }

    else if (status === "REJECTED") {
      await deleteMulter(oldPublicId);
      student.profile_photo = null;
    }

  } catch (err) {
    if (newPublicId) {
      await cloudinary.uploader.rename(
        newPublicId,
        oldPublicId,
        { overwrite: true }
      );
    }
    throw err;
  }
};

