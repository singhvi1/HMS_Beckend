import Hostel from "../models/hostel.model.js";

export const requirePhase = (requiredPhase) => {
    return async (req, res, next) => {
        try {
            const hostel = await Hostel.findOne({ is_active: true });

            if (!hostel) {
                return res.status(404).json({
                    success: false,
                    message: "No active hostel configuration found",
                });
            }

            if (hostel.allotment_status !== requiredPhase) {
                return res.status(403).json({
                    success: false,
                    message: `${requiredPhase} is currently closed. Current phase is: ${hostel.allotment_status}`,
                });
            }
            req.hostelConfig = hostel;

            next();
        } catch (error) {
            next(error);
        }
    };
};