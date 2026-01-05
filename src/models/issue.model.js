import mongoose, { Schema } from "mongoose";
import IssueComment from "./issue_comment.model.js";

const issueSchema = new Schema({
    title: {
        required: true,
        type: String,
        trim: true,
    },
    description: {
        required: true,
        type: String,
        trim: true,
        minLength: [10, "Minimum 10 characters are required"],
        maxLength: [500, "Maximum 500 characters allowed"]
    },
    category: {
        type: String,
        default: "other",
        enum: ["drinking-water", "plumbing", "furniture", "electricity", "internet", "civil", "other"]
    },
    status: {
        type: String,
        default: "pending",
        enum: ["pending", "resolved", "in_progress"],
    },
    raised_by: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: "Student",
    }
}, { timestamps: true })

issueSchema.post("findOneAndDelete", async function (doc) {
    if (!doc) return;

    await IssueComment.deleteMany({
        issue_id: doc._id,
    });
});
issueSchema.index({ raised_by: 1, createdAt: -1 });
const Issue = mongoose.model("Issue", issueSchema);

export default Issue;