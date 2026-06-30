const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const { authMiddleware, optionalAuth, requireRole } = require('../middlewares/auth');
const { defaultLimiter, apiLimiter } = require('../middlewares/rateLimiter');
const validate = require('../middlewares/validate');
const {
  createProductValidator,
  updateProductValidator,
  productQueryValidator,
  productIdValidator,
  productSlugValidator
} = require('../validators/product.validator');

/**
 * @swagger
 * tags:
 *   name: Products
 *   description: Product management endpoints
 */

// Public routes
router.get('/',
  apiLimiter,
  productQueryValidator,
  validate,
  productController.list
);

router.get('/featured',
  apiLimiter,
  productController.getFeatured
);

router.get('/trending',
  apiLimiter,
  productController.getTrending
);

router.get('/latest',
  apiLimiter,
  productController.getLatest
);

router.get('/popular',
  apiLimiter,
  productController.getPopular
);

router.get('/slug/:slug',
  apiLimiter,
  productSlugValidator,
  validate,
  productController.getBySlug
);

router.get('/seller/:sellerId',
  apiLimiter,
  productQueryValidator,
  validate,
  productController.getBySeller
);

router.get('/:id/related',
  apiLimiter,
  productIdValidator,
  validate,
  productController.getRelated
);

router.get('/:id',
  apiLimiter,
  productIdValidator,
  validate,
  productController.getById
);

// Protected routes - require authentication
router.post('/',
  authMiddleware,
  requireRole('seller', 'admin'),
  createProductValidator,
  validate,
  productController.create
);

router.get('/my/products',
  authMiddleware,
  productController.getMyProducts
);

router.put('/:id',
  authMiddleware,
  updateProductValidator,
  validate,
  productController.update
);

router.delete('/:id',
  authMiddleware,
  productIdValidator,
  validate,
  productController.delete
);

router.post('/:id/soft-delete',
  authMiddleware,
  productIdValidator,
  validate,
  productController.softDelete
);

router.post('/:id/restore',
  authMiddleware,
  requireRole('admin'),
  productIdValidator,
  validate,
  productController.restore
);

router.post('/:id/duplicate',
  authMiddleware,
  productIdValidator,
  validate,
  productController.duplicate
);

router.post('/:id/publish',
  authMiddleware,
  productIdValidator,
  validate,
  productController.publish
);

router.post('/:id/unpublish',
  authMiddleware,
  productIdValidator,
  validate,
  productController.unpublish
);

router.post('/:id/archive',
  authMiddleware,
  productIdValidator,
  validate,
  productController.archive
);

router.post('/:id/feature',
  authMiddleware,
  requireRole('admin'),
  productIdValidator,
  validate,
  productController.feature
);

router.post('/:id/trending',
  authMiddleware,
  requireRole('admin'),
  productIdValidator,
  validate,
  productController.makeTrending
);

module.exports = router;
