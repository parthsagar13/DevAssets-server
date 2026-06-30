const { body, param, query } = require('express-validator');

const createProductValidator = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Product name is required')
    .isLength({ max: 300 })
    .withMessage('Product name cannot exceed 300 characters'),

  body('shortDescription')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Short description cannot exceed 500 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 50000 })
    .withMessage('Description cannot exceed 50000 characters'),

  body('categoryId')
    .optional()
    .isUUID()
    .withMessage('Invalid category ID'),

  body('frameworkId')
    .optional()
    .isUUID()
    .withMessage('Invalid framework ID'),

  body('productTypeId')
    .optional()
    .isUUID()
    .withMessage('Invalid product type ID'),

  body('price')
    .notEmpty()
    .withMessage('Price is required')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),

  body('compareAtPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Compare at price must be a positive number'),

  body('currency')
    .optional()
    .isLength({ min: 3, max: 10 })
    .withMessage('Invalid currency'),

  body('demoUrl')
    .optional()
    .trim()
    .isURL()
    .withMessage('Demo URL must be a valid URL'),

  body('documentationUrl')
    .optional()
    .trim()
    .isURL()
    .withMessage('Documentation URL must be a valid URL'),

  body('filePath')
    .notEmpty()
    .withMessage('File path is required'),

  body('thumbnailUrl')
    .optional()
    .trim()
    .isURL()
    .withMessage('Thumbnail URL must be a valid URL'),

  body('version')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Version cannot exceed 50 characters'),

  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),

  body('isFree')
    .optional()
    .isBoolean()
    .withMessage('isFree must be a boolean'),

  body('status')
    .optional()
    .isIn(['draft', 'pending', 'published', 'archived'])
    .withMessage('Invalid status')
];

const updateProductValidator = [
  param('id')
    .isUUID()
    .withMessage('Invalid product ID'),

  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 300 })
    .withMessage('Product name must be between 1 and 300 characters'),

  body('shortDescription')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Short description cannot exceed 500 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 50000 })
    .withMessage('Description cannot exceed 50000 characters'),

  body('categoryId')
    .optional()
    .isUUID()
    .withMessage('Invalid category ID'),

  body('frameworkId')
    .optional()
    .isUUID()
    .withMessage('Invalid framework ID'),

  body('productTypeId')
    .optional()
    .isUUID()
    .withMessage('Invalid product type ID'),

  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),

  body('compareAtPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Compare at price must be a positive number'),

  body('status')
    .optional()
    .isIn(['draft', 'pending', 'published', 'archived'])
    .withMessage('Invalid status')
];

const productQueryValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  query('sortBy')
    .optional()
    .isIn(['created_at', 'name', 'price', 'download_count', 'view_count', 'purchase_count', 'average_rating'])
    .withMessage('Invalid sort field'),

  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Invalid sort order'),

  query('search')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Search query cannot exceed 200 characters'),

  query('category')
    .optional()
    .trim(),

  query('framework')
    .optional()
    .trim(),

  query('minPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Min price must be a positive number'),

  query('maxPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Max price must be a positive number'),

  query('isFree')
    .optional()
    .isBoolean()
    .withMessage('isFree must be a boolean'),

  query('isFeatured')
    .optional()
    .isBoolean()
    .withMessage('isFeatured must be a boolean'),

  query('isTrending')
    .optional()
    .isBoolean()
    .withMessage('isTrending must be a boolean')
];

const productIdValidator = [
  param('id')
    .isUUID()
    .withMessage('Invalid product ID')
];

const productSlugValidator = [
  param('slug')
    .trim()
    .notEmpty()
    .withMessage('Product slug is required')
];

module.exports = {
  createProductValidator,
  updateProductValidator,
  productQueryValidator,
  productIdValidator,
  productSlugValidator
};
