import "dotenv/config";

import connectDB from "./config/db.js";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    console.log("Railway ENV check:", {
      mongo: Boolean(process.env.MONGODB_URI),

      cloudinaryCloudName: Boolean(
        process.env.CLOUDINARY_CLOUD_NAME
      ),

      cloudinaryApiKey: Boolean(
        process.env.CLOUDINARY_API_KEY
      ),

      cloudinaryApiSecret: Boolean(
        process.env.CLOUDINARY_API_SECRET
      ),

      nodeEnv: process.env.NODE_ENV || "not-set",
    });

    const { default: app } = await import("./app.js");

    await connectDB();

    app.listen(PORT, () => {
      console.log(`HAMPORIUM API running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:");
    console.error(error);

    process.exit(1);
  }
};

startServer();