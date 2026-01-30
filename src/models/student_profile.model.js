import { Schema, model } from "mongoose";
import Room from "./room.model.js";
import { PAYMENT_ID_TYPES, STUDENT_ID_TYPES } from "../utils/constants.js";


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
      default: null,
      index: true,
      // required: true
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
    verificationIds: {
      studentId: {
        idType: {
          type: String,
          enum: ["AADHAAR", "PAN", "PASSPORT", "VOTER_ID"],
          required: true,
        },
        idValue: {
          type: String,
          required: true,
          trim: true,
        },
      },

      guardianId: {
        idType: {
          type: String,
          enum: STUDENT_ID_TYPES,
          required: true,
        },
        idValue: {
          type: String,
          required: true,
          trim: true,
        },
      },

      paymentId: {
        idType: {
          type: String,
          enum: PAYMENT_ID_TYPES,
          required: true,
        },
        idValue: {
          type: String,
          required: true,
          trim: true,
        },
      },
    },

    profile_photo: {
      url: {
        type: String,
        default: null,
      },
      public_id: {
        type: String,
        default: null,
      },
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
    room_out: {
      type: Date,
    },
    branch: {
      type: String,
      required: true,
      trim: true,
    },

    allotment_phase: {
      type: String,
      enum: ["A", "B"],
      default: null
    },

    allotment_status: {
      type: String,
      enum: ["PENDING", "TEMP_LOCKED", "ALLOTTED", "CANCELLED"],
      default: "PENDING",
      index: true
    },
    verification_status: {
      type: String,
      enum: ["PENDING", "VERIFIED", "REJECTED"],
      default: "PENDING",
      index: true
    }


  },
  {
    timestamps: true
  }
);

studentSchema.index({ branch: 1, createdAt: -1 });
//compound unique index
studentSchema.index(
  { user_id: 1, allotment_status: 1 },
  {
    unique: true,
    partialFilterExpression: { allotment_status: { $ne: "CANCELLED" } }
  }
);
studentSchema.pre("save", async function () {
  try {
    if (!this.isNew && !this.isModified("room_id")) return;
    if (!this.room_id) {
      this.allotment_status = "PENDING";
      return
    }
    if (this.allotment_status === "ALLOTTED" && this.verification_status !== "VERIFIED") {
      throw new Error("Cannot allot room without verification");
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
studentSchema.pre("findOneAndUpdate", async function () {
  const update = this.getUpdate();
  if (!update?.room_id) return;

  const session = this.getOptions().session;

  const room = await Room
    .findById(update.room_id)
    .select("block room_number")
    .session(session);

  if (!room) {
    throw new Error("Invalid room_id");
  }
  update.block = room.block;
  update.room_number = room.room_number;
});


const Student = model("Student", studentSchema);
export default Student;