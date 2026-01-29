const asyncHandler = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    logger.error("API Error", err);

    if (err?.statusCode === 413) {
      return res.status(413).json({
        success: false,
        message: "Payload too large",
      });
    }

    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Internal server error",
    });
  }
};
export default asyncHandler;