const authService = require('../services/auth.service');
const emailService = require('../services/email.service');
const ApiResponse = require('../utils/response');
const logger = require('../utils/logger');
const config = require('../config');

class AuthController {
  async register(req, res, next) {
    try {
      const { email, password, username, firstName, lastName, role } = req.body;

      const result = await authService.register(email, password, {
        username,
        firstName,
        lastName,
        role
      });

      if (result.verificationToken) {
        const baseUrl = req.headers.origin || req.headers.referer || config.env === 'development' ? 'http://localhost:3000' : '';
        await emailService.sendVerificationEmail(email, result.verificationToken, baseUrl);
      }

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: config.env === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000
      });

      ApiResponse.success(res, {
        user: result.user,
        accessToken: result.accessToken
      }, 'Registration successful', 201);
    } catch (error) {
      logger.error('Registration error:', error);
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      const result = await authService.login(email, password);

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: config.env === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000
      });

      ApiResponse.success(res, {
        user: result.user,
        accessToken: result.accessToken
      }, 'Login successful');
    } catch (error) {
      logger.error('Login error:', error);
      next(error);
    }
  }

  async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        const tokenFromCookie = req.cookies?.refreshToken;
        if (!tokenFromCookie) {
          return ApiResponse.error(res, 'Refresh token required', 401);
        }
      }

      const result = await authService.refreshToken(refreshToken || req.cookies.refreshToken);

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: config.env === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000
      });

      ApiResponse.success(res, result, 'Token refreshed successfully');
    } catch (error) {
      logger.error('Token refresh error:', error);
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
      const userId = req.user?.id || req.userId;

      await authService.logout(refreshToken, userId);

      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: config.env === 'production',
        sameSite: 'strict'
      });

      ApiResponse.success(res, null, 'Logout successful');
    } catch (error) {
      logger.error('Logout error:', error);
      next(error);
    }
  }

  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;

      const resetToken = await authService.forgotPassword(email);

      if (resetToken) {
        const baseUrl = req.headers.origin || req.headers.referer || (config.env === 'development' ? 'http://localhost:3000' : '');
        await emailService.sendPasswordResetEmail(email, resetToken, baseUrl);
      }

      ApiResponse.success(res, null, 'If an account exists with this email, you will receive a password reset link');
    } catch (error) {
      logger.error('Forgot password error:', error);
      next(error);
    }
  }

  async resetPassword(req, res, next) {
    try {
      const { token, password } = req.body;

      await authService.resetPassword(token, password);

      ApiResponse.success(res, null, 'Password reset successfully. Please login with your new password');
    } catch (error) {
      logger.error('Reset password error:', error);
      next(error);
    }
  }

  async verifyEmail(req, res, next) {
    try {
      const { token } = req.params;

      await authService.verifyEmail(token);

      ApiResponse.success(res, null, 'Email verified successfully');
    } catch (error) {
      logger.error('Email verification error:', error);
      next(error);
    }
  }

  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;

      await authService.changePassword(userId, currentPassword, newPassword);

      ApiResponse.success(res, null, 'Password changed successfully');
    } catch (error) {
      logger.error('Change password error:', error);
      next(error);
    }
  }

  async getMe(req, res, next) {
    try {
      ApiResponse.success(res, req.user, 'User profile retrieved successfully');
    } catch (error) {
      logger.error('Get profile error:', error);
      next(error);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const userId = req.user.id;
      const updateData = req.body;

      const { getSupabaseAdmin } = require('../config/database');
      const supabase = getSupabaseAdmin();

      const { data: user, error } = await supabase
        .from('users')
        .update({
          ...updateData,
          updated_at: new Date()
        })
        .eq('id', userId)
        .select(`*, role:roles(id, name)`)
        .single();

      if (error) throw error;

      ApiResponse.success(res, user, 'Profile updated successfully');
    } catch (error) {
      logger.error('Update profile error:', error);
      next(error);
    }
  }

  async applyForSeller(req, res, next) {
    try {
      const userId = req.user.id;
      const { storeName, storeDescription } = req.body;

      const { getSupabaseAdmin } = require('../config/database');
      const supabase = getSupabaseAdmin();

      const sellerRole = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'seller')
        .maybeSingle();

      const { data: user, error } = await supabase
        .from('users')
        .update({
          store_name: storeName,
          store_description: storeDescription,
          seller_status: 'pending',
          role_id: sellerRole?.id,
          updated_at: new Date()
        })
        .eq('id', userId)
        .select(`*, role:roles(id, name)`)
        .single();

      if (error) throw error;

      ApiResponse.success(res, user, 'Seller application submitted successfully');
    } catch (error) {
      logger.error('Seller application error:', error);
      next(error);
    }
  }
}

module.exports = new AuthController();
