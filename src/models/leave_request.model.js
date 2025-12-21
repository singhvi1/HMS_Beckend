import mongoose, { Schema } from "mongoose";

const leaveRequestSchema = new Schema({
  student_id: {
    type: Schema.Types.ObjectId,
    ref: "Student",
    required: true
  },
  from_date: {
    type: Date,
    required: true
  },
  to_date: {
    type: Date,
    required: true
  },
  destination: {
    type: String,
    trim: true
  },
  reason: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending"
  },
  approved_by: {
    type: Schema.Types.ObjectId,
    ref: "User",
  }
}, { timestamps: true });

const LeaveRequest = mongoose.model("LeaveRequest", leaveRequestSchema);

export default LeaveRequest;