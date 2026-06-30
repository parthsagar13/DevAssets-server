const express = require('express');
const router = express.Router();
const frameworkController = require('../controllers/framework.controller');
const { authMiddleware, requireRole } = require('../middlewares/auth');
const { apiLimiter } = require('../middlewares/rateLimiter');
const validate = require('../middlewares/validate');
const { body, param } = require('express-validator');

const createFrameworkValidator = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('description').optional().trim(),
  body('logoUrl').optional().isURL().withMessage('Invalid logo URL'),
  body('websiteUrl').optional().isURL().withMessage('Invalid website URL'),
  body('color').optional().trim().isLength({ max: 20 }),
  body('isPopular').optional().isBoolean(),
  body('sortOrder').optional().isInt()
];

// Public routes
router.get('/', apiLimiter, frameworkController.list);
router.get('/slug/:slug', apiLimiter, frameworkController.getBySlug);
router.get('/:id', apiLimiter, param('id').isUUID(), validate, frameworkController.getById);
router.get('/:id/products', apiLimiter, frameworkController.getProducts);

// Protected routes
router.post('/', authMiddleware, requireRole('admin'), createFrameworkValidator, validate, frameworkController.create);
router.put('/:id', authMiddleware, requireRole('admin'), param('id').isUUID(), validate, frameworkController.update);
router.delete('/:id', authMiddleware, requireRole('admin'), param('id').isUUID(), validate, frameworkController.delete);

module.exports = router;
