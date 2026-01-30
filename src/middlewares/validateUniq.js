import User from "../models/user.model.js";
import Student from "../models/student_profile.model.js";
import logger from "../utils/logger.js";

export const validateStudentUniqueness = async (req, _res, next) => {
    try {
        const { email, sid } = req.body || {};

        if (!email || !sid) {
            const err = new Error("Email and SID are required for uniqueness validation");
            logger.error("Missing email or SID in validateStudentUniqueness middleware", err.message);

            err.statusCode = 400;
            err.source = "VALIDATE_STUDENT_UNIQUENESS";
            return next(err);
        }

        logger.info("Validating student uniqueness", { email, sid });

        const [existingUser, existingStudent] = await Promise.all([
            User.findOne({ email: email.trim().toLowerCase() }),
            Student.findOne({ sid: sid.trim() })
        ]);

        if (existingUser) {
            const err = new Error("User with this email already exists");
            err.statusCode = 409;
            err.source = "VALIDATE_STUDENT_UNIQUENESS";
            return next(err);
        }

        if (existingStudent) {
            const err = new Error("Student with this SID already exists");
            err.statusCode = 409;
            err.source = "VALIDATE_STUDENT_UNIQUENESS";
            return next(err);
        }

        next();
    } catch (error) {
        logger.error("Error in validateStudentUniqueness middleware", {
            message: error.message,
            stack: error.stack
        });
        next(error);
    }
};
