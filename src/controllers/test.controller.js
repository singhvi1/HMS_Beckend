import cloudinary from "../config/cloudinary.config.js";




export const cloudinaryTest = async (_req, res) => {
    try {
        const result = await cloudinary.api.ping();
        res.json({
            status: "Cloudinary connected",
            result,
        });
    } catch (error) {
        res.status(500).json({
            message: "Cloudinary connection failed",
            error: error.message,
        });
    }
};
