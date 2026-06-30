const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const downloadController = require('../controllers/download.controller');
const { authMiddleware, requireRole } = require('../middlewares/auth');
const { apiLimiter } = require('../middlewares/rateLimiter');
const validate = require('../middlewares/validate');
const { body, param, query } = require('express-validator');

const createOrderValidator = [
  body('items').isArray({ min: 1 }).withMessage('Items must be a non-empty array'),
  body('items.*.productId').isUUID().withMessage('Invalid product ID'),
  body('items.*.quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be positive'),
  body('couponCode').optional().trim(),
  body('billingAddress').optional().isObject()
];

// Create order
router.post('/',
  authMiddleware,
  apiLimiter,
  createOrderValidator,
  validate,
  orderController.create
);

// Get my orders
router.get('/my',
  authMiddleware,
  apiLimiter,
  orderController.getMyOrders
);

// Get seller orders
router.get('/seller',
  authMiddleware,
  requireRole('seller', 'admin'),
  apiLimiter,
  orderController.getSellerOrders
);

// Get all orders (admin)
router.get('/all',
  authMiddleware,
  requireRole('admin'),
  apiLimiter,
  orderController.getAll
);

// Get order by ID
router.get('/:id',
  authMiddleware,
  param('id').isUUID(),
  validate,
  orderController.getById
);

// Update order status
router.put('/:id/status',
  authMiddleware,
  requireRole('admin'),
  body('status').isIn(['pending', 'processing', 'completed', 'cancelled', 'refunded']),
  validate,
  orderController.updateStatus
);

// Refund order
router.post('/:id/refund',
  authMiddleware,
  requireRole('admin'),
  param('id').isUUID(),
  validate,
  orderController.refund
);

// Downloads
router.get('/:productId/download',
  authMiddleware,
  downloadController.getDownloadUrl
);

router.get('/my/downloads',
  authMiddleware,
  downloadController.getMyDownloads
);

router.get('/my/purchases',
  authMiddleware,
  downloadController.getMyPurchasedProducts
);

router.post('/license/verify',
  authMiddleware,
  body('licenseKey').notEmpty(),
  body('productId').isUUID(),
  validate,
  downloadController.verifyLicense
);

router.post('/license/activate',
  authMiddleware,
  body('licenseKey').notEmpty(),
  body('productId').isUUID(),
  validate,
  downloadController.activateLicense
);

module.exports = router;
