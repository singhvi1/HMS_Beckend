import mongoose from "mongoose";
import logger from "../utils/logger.js";

const dbConnect = async () => {
  try {
    const connectionInstance = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    logger.info(`MongoDB connected - Host: ${connectionInstance.connection.host}`);
  } catch (error) {
    logger.error("MongoDB connection failed", error);
    process.exit(1);
  }
};

export default dbConnect;