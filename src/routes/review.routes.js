const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/review.controller');
const { authMiddleware, requireRole } = require('../middlewares/auth');
const { apiLimiter } = require('../middlewares/rateLimiter');
const validate = require('../middlewares/validate');
const { body, param } = require('express-validator');

const createReviewValidator = [
  body('productId').isUUID().withMessage('Invalid product ID'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('title').optional().trim().isLength({ max: 200 }),
  body('content').optional().trim().isLength({ max: 2000 })
];

// Create review
router.post('/',
  authMiddleware,
  apiLimiter,
  createReviewValidator,
  validate,
  reviewController.create
);

// Get product reviews
router.get('/product/:productId',
  apiLimiter,
  reviewController.getProductReviews
);

// Get my reviews
router.get('/my',
  authMiddleware,
  apiLimiter,
  reviewController.getMyReviews
);

// Get all reviews (admin)
router.get('/all',
  authMiddleware,
  requireRole('admin'),
  apiLimiter,
  reviewController.getAll
);

// Update review
router.put('/:id',
  authMiddleware,
  param('id').isUUID(),
  validate,
  reviewController.update
);

// Delete review
router.delete('/:id',
  authMiddleware,
  param('id').isUUID(),
  validate,
  reviewController.delete
);

// Approve review (admin)
router.post('/:id/approve',
  authMiddleware,
  requireRole('admin'),
  param('id').isUUID(),
  validate,
  reviewController.approve
);

// Reject review (admin)
router.post('/:id/reject',
  authMiddleware,
  requireRole('admin'),
  param('id').isUUID(),
  validate,
  reviewController.reject
);

module.exports = router;
