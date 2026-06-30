const express = require('express');
const router = express.Router();
const productTypeController = require('../controllers/productType.controller');
const tagController = require('../controllers/tag.controller');
const { authMiddleware, requireRole } = require('../middlewares/auth');
const { apiLimiter } = require('../middlewares/rateLimiter');
const validate = require('../middlewares/validate');
const { body, param } = require('express-validator');

// Product Types routes
router.get('/product-types', apiLimiter, productTypeController.list);
router.get('/product-types/:id', apiLimiter, param('id').isUUID(), validate, productTypeController.getById);
router.post('/product-types', authMiddleware, requireRole('admin'),
  body('name').trim().notEmpty().isLength({ max: 100 }),
  validate,
  productTypeController.create
);
router.put('/product-types/:id', authMiddleware, requireRole('admin'), param('id').isUUID(), validate, productTypeController.update);
router.delete('/product-types/:id', authMiddleware, requireRole('admin'), param('id').isUUID(), validate, productTypeController.delete);

// Tags routes
router.get('/tags', apiLimiter, tagController.list);
router.get('/tags/:slug/products', apiLimiter, tagController.getProducts);
router.post('/tags', authMiddleware, requireRole('admin'),
  body('name').trim().notEmpty().withMessage('Name is required'),
  validate,
  tagController.create
);
router.delete('/tags/:id', authMiddleware, requireRole('admin'), param('id').isUUID(), validate, tagController.delete);

module.exports = router;
