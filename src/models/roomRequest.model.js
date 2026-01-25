import { Schema, model } from "mongoose";

const roomRequestSchema = new Schema(
  {
    student_id: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },

    phase: {
      type: String,
      enum: ["A", "B"],
      required: true,
      index: true
    },

    requested_room_id: {
      type: Schema.Types.ObjectId,
      ref: "Room",
      default: null
    },

    allocated_room_id: {
      type: Schema.Types.ObjectId,
      ref: "Room",
      default: null
    },

    status: {
      type: String,
      enum: ["PENDING", "SUCCESS", "FAILED", "TEMP_LOCKED"],
      default: "PENDING",
      index: true
    },
    processed_at: {
      type: Date,
    }
  },
  { timestamps: true }
);

roomRequestSchema.index({ status: 1, createdAt: 1 });
//only one pending and tempLocked allowed for one student success/faild multiple;
roomRequestSchema.index(
  { student_id: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["PENDING", "TEMP_LOCKED"] }
    }
  }
);

const RoomRequest = model("RoomRequest", roomRequestSchema);
export default RoomRequest
