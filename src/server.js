require("dotenv").config();

const https = require("https");

const app = require("./app");
const connectDB = require("./config/db");
const { configureCloudinary } = require("./config/cloudinary");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    const User = require("./models/User");
    console.log("Cleaning up deprecated User indexes...");
    const existingIndexes = await User.collection.indexes();
    const legacyIndexName = "role_1_tenantAdmin_1_email_1";
    if (existingIndexes.some((index) => index.name === legacyIndexName)) {
      console.log(`Dropping legacy index ${legacyIndexName}`);
      await User.collection.dropIndex(legacyIndexName);
    }

    console.log("Syncing User indexes...");
    await User.syncIndexes();
    console.log("User indexes synced.");

    const cloudinaryConfigured = configureCloudinary();
    if (!cloudinaryConfigured) {
      console.warn(
        "Cloudinary credentials are missing. Question image upload will fail until configured.",
      );
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();
