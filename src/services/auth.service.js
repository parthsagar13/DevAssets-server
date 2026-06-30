const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const logger = require('../utils/logger');
const { initializeDatabase } = require('../config/database');

const User = require('../models/User');
const Role = require('../models/Role');
const RefreshToken = require('../models/RefreshToken');
const EmailVerificationToken = require('../models/EmailVerificationToken');
const PasswordResetToken = require('../models/PasswordResetToken');

class AuthService {
  async init() {
    await initializeDatabase();
  }

  async hashPassword(password) {
    return bcrypt.hash(password, 12);
  }

  async comparePassword(password, hashedPassword) {
    return bcrypt.compare(password, hashedPassword);
  }

  generateAccessToken(user) {
    const payload = {
      userId: user._id,
      email: user.email
    };

    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn
    });
  }

  generateRefreshToken() {
    return crypto.randomBytes(40).toString('hex');
  }

  async register(email, password, userData = {}) {
    await this.init();

    const existingUser = await User.findOne({ email }).lean();
    if (existingUser) throw new Error('User already exists with this email');

    const hashedPassword = await this.hashPassword(password);

    let role = await Role.findOne({ name: userData.role || 'customer' }).lean();
    if (!role) {
      role = await Role.create({ name: userData.role || 'customer' });
    }

    const userId = uuidv4();

    const user = await User.create({
      _id: userId,
      email,
      password_hash: hashedPassword,
      username: userData.username || email.split('@')[0],
      first_name: userData.firstName,
      last_name: userData.lastName,
      role_id: role._id,
      is_email_verified: false,
      is_active: true
    });

    const verificationToken = crypto.randomBytes(32).toString('hex');
    await EmailVerificationToken.create({
      token: verificationToken,
      user_id: user._id,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });

    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken();

    await RefreshToken.create({
      user_id: user._id,
      token: refreshToken,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    return {
      user: this.sanitizeUser(user.toObject()),
      accessToken,
      refreshToken,
      verificationToken
    };
  }

  async login(email, password) {
    await this.init();

    const user = await User.findOne({ email }).lean();
    if (!user) throw new Error('Invalid credentials');
    if (!user.is_active) throw new Error('Account is deactivated');

    const isValid = user.password_hash ? await this.comparePassword(password, user.password_hash) : false;
    if (!isValid) throw new Error('Invalid credentials');

    await User.updateOne({ _id: user._id }, { $set: { last_login_at: new Date() } });

    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken();

    await RefreshToken.create({
      user_id: user._id,
      token: refreshToken,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken
    };
  }

  async refreshToken(refreshToken) {
    await this.init();

    const tokenDoc = await RefreshToken.findOne({ token: refreshToken, is_revoked: false }).lean();
    if (!tokenDoc || new Date(tokenDoc.expires_at) < new Date()) throw new Error('Invalid or expired refresh token');

    await RefreshToken.updateOne({ _id: tokenDoc._id }, { $set: { is_revoked: true } });

    const user = await User.findById(tokenDoc.user_id).lean();
    const accessToken = this.generateAccessToken(user);
    const newRefreshToken = this.generateRefreshToken();

    await RefreshToken.create({
      user_id: tokenDoc.user_id,
      token: newRefreshToken,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    return {
      accessToken,
      refreshToken: newRefreshToken
    };
  }

  async logout(refreshToken, userId) {
    await this.init();

    if (refreshToken) {
      await RefreshToken.updateOne({ token: refreshToken, user_id: userId }, { $set: { is_revoked: true } });
    } else {
      await RefreshToken.updateMany({ user_id: userId }, { $set: { is_revoked: true } });
    }

    return true;
  }

  async forgotPassword(email) {
    await this.init();

    const user = await User.findOne({ email }).lean();
    if (!user) return null;

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    await PasswordResetToken.create({
      token: hashedToken,
      user_id: user._id,
      expires_at: new Date(Date.now() + 60 * 60 * 1000)
    });

    return resetToken;
  }

  async resetPassword(token, newPassword) {
    await this.init();

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const resetToken = await PasswordResetToken.findOne({ token: hashedToken, used: false }).lean();
    if (!resetToken || new Date(resetToken.expires_at) < new Date()) throw new Error('Invalid or expired reset token');

    const hashedPassword = await this.hashPassword(newPassword);

    await User.updateOne({ _id: resetToken.user_id }, { $set: { password_hash: hashedPassword } });

    await PasswordResetToken.updateOne({ _id: resetToken._id }, { $set: { used: true } });

    await RefreshToken.updateMany({ user_id: resetToken.user_id }, { $set: { is_revoked: true } });

    return true;
  }

  async verifyEmail(token) {
    await this.init();

    const verifyToken = await EmailVerificationToken.findOne({ token, used: false }).lean();
    if (!verifyToken || new Date(verifyToken.expires_at) < new Date()) throw new Error('Invalid or expired verification token');

    await User.updateOne({ _id: verifyToken.user_id }, { $set: { is_email_verified: true } });
    await EmailVerificationToken.updateOne({ _id: verifyToken._id }, { $set: { used: true } });

    return true;
  }

  async changePassword(userId, currentPassword, newPassword) {
    await this.init();

    const user = await User.findById(userId).lean();
    if (!user) throw new Error('User not found');

    const isValid = user.password_hash ? await this.comparePassword(currentPassword, user.password_hash) : false;
    if (!isValid) throw new Error('Current password is incorrect');

    const hashedPassword = await this.hashPassword(newPassword);
    await User.updateOne({ _id: userId }, { $set: { password_hash: hashedPassword } });

    return true;
  }

  async updateProfile(userId, updateData) {
    await this.init();
    updateData.updated_at = new Date();
    await User.updateOne({ _id: userId }, { $set: updateData });
    const user = await User.findById(userId).lean();
    return this.sanitizeUser(user);
  }

  async applyForSeller(userId, storeName, storeDescription) {
    await this.init();
    let sellerRole = await Role.findOne({ name: 'seller' }).lean();
    if (!sellerRole) sellerRole = await Role.create({ name: 'seller' });

    await User.updateOne({ _id: userId }, {
      $set: {
        store_name: storeName,
        store_description: storeDescription,
        seller_status: 'pending',
        role_id: sellerRole._id,
        updated_at: new Date()
      }
    });

    const user = await User.findById(userId).lean();
    return this.sanitizeUser(user);
  }

  sanitizeUser(user) {
    const sanitized = { ...user };
    delete sanitized.password_hash;
    return sanitized;
  }
}

module.exports = new AuthService();
