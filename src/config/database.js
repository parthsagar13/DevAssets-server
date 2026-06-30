const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const config = require('./index');
const logger = require('../utils/logger');
const User = require('../models/User');
const Role = require('../models/Role');

let connection = null;

const seedDefaultAdmin = async () => {
  try {
    const adminEmail = 'adminparth@gmail.com';
    const adminPassword = 'Parth@123';

    const existingAdmin = await User.findOne({ email: adminEmail }).lean();
    if (existingAdmin) {
      return;
    }

    let adminRole = await Role.findOne({ name: 'admin' }).lean();
    if (!adminRole) {
      adminRole = await Role.create({ name: 'admin' });
    }

    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await User.create({
      _id: uuidv4(),
      email: adminEmail,
      password_hash: passwordHash,
      username: 'adminparth',
      first_name: 'Admin',
      last_name: 'Parth',
      role_id: adminRole._id,
      is_email_verified: true,
      is_active: true,
      seller_status: 'none',
      created_at: new Date(),
      updated_at: new Date()
    });

    logger.info(`Default admin user created: ${adminEmail}`);
  } catch (error) {
    logger.warn(`Failed to seed default admin user: ${error.message}`);
  }
};

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
    await seedDefaultAdmin();
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
