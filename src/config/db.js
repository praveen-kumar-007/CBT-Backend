const mongoose = require('mongoose');
const dns = require('dns');

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error('MONGO_URI is missing in environment variables.');
  }

  try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 15000,
      family: 4
    });

    console.log('MongoDB connected successfully.');
  } catch (error) {
    throw new Error(`MongoDB connection failed: ${error.message}`);
  }
};

module.exports = connectDB;
