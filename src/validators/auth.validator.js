const { body, param, query } = require('express-validator');

const registerValidator = [
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),

  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),

  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),

  body('firstName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('First name cannot exceed 100 characters'),

  body('lastName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Last name cannot exceed 100 characters'),

  body('role')
    .optional()
    .isIn(['customer', 'seller'])
    .withMessage('Invalid role')
];

const loginValidator = [
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const refreshTokenValidator = [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required')
];

const forgotPasswordValidator = [
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
];

const resetPasswordValidator = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),

  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number')
];

const changePasswordValidator = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),

  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one lowercase letter, one uppercase letter, and one number')
];

const updateProfileValidator = [
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),

  body('firstName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('First name cannot exceed 100 characters'),

  body('lastName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Last name cannot exceed 100 characters'),

  body('bio')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Bio cannot exceed 1000 characters'),

  body('storeName')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Store name cannot exceed 200 characters'),

  body('storeDescription')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Store description cannot exceed 5000 characters')
];

const sellerApplicationValidator = [
  body('storeName')
    .trim()
    .notEmpty()
    .withMessage('Store name is required')
    .isLength({ min: 3, max: 200 })
    .withMessage('Store name must be between 3 and 200 characters'),

  body('storeDescription')
    .trim()
    .notEmpty()
    .withMessage('Store description is required')
    .isLength({ max: 5000 })
    .withMessage('Store description cannot exceed 5000 characters')
];

const emailVerificationValidator = [
  param('token')
    .notEmpty()
    .withMessage('Verification token is required')
];

module.exports = {
  registerValidator,
  loginValidator,
  refreshTokenValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  changePasswordValidator,
  updateProfileValidator,
  sellerApplicationValidator,
  emailVerificationValidator
};
