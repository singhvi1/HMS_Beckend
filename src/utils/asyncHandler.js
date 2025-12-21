const asyncHandler = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    if (err?.statusCode === 413) {
      res.status(413).json({
        success: false,
        message: "Payload too large",
      });
    }

    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
    });
  }
};

export default asyncHandler;
