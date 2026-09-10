import "dotenv/config";

import app from "./app.js";
import connectDB from "./config/db.js";

const PORT = process.env.PORT || 5000;

console.log("Production ENV check:", {
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
});
const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`HAMPORIUM API running on port ${PORT}`);
      console.log(`http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:");
    console.error(error.message);

    process.exit(1);
  }
};

startServer();