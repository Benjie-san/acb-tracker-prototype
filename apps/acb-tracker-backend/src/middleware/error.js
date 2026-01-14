const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err && err.name === "CastError") {
    return res.status(400).json({ error: "Invalid id" });
  }

  const status = err.status || 500;
  const message = err.message || "Server error";
  console.error(err);
  return res.status(status).json({ error: message });
};

module.exports = { errorHandler };
