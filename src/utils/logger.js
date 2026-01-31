const logger = {
  info: (message, data = {}) => {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[INFO] ${message}`, Object.keys(data).length > 0 ? data : "");
    }
  },
  error: (message, error = {}) => {
    const errorData = {
      message: error.message || message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      ...error
    };
    console.error(`[ERROR] ${message}`, process.env.NODE_ENV === "development" ? errorData : error.message);
  },
  warn: (message, data = {}) => {
    console.warn(`[WARN] ${message}`, Object.keys(data).length > 0 ? data : "");
  },
  time: (label) => {
    if (process.env.NODE_ENV !== "production") {
      console.time(`[TIME] ${label}`);
    }
  },
  timeEnd: (label) => {
    if (process.env.NODE_ENV !== "production") {
      console.timeEnd(`[TIME] ${label}`);
    }
  }
};

export default logger;

