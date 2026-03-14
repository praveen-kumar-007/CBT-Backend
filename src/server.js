require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/db');
const { configureCloudinary } = require('./config/cloudinary');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    const cloudinaryConfigured = configureCloudinary();
    if (!cloudinaryConfigured) {
      console.warn('Cloudinary credentials are missing. Question image upload will fail until configured.');
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
