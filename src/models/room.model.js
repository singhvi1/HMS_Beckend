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
        },
        occupied_count: {
            type: Number,
            default: 0
        },

        allocation_status: {
            type: String,
            enum: ["AVAILABLE", "FULL", "VACANT_UPGRADE"],
            default: "AVAILABLE",
            index: true
        },

        filling_order: {
            type: Date,
            default: null
        },
    },
    { timestamps: true }
);

roomSchema.index({ block: 1, room_number: 1 }, { unique: true });


roomSchema.pre("save", function () {
    if (this.occupied_count > this.capacity) {
        throw new Error("occupied_count exceeds capacity");
    }

    if (this.allocation_status !== "VACANT_UPGRADE") {
        if (this.occupied_count === this.capacity) {
            this.allocation_status = "FULL";
            if (!this.filling_order) this.filling_order = new Date();
        } else {
            this.allocation_status = "AVAILABLE";
        }
    }

});

roomSchema.pre("findOneAndUpdate", async function () {
    const update = this.getUpdate();
    const session = this.getOptions().session;

    if (!update?.$inc?.occupied_count) return;

    const room = await this.model.findOne(this.getQuery()).session(session)

    if (!room) {
        throw new Error("No such room found via hook ");
    }
    const newOccupied =
        room.occupied_count + update.$inc.occupied_count;

    if (newOccupied > room.capacity) {
        throw new Error("Room capacity exceeded");
    }

    update.$set = update.$set || {};

    if (newOccupied === room.capacity) {
        update.$set.allocation_status = "FULL";
        if (!room.filling_order) {
            update.$set.filling_order = new Date();
        }
    } else {
        // update.$set.allocation_status = "AVAILABLE";
        if (!update.$set.allocation_status) {
            update.$set.allocation_status = "AVAILABLE";
        }
    }

})

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
