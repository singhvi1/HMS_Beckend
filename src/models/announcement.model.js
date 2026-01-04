import mongoose, { Schema } from "mongoose";

const announcementSchema = new Schema({
  title: {
    type: String,
    required: true
  },
  notice_url: {
    type: String,
  },
  image: {
    type: [String],
    default: ["https://static.vecteezy.com/system/resources/previews/047/627/512/non_2x/document-file-icon-for-office-administration-and-paperwork-management-vector.jpg"]
  },
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