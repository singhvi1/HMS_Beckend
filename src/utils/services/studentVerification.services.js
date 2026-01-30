import cloudinary from "../../config/cloudinary.config.js";
import { deleteMulter } from "../../middlewares/multer.middleware.js";

export const handleProfilePhotoOnVerification = async ({ student, status }) => {
  if (!student.profile_photo?.public_id) return;

  if (status === "VERIFIED") {
    const newPublicId = `HMS/students/${student.sid}/profile`;

    await cloudinary.uploader.rename(
      student.profile_photo.public_id,
      newPublicId,
      { overwrite: true }
    );

    student.profile_photo = {
      public_id: newPublicId,
      url: cloudinary.url(newPublicId),
    };
  }

  if (status === "REJECTED") {
    await deleteMulter(student.profile_photo.public_id);
    student.profile_photo = null;
  }
};

