const mongoose = require('mongoose');
const config = require('./index');
const logger = require('../utils/logger');

let connection = null;

const initializeDatabase = async () => {
  try {
    const uri = process.env.MONGO_URI || process.env.DATABASE_URL;
    if (!uri) {
      logger.warn('MongoDB URI not provided - running in mock mode without database');
      return;
    }

    connection = await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    logger.info('MongoDB connected successfully');
  } catch (error) {
    logger.warn(`MongoDB connection skipped: ${error.message}`);
    logger.info('Running in mock mode without database connection');
  }
};

const getMongoose = () => mongoose;

module.exports = {
  initializeDatabase,
  getMongoose
};
