import mongoose, {Schema} from "mongoose";

const announcementSchema = new Schema({
  title: {
    type: String,
    required: true
  },
  notice_url: {
    type: String,
  },
  message: {
    type: String,
    required: true
  },
  created_by: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
}, { timestamps: true });

const Announcement = mongoose.model("Announcement", announcementSchema);

export default Announcement;