import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";

dotenv.config();

const cloudName = String(
  process.env.CLOUDINARY_CLOUD_NAME || ""
).trim();

const apiKey = String(
  process.env.CLOUDINARY_API_KEY || ""
).trim();

const apiSecret = String(
  process.env.CLOUDINARY_API_SECRET || ""
).trim();

const missingVariables = [];

if (!cloudName) {
  missingVariables.push("CLOUDINARY_CLOUD_NAME");
}

if (!apiKey) {
  missingVariables.push("CLOUDINARY_API_KEY");
}

if (!apiSecret) {
  missingVariables.push("CLOUDINARY_API_SECRET");
}

if (missingVariables.length > 0) {
  throw new Error(
    `Cloudinary configuration is incomplete. Missing: ${missingVariables.join(
      ", "
    )}`
  );
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
  secure: true,
});

export default cloudinary;