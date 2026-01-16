import mongoose from "mongoose";

const hostelSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        code: {
            type: String,
            required: true,
            unique: true,
            uppercase: true
        },

        blocks: {
            type: [String],
            required: true,
            lowercase: true
        },

        floors_per_block: {
            type: Number,
            min: 1,
            default: 3,
        },

        rooms_per_floor: {
            type: Number,
            min: 1
        },
        total_rooms: {
            type: Number,
            required: true
        },
        // warden: {
        //     type: mongoose.Schema.Types.ObjectId,
        //     ref: "User",
        //     required: true
        // },
        is_active: {
            type: Boolean,
            default: true
        },
        allotment: {
            type: Boolean,
            default: false,
        }
    },
    { timestamps: true }
);

const Hostel = mongoose.model("Hostel", hostelSchema);

export default Hostel;