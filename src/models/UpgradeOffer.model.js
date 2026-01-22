import { model, Schema } from "mongoose";

const upgradeOfferSchema = new Schema({
    room_id: {
        type: Schema.Types.ObjectId,
        ref: "Room",
        required: true,
        index: true
    },

    student_id: {
        type: Schema.Types.ObjectId,
        ref: "Student",
        required: true,
        index: true
    },
    source_request_id: {
        type: Schema.Types.ObjectId,
        ref: "RoomRequest",
        required: true,
        index: true
    },
    status: {
        type: String,
        enum: ["ACTIVE", "ACCEPTED", "EXPIRED", "CLOSED"],
        default: "ACTIVE",
        index: true
    },

    expires_at: {
        type: Date,
        required: true,
        index: true
    },
    approved_by: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null
    }
}, { timestamps: true });


upgradeOfferSchema.index(
    { room_id: 1 },
    {
        unique: true,
        partialFilterExpression: { status: "ACTIVE" }
    }
);

const upgradeOffer = model("UpgradeOffer", upgradeOfferSchema);
export default upgradeOffer;
