import mongoose, { Schema } from "mongoose";

const announcementSchema = new Schema({
  title: {
    type: String,
    required: true
  },
  notice_url: {
    type: String,
  },
  announcement_files: [
    {
      url: String,
      public_id: String,
      file_type: {
        type: String,
        enum: ["image", "pdf"],
      },
    },
  ],


  message: {
    type: String,
    required: true
  },

  category: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },

  created_by: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
}, { timestamps: true });
announcementSchema.index({ created_by: 1, createdAt: -1 });
const Announcement = mongoose.model("Announcement", announcementSchema);

export default Announcement;