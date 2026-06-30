const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blog.controller');
const { authMiddleware, requireRole } = require('../middlewares/auth');
const { apiLimiter } = require('../middlewares/rateLimiter');
const validate = require('../middlewares/validate');
const { body, param } = require('express-validator');

const createBlogValidator = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 300 }),
  body('content').trim().notEmpty().withMessage('Content is required'),
  body('excerpt').optional().trim().isLength({ max: 500 }),
  body('categoryId').optional().isUUID(),
  body('status').optional().isIn(['draft', 'published'])
];

// Public routes
router.get('/',
  apiLimiter,
  blogController.list
);

router.get('/categories',
  apiLimiter,
  blogController.getAllCategories
);

router.get('/slug/:slug',
  apiLimiter,
  blogController.getBySlug
);

// Protected routes
router.post('/',
  authMiddleware,
  requireRole('admin'),
  apiLimiter,
  createBlogValidator,
  validate,
  blogController.create
);

router.put('/:id',
  authMiddleware,
  requireRole('admin'),
  param('id').isUUID(),
  validate,
  blogController.update
);

router.delete('/:id',
  authMiddleware,
  requireRole('admin'),
  param('id').isUUID(),
  validate,
  blogController.delete
);

router.post('/categories',
  authMiddleware,
  requireRole('admin'),
  body('name').trim().notEmpty(),
  validate,
  blogController.createCategory
);

module.exports = router;
