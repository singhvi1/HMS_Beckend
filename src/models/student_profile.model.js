import mongoose from "mongoose";
import { Schema, model } from "mongoose";
import Room from "./room.model.js";
import Issue from "./issue.model.js";
import Leave from "./leave_request.model.js";
import IssueComment from "./issue_comment.model.js";


const studentSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
      required: true,
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
    block: {
      type: String,
      index: true,
      lowercase: true,
    },
    room_number: {
      type: String,
      index: true
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

studentSchema.index({ branch: 1, createdAt: -1 });

studentSchema.pre("save", async function () {
  try {
    if (!this.isNew && !this.isModified("room_id")) return;

    if (!this.room_id) {
      throw new Error("room_id is required");
    }
    const session = this.$session();
    const room = await Room
      .findById(this.room_id)
      .select("block room_number")
      .session(session);

    if (!room) {
      throw new Error("Invalid room_id in preHook");
    }
    this.block = room?.block;
    this.room_number = room?.room_number;
  } catch (err) {
    throw err;
  }
});
studentSchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate();
  if (!update?.room_id) return next();

  const session = this.getOptions().session;

  const room = await Room
    .findById(update.room_id)
    .select("block room_number")
    .session(session);

  if (!room) {
    return next(new Error("Invalid room_id"));
  }

  update.block = room.block;
  update.room_number = room.room_number;
  next();
});


studentSchema.post("findOneAndDelete", async function (doc) {
  if (!doc) return;
  const issues = await Issue.find({ raised_by: doc._id }).select("_id");
  const issueIds = issues.map(i => i._id);

  await Promise.all([
    IssueComment.deleteMany({ issue_id: { $in: issueIds } }),
    Issue.deleteMany({ raised_by: doc._id }),
    Leave.deleteMany({ student_id: doc._id }),
  ]);
});

const Student = model("Student", studentSchema);
export default Student;