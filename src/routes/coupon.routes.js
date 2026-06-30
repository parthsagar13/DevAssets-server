const express = require('express');
const router = express.Router();
const couponController = require('../controllers/coupon.controller');
const { authMiddleware, requireRole } = require('../middlewares/auth');
const { apiLimiter } = require('../middlewares/rateLimiter');
const validate = require('../middlewares/validate');
const { body, param } = require('express-validator');

const createCouponValidator = [
  body('code').trim().notEmpty().withMessage('Code is required').isLength({ max: 50 }),
  body('type').isIn(['percentage', 'fixed']).withMessage('Type must be percentage or fixed'),
  body('value').isFloat({ min: 0 }).withMessage('Value must be positive'),
  body('validFrom').isISO8601().withMessage('Valid from must be a valid date'),
  body('validUntil').isISO8601().withMessage('Valid until must be a valid date')
];

// Validate coupon (public)
router.post('/validate',
  apiLimiter,
  body('code').notEmpty(),
  body('subtotal').isFloat({ min: 0 }),
  validate,
  couponController.validate
);

// Create coupon
router.post('/',
  authMiddleware,
  requireRole('admin', 'seller'),
  apiLimiter,
  createCouponValidator,
  validate,
  couponController.create
);

// List coupons
router.get('/',
  authMiddleware,
  requireRole('admin', 'seller'),
  apiLimiter,
  couponController.list
);

// Get coupon by ID
router.get('/:id',
  authMiddleware,
  requireRole('admin', 'seller'),
  param('id').isUUID(),
  validate,
  couponController.getById
);

// Update coupon
router.put('/:id',
  authMiddleware,
  requireRole('admin', 'seller'),
  param('id').isUUID(),
  validate,
  couponController.update
);

// Delete coupon
router.delete('/:id',
  authMiddleware,
  requireRole('admin'),
  param('id').isUUID(),
  validate,
  couponController.delete
);

module.exports = router;
