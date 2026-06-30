const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const config = require('../config');
const { getSupabaseAdmin, getSupabase } = require('../config/database');
const logger = require('../utils/logger');
const { supabase } = require('@supabase/supabase-js');

class AuthService {
  constructor() {
    this.supabase = null;
    this.admin = null;
  }

  async init() {
    this.admin = getSupabaseAdmin();
    this.supabase = getSupabase();
  }

  async hashPassword(password) {
    return bcrypt.hash(password, 12);
  }

  async comparePassword(password, hashedPassword) {
    return bcrypt.compare(password, hashedPassword);
  }

  generateAccessToken(user) {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role?.name || 'customer'
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

    const existingUser = await this.admin
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    const hashedPassword = await this.hashPassword(password);

    const customerRole = await this.admin
      .from('roles')
      .select('id')
      .eq('name', userData.role || 'customer')
      .maybeSingle();

    const { data: authData, error: authError } = await this.admin.auth.signUp({
      email,
      password,
    });

    if (authError) {
      const userId = crypto.randomUUID();
      const { data: user, error } = await this.admin
        .from('users')
        .insert({
          id: userId,
          email,
          password_hash: hashedPassword,
          username: userData.username || email.split('@')[0],
          first_name: userData.firstName,
          last_name: userData.lastName,
          role_id: customerRole?.data?.id,
          is_email_verified: false,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      const roleData = await this.admin
        .from('roles')
        .select('id, name')
        .eq('id', user.role_id)
        .maybeSingle();

      user.role = roleData;

      const verificationToken = crypto.randomBytes(32).toString('hex');
      await this.admin
        .from('email_verification_tokens')
        .insert({
          user_id: user.id,
          token: verificationToken,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
        });

      const accessToken = this.generateAccessToken(user);
      const refreshToken = this.generateRefreshToken();

      await this.admin
        .from('refresh_tokens')
        .insert({
          user_id: user.id,
          token: refreshToken,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        });

      return {
        user: this.sanitizeUser(user),
        accessToken,
        refreshToken,
        verificationToken
      };
    }

    const userId = authData.user.id;

    const { data: user, error } = await this.admin
      .from('users')
      .insert({
        id: userId,
        email,
        username: userData.username || email.split('@')[0],
        first_name: userData.firstName,
        last_name: userData.lastName,
        role_id: customerRole?.id,
        is_email_verified: false,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;

    const roleData = await this.admin
      .from('roles')
      .select('id, name')
      .eq('id', user.role_id)
      .maybeSingle();

    user.role = roleData;

    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken();

    await this.admin
      .from('refresh_tokens')
      .insert({
        user_id: user.id,
        token: refreshToken,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });

    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken
    };
  }

  async login(email, password) {
    await this.init();

    const { data: user, error } = await this.admin
      .from('users')
      .select(`*, role:roles(id, name)`)
      .eq('email', email)
      .maybeSingle();

    if (!user) {
      throw new Error('Invalid credentials');
    }

    if (!user.is_active) {
      throw new Error('Account is deactivated');
    }

    const { data: authUser, error: signInError } = await this.admin.auth.signInWithPassword({
      email,
      password
    });

    if (signInError) {
      if (user.password_hash) {
        const isValid = await this.comparePassword(password, user.password_hash);
        if (!isValid) {
          throw new Error('Invalid credentials');
        }
      } else {
        throw new Error('Invalid credentials');
      }
    }

    await this.admin
      .from('users')
      .update({ last_login_at: new Date() })
      .eq('id', user.id);

    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken();

    await this.admin
      .from('refresh_tokens')
      .insert({
        user_id: user.id,
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

    const { data: token, error } = await this.admin
      .from('refresh_tokens')
      .select('*, user:users(*, role:roles(id, name))')
      .eq('token', refreshToken)
      .eq('is_revoked', false)
      .maybeSingle();

    if (!token || new Date(token.expires_at) < new Date()) {
      throw new Error('Invalid or expired refresh token');
    }

    await this.admin
      .from('refresh_tokens')
      .update({ is_revoked: true })
      .eq('id', token.id);

    const accessToken = this.generateAccessToken(token.user);
    const newRefreshToken = this.generateRefreshToken();

    await this.admin
      .from('refresh_tokens')
      .insert({
        user_id: token.user_id,
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
      await this.admin
        .from('refresh_tokens')
        .update({ is_revoked: true })
        .eq('token', refreshToken)
        .eq('user_id', userId);
    } else {
      await this.admin
        .from('refresh_tokens')
        .update({ is_revoked: true })
        .eq('user_id', userId);
    }

    return true;
  }

  async forgotPassword(email) {
    await this.init();

    const { data: user, error } = await this.admin
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (!user) {
      return null;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    await this.admin
      .from('password_reset_tokens')
      .insert({
        user_id: user.id,
        token: hashedToken,
        expires_at: new Date(Date.now() + 60 * 60 * 1000)
      });

    return resetToken;
  }

  async resetPassword(token, newPassword) {
    await this.init();

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const { data: resetToken, error } = await this.admin
      .from('password_reset_tokens')
      .select('*, user:users(*)')
      .eq('token', hashedToken)
      .eq('used', false)
      .maybeSingle();

    if (!resetToken || new Date(resetToken.expires_at) < new Date()) {
      throw new Error('Invalid or expired reset token');
    }

    const hashedPassword = await this.hashPassword(newPassword);

    await this.admin.auth.admin.updateUserById(resetToken.user_id, {
      password: newPassword
    });

    await this.admin
      .from('password_reset_tokens')
      .update({ used: true })
      .eq('id', resetToken.id);

    await this.admin
      .from('refresh_tokens')
      .update({ is_revoked: true })
      .eq('user_id', resetToken.user_id);

    return true;
  }

  async verifyEmail(token) {
    await this.init();

    const { data: verifyToken, error } = await this.admin
      .from('email_verification_tokens')
      .select('*, user:users(*)')
      .eq('token', token)
      .eq('used', false)
      .maybeSingle();

    if (!verifyToken || new Date(verifyToken.expires_at) < new Date()) {
      throw new Error('Invalid or expired verification token');
    }

    await this.admin
      .from('users')
      .update({ is_email_verified: true })
      .eq('id', verifyToken.user_id);

    await this.admin
      .from('email_verification_tokens')
      .update({ used: true })
      .eq('id', verifyToken.id);

    return true;
  }

  async changePassword(userId, currentPassword, newPassword) {
    await this.init();

    const { data: user, error } = await this.admin
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (!user) {
      throw new Error('User not found');
    }

    try {
      await this.admin.auth.signInWithPassword({
        email: user.email,
        password: currentPassword
      });
    } catch (e) {
      if (user.password_hash) {
        const isValid = await this.comparePassword(currentPassword, user.password_hash);
        if (!isValid) {
          throw new Error('Current password is incorrect');
        }
      } else {
        throw new Error('Current password is incorrect');
      }
    }

    await this.admin.auth.admin.updateUserById(userId, {
      password: newPassword
    });

    return true;
  }

  sanitizeUser(user) {
    const sanitized = { ...user };
    delete sanitized.password_hash;
    return sanitized;
  }
}

module.exports = new AuthService();
