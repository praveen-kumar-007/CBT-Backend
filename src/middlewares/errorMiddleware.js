const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  res.status(404);
  next(error);
};

const errorHandler = (err, req, res, next) => {
  console.error("Backend error:", err);
  let statusCode =
    res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  if (err.statusCode && Number.isInteger(err.statusCode)) {
    statusCode = err.statusCode;
  }

  const responsePayload = {
    success: false,
    message: err.message || "Internal server error",
  };

  if (process.env.NODE_ENV !== "production") {
    responsePayload.stack = err.stack;
  }

  if (err.errors && Array.isArray(err.errors)) {
    responsePayload.errors = err.errors;
  }

  if (err.name === "MulterError") {
    statusCode = 400;
    responsePayload.message = err.message || "File upload failed.";
  }

  res.status(statusCode).json(responsePayload);
};

module.exports = {
  notFound,
  errorHandler,
};
