import { Schema, model } from "mongoose";

const studentSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    sid:{
      type: String,
      unique: true,
      required: true,
      minLength: 8,
      maxLength: 8,
    },
    permanent_address:{
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
    room_number:{
      type: Number,
      required: true,
    },
    block:{
      type: String,
      required: true,
      lowercase: true,
    },
    room_out:{
      type: Date,
    }
  },
  {
    timestamps: true
  }
);

const Student = model("Student", studentSchema);
export default Student;