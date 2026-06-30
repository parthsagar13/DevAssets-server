const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/category.controller');
const { authMiddleware, requireRole } = require('../middlewares/auth');
const { apiLimiter } = require('../middlewares/rateLimiter');
const validate = require('../middlewares/validate');
const { body, param, query } = require('express-validator');

const createCategoryValidator = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 200 }),
  body('description').optional().trim(),
  body('parentId').optional().isUUID().withMessage('Invalid parent ID'),
  body('imageUrl').optional().isURL().withMessage('Invalid image URL'),
  body('sortOrder').optional().isInt().withMessage('Sort order must be an integer'),
  body('isVisible').optional().isBoolean()
];

const updateCategoryValidator = [
  param('id').isUUID().withMessage('Invalid category ID'),
  body('name').optional().trim().isLength({ max: 200 }),
  body('description').optional().trim()
];

// Public routes
router.get('/', apiLimiter, categoryController.list);
router.get('/tree', apiLimiter, categoryController.getTree);
router.get('/slug/:slug', apiLimiter, categoryController.getBySlug);
router.get('/:id', apiLimiter, param('id').isUUID(), validate, categoryController.getById);
router.get('/:id/products', apiLimiter, categoryController.getProducts);

// Protected routes
router.post('/', authMiddleware, requireRole('admin'), createCategoryValidator, validate, categoryController.create);
router.put('/:id', authMiddleware, requireRole('admin'), updateCategoryValidator, validate, categoryController.update);
router.delete('/:id', authMiddleware, requireRole('admin'), param('id').isUUID(), validate, categoryController.delete);

module.exports = router;
