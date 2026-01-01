import mongoose, {Schema} from "mongoose";

const paymentSchema = new Schema({
  user_id: {
    type: Schema.Types.ObjectId,
    ref: "User",
    index:true,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ["success", "failed"],
    required: true
  },
  transaction_id: {
    type: String
  }
}, { timestamps: true });

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;

