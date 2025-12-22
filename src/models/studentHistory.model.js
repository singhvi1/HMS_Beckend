// models/studentHistory.model.js
import mongoose from "mongoose";

const studentHistorySchema = new mongoose.Schema({
  student_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true
  },
  updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  old_data: {
    type: Object,
    required: true
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model("StudentHistory", studentHistorySchema);
