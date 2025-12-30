import { Schema, model } from "mongoose";

const roomSchema = new Schema(
    {
        // Identity
        room_number: {
            type: String,           // "203"
            required: true,
            trim: true
        },

        block: {
            type: String,           // "A", "B"
            required: true,
            lowercase: true,
            trim: true
        },

        floor: {
            type: Number,           // 2
            min: 0,
        },

        // Capacity control
        occupancy: {
            type: Number,           // 1, 2, 3
            required: true,
            default: 0,
            max: 3
        },
        capacity: {
            type: Number,           // 1, 2, 3
            required: true,
            min: 1,
            default: 1,
            max: 3,
        },

        // Admin control
        is_active: {
            type: Boolean,
            default: true           // false = maintenance / blocked
        },


        yearly_rent: {
            type: Number,
            default: 85000,
        }
    },
    { timestamps: true }
);

// Enforce uniqueness per block
roomSchema.index({ block: 1, room_number: 1 }, { unique: true });

roomSchema.virtual("occupants", {
    ref: "Student",
    localField: "_id",
    foreignField: "room_id",
    justOne: false
});

roomSchema.set("toJSON", { virtuals: true });
roomSchema.set("toObject", { virtuals: true });



// export default model("Room", roomSchema);
const Room = model("Room", roomSchema);

export default Room;
