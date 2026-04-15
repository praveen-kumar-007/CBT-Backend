require("dotenv").config();

const https = require("https");

const app = require("./app");
const connectDB = require("./config/db");
const { configureCloudinary } = require("./config/cloudinary");

const PORT = process.env.PORT || 5000;
const TEN_MINUTES_MS = 10 * 60 * 1000;

const trimTrailingSlash = (value = "") => value.replace(/\/+$/, "");

const pingUrl =
  process.env.KEEP_ALIVE_URL ||
  (process.env.RENDER_EXTERNAL_URL
    ? `${trimTrailingSlash(process.env.RENDER_EXTERNAL_URL)}/api/health`
    : "");

const shouldRunKeepAlive = process.env.KEEP_ALIVE_ENABLED
  ? process.env.KEEP_ALIVE_ENABLED === "true"
  : process.env.NODE_ENV === "production";

const pingBackend = () => {
  if (!pingUrl || !shouldRunKeepAlive) {
    return;
  }

  https
    .get(pingUrl, (res) => {
      // Drain response so socket can be reused/closed properly.
      res.resume();

      if (res.statusCode && res.statusCode >= 400) {
        console.warn(
          `Keep-alive ping failed with status ${res.statusCode} for ${pingUrl}`,
        );
      }
    })
    .on("error", (error) => {
      console.warn(`Keep-alive ping error for ${pingUrl}: ${error.message}`);
    });
};

const startKeepAlive = () => {
  if (!shouldRunKeepAlive) {
    console.log("Keep-alive disabled.");
    return;
  }

  if (!pingUrl) {
    console.warn(
      "Keep-alive is enabled but KEEP_ALIVE_URL/RENDER_EXTERNAL_URL is not configured.",
    );
    return;
  }

  console.log(`Keep-alive started. Pinging every 10 minutes: ${pingUrl}`);

  // Ping once shortly after boot, then continue on interval.
  setTimeout(pingBackend, 10 * 1000);
  setInterval(pingBackend, TEN_MINUTES_MS);
};

const startServer = async () => {
  try {
    await connectDB();

    const cloudinaryConfigured = configureCloudinary();
    if (!cloudinaryConfigured) {
      console.warn(
        "Cloudinary credentials are missing. Question image upload will fail until configured.",
      );
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      startKeepAlive();
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();
