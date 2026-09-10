import jwt from "jsonwebtoken";

import User from "../modules/users/user.model.js";

import asyncHandler from "../utils/asyncHandler.js";


const protect = asyncHandler(async (req, res, next) => {
  let token = req.cookies?.accessToken;

  if (!token) {
    const authorization = req.headers.authorization;

    if (
      authorization &&
      authorization.startsWith("Bearer ")
    ) {
      token = authorization.split(" ")[1];
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  let decoded;

  try {
    decoded = jwt.verify(
      token,
      process.env.JWT_SECRET,
      {
        algorithms: ["HS256"],
      }
    );
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired session",
    });
  }

  const user = await User.findById(
    decoded.userId
  );

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "User no longer exists",
    });
  }

  if (!user.isActive) {
    return res.status(403).json({
      success: false,
      message: "This account is disabled",
    });
  }

  if (decoded.version !== user.tokenVersion) {
    return res.status(401).json({
      success: false,
      message: "Session is no longer valid",
    });
  }

  req.user = user;

  next();
});

export default protect;