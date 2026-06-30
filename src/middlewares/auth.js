const jwt = require('jsonwebtoken');
const config = require('../config');
const { getSupabaseAdmin } = require('../config/database');
const ApiResponse = require('../utils/response');
const logger = require('../utils/logger');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ApiResponse.error(res, 'Access token required', 401);
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, config.jwt.secret);

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return ApiResponse.error(res, 'Database not available', 500);
    }

    const { data: user, error } = await supabase
      .from('users')
      .select(`
        *,
        role:roles(id, name, description)
      `)
      .eq('id', decoded.userId)
      .maybeSingle();

    if (error || !user) {
      return ApiResponse.error(res, 'User not found', 401);
    }

    if (!user.is_active) {
      return ApiResponse.error(res, 'Account is deactivated', 401);
    }

    req.user = user;
    req.userId = user.id;
    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);

    if (error.name === 'JsonWebTokenError') {
      return ApiResponse.error(res, 'Invalid token', 401);
    }
    if (error.name === 'TokenExpiredError') {
      return ApiResponse.error(res, 'Token expired', 401);
    }

    return ApiResponse.error(res, 'Authentication failed', 401);
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret);

    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data: user } = await supabase
        .from('users')
        .select(`*, role:roles(id, name)`)
        .eq('id', decoded.userId)
        .maybeSingle();

      if (user && user.is_active) {
        req.user = user;
        req.userId = user.id;
      }
    }

    next();
  } catch (error) {
    next();
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return ApiResponse.error(res, 'Unauthorized', 403);
    }

    if (!roles.includes(req.user.role.name)) {
      return ApiResponse.error(res, 'Insufficient permissions', 403);
    }

    next();
  };
};

const requirePermission = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return ApiResponse.error(res, 'Unauthorized', 401);
      }

      const supabase = getSupabaseAdmin();

      const { data: rolePerms } = await supabase
        .from('role_permissions')
        .select('permission_id')
        .eq('role_id', req.user.role_id);

      if (!rolePerms || rolePerms.length === 0) {
        return ApiResponse.error(res, 'Insufficient permissions', 403);
      }

      const permIds = rolePerms.map(rp => rp.permission_id);

      const { data: permissions } = await supabase
        .from('permissions')
        .select('name')
        .in('id', permIds);

      const hasPermission = permissions?.some(p => p.name === permission || p.name === '*');

      if (!hasPermission) {
        return ApiResponse.error(res, 'Insufficient permissions', 403);
      }

      next();
    } catch (error) {
      logger.error('Permission check error:', error);
      return ApiResponse.error(res, 'Permission check failed', 500);
    }
  };
};

const requireOwnerOrRole = (roles, getResourceOwnerId) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return ApiResponse.error(res, 'Unauthorized', 401);
      }

      if (roles.includes(req.user.role?.name)) {
        return next();
      }

      const ownerId = await getResourceOwnerId(req);

      if (ownerId === req.user.id) {
        return next();
      }

      return ApiResponse.error(res, 'Insufficient permissions', 403);
    } catch (error) {
      logger.error('Owner check error:', error);
      return ApiResponse.error(res, 'Permission check failed', 500);
    }
  };
};

module.exports = {
  authMiddleware,
  optionalAuth,
  requireRole,
  requirePermission,
  requireOwnerOrRole
};
