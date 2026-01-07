import mongoose, { Schema } from "mongoose";

const issueCommentSchema = new Schema({
  issue_id: {
    type: Schema.Types.ObjectId,
    ref: "Issue",
    required: true
  },
  commented_by: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  comment_text: {
    type: String,
    required: true,
    trim: true
  }
}, { timestamps: true });

issueCommentSchema.index({ issue_id: 1, createdAt: -1 });

const IssueComment = mongoose.model("IssueComment", issueCommentSchema);

export default IssueComment;