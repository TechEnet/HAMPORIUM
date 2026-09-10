const errorHandler = (
  err,
  req,
  res,
  next
) => {
  console.error(err);

  let statusCode =
    err.statusCode || 500;

  let message =
    err.message || "Something went wrong";


  if (err.name === "ValidationError") {
    statusCode = 400;
    message = "Database validation failed";
  }


  if (err.name === "CastError") {
    statusCode = 400;
    message = "Invalid resource ID";
  }

  if (err.name === "MulterError") {
  statusCode = 400;

  if (err.code === "LIMIT_FILE_SIZE") {
    message = "Image size cannot exceed 8 MB";
  } else {
    message = err.message || "File upload failed";
  }
}


  if (err.code === 11000) {
    statusCode = 409;
    message = "Duplicate value already exists";
  }


  if (
    process.env.NODE_ENV === "production" &&
    statusCode === 500
  ) {
    message = "Something went wrong";
  }


  res.status(statusCode).json({
    success: false,
    message,
  });
};

export default errorHandler;