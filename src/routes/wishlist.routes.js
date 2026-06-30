const express = require('express');
const router = express.Router();
const wishlistController = require('../controllers/wishlist.controller');
const { authMiddleware } = require('../middlewares/auth');
const { apiLimiter } = require('../middlewares/rateLimiter');
const validate = require('../middlewares/validate');
const { body, param } = require('express-validator');

// Add to wishlist
router.post('/',
  authMiddleware,
  apiLimiter,
  body('productId').isUUID(),
  validate,
  wishlistController.add
);

// Get my wishlist
router.get('/',
  authMiddleware,
  apiLimiter,
  wishlistController.getMyWishlist
);

// Check if product is in wishlist
router.get('/check/:productId',
  authMiddleware,
  apiLimiter,
  param('productId').isUUID(),
  validate,
  wishlistController.check
);

// Remove from wishlist
router.delete('/:productId',
  authMiddleware,
  param('productId').isUUID(),
  validate,
  wishlistController.remove
);

module.exports = router;
