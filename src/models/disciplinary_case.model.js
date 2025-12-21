import mongoose, { Schema } from "mongoose";

const disciplinarySchema = new Schema({
  student_id: {
    type: Schema.Types.ObjectId,
    ref: "Student",
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  fine_amount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ["open", "closed"],
    default: "open"
  },
  decided_by: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  }
}, { timestamps: true });

const Disciplinary = mongoose.model("Disciplinary", disciplinarySchema);

export default Disciplinary;