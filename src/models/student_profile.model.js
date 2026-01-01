import mongoose from "mongoose";
import { Schema, model } from "mongoose";

const studentSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
      required: true,
      index: true
    },
    room_id: {
      type: Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },
    sid: {
      type: String,
      unique: true,
      required: true,
      minLength: 8,
      maxLength: 8,
    },
    permanent_address: {
      type: String,
      trim: true,
      required: true,
    },
    guardian_name: {
      type: String,
      trim: true
    },
    guardian_contact: {
      type: String,
      required: true,
      minLength: 10,
      maxLength: 10,
    },
    leaving_date: {
      type: Date,
      default: null
    },
    branch: {
      type: String,
      required: true,
      trim: true,
    },
    room_out: {
      type: Date,
    }
  },
  {
    timestamps: true
  }
);

studentSchema.index({
  branch: 1, status: 1, createdAt: -1
});

const Student = model("Student", studentSchema);
export default Student;