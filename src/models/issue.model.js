import mongoose, {Schema} from "mongoose";

const issueSchema = new Schema({
    title:{
        required: true,
        type: String,
        trim: true,
    },
    description:{
        required: true,
        type: String,
        trim: true,
        minLength: [10, "Minimum 10 characters are required"],
        maxLength: [500, "Maximum 500 characters allowed"]
    },
    category:{
        type: String,
        default: "other",
        enum: ["drinking-water", "plumbing", "furniture", "electricity", "other"]
    },
    status:{
        type: String,
        default: "pending",
        enum: ["pending", "resolved"],
    },
    raised_by:{
        type: Schema.Types.ObjectId,
        required: true,
        ref: "Student",
    }
},{timestamps: true})

const Issue = mongoose.model("Issue", issueSchema);

export default Issue;