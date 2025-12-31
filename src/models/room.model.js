import { Schema, model } from "mongoose";

const roomSchema = new Schema(
    {

        room_number: {
            type: String,
            required: true,
            trim: true
        },

        block: {
            type: String,
            required: true,
            lowercase: true,
            trim: true
        },

        floor: {
            type: Number,
            min: 0,
        },

        occupancy: {
            type: Number,
            required: true,
            default: 0,
            max: 3
        },
        capacity: {
            type: Number,
            required: true,
            min: 1,
            default: 1,
            max: 3,
        },


        is_active: {
            type: Boolean,
            default: true
        },

        yearly_rent: {
            type: Number,
            default: 75500,
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
