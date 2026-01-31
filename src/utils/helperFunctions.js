import { VERIFICATION_ID_TYPES, PAYMENT_ID_TYPES, } from "./constants.js";
import logger from "./logger.js";


export const normalize = (value) => {
    if (value === null || value === undefined) return "";
    return String(value).trim();
};
export const requireField = (value, label) => {
    const normalized = normalize(value);
    if (!normalized) {
        throw new Error(`${label} is required`);
    }
    return normalized;
};
export const validateLength = (value, min, max, label) => {
    const normalized = normalize(value);
    if (normalized.length < min || normalized.length > max) {
        throw new Error(`${label} must be between ${min} and ${max} characters`);
    }
    return normalized;
};
export const verifyExactDigits = (value, length, label) => {
    const normalizedValue = normalize(value);
    const regex = new RegExp(`^\\d{${length}}$`);
    if (!regex.test(normalizedValue)) {
        throw new Error(`${label} must be exactly ${length} digits`);
    }
    return normalizedValue;
};
export const verifyNumberInRange = (value, min, max, label) => {
    const normalized = normalize(value);
    const num = Number(normalized);

    if (!Number.isInteger(num) || num < min || num > max) {
        throw new Error(`${label} must be a number between ${min} and ${max}`);
    }
    return num;
};

export const verifyEmail = (email) => {
    const normalizedEmail = normalize(email).toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalizedEmail)) {
        throw new Error("Please provide a valid email (e.g. xyz@gmail.com)");
    }
    return normalizedEmail;
};


//first level validation functions:
export const validateFullName = (value) =>
    validateLength(requireField(value, "Full name"), 3, 50, "Full name");

export const validatePassword = (value) =>
    validateLength(requireField(value, "Password"), 6, 50, "Password");

export const validatePermanentAddress = (value) =>
    validateLength(
        requireField(value, "Permanent address"),
        10,
        200,
        "Permanent address"
    );

export const validateGuardianName = (value) =>
    validateLength(
        requireField(value, "Guardian name"),
        3,
        50,
        "Guardian name"
    );

export const validateBranch = (value) =>
    validateLength(requireField(value, "Branch"), 2, 30, "Branch");

export const validateRoomNumber = (value) => {
    const normalized = requireField(value, "Room number");

    if (!/^[0-9]{1,5}$/.test(normalized)) {
        throw new Error("Room number must contain only digits (1-5 characters)");
    }

    return normalized;
};
export const validateCapacity = (value) =>
    verifyNumberInRange(value, 1, 10, "Room capacity");

export const validateBlock = (value) => {
    const normalized = requireField(value, "Block").toUpperCase();

    if (!/^[A-Z0-9]{1,5}$/.test(normalized)) {
        throw new Error("Block must be 1–5 characters (A, B, C1, etc.)");
    }
    return normalized;
};


//validation wrapper for student creation
export const validateStudentCreate = (data = {}) => ({
    full_name: validateFullName(data.full_name),
    email: verifyEmail(requireField(data.email, "Email")),
    phone: verifyExactDigits(
        requireField(data.phone, "Phone number"),
        10,
        "Phone number"
    ),
    password: validatePassword(data.password),
    sid: verifyExactDigits(requireField(data.sid, "SID"), 8, "SID"),
    permanent_address: validatePermanentAddress(data.permanent_address),
    guardian_name: validateGuardianName(data.guardian_name),
    guardian_contact: verifyExactDigits(
        requireField(data.guardian_contact, "Guardian mobile number"),
        10,
        "Guardian mobile number"
    ),
    branch: validateBranch(data.branch),
});



export const validateVerificationIds = (verificationIds = {}) => {

    if (!verificationIds || typeof verificationIds !== "object") {
        logger.info(verificationIds);
        throw new Error("Verification IDs are required");
    }

    const validate = (obj, label, allowedTypes) => {
        if (!obj || typeof obj !== "object") {
            throw new Error(`${label} verification is required`);
        }

        const idType = normalize(obj.idType).toUpperCase();
        const idValue = normalize(obj.idValue);

        if (!idType || !allowedTypes.includes(idType)) {
            throw new Error(
                `${label} ID type must be one of: ${allowedTypes.join(", ")}`
            );
        }

        if (!idValue) {
            throw new Error(`${label} ID value is required`);
        }

        return { idType, idValue };
    };

    return {
        studentId: validate(
            verificationIds.studentId,
            "Student",
            VERIFICATION_ID_TYPES
        ),
        guardianId: validate(
            verificationIds.guardianId,
            "Guardian",
            VERIFICATION_ID_TYPES
        ),
        paymentId: validate(
            verificationIds.paymentId,
            "Payment",
            PAYMENT_ID_TYPES
        ),
    };
};


export const validateRoomInput = (data = {}) => {
    if (data.room_id) {
        logger.info("Room ID provided, skipping detailed room validation");
        return { room_id: data.room_id };
    }

    return {
        roomId: null,
        block: validateBlock(data.block),
        room_number: validateRoomNumber(data.room_number),
        capacity: validateCapacity(data.capacity ?? 1),
    };
};

