const express = require('express');
const router = express.Router();
const searchController = require('../controllers/search.controller');
const { apiLimiter } = require('../middlewares/rateLimiter');
const validate = require('../middlewares/validate');
const { query } = require('express-validator');

// Global search
router.get('/',
  apiLimiter,
  query('q').optional().trim(),
  searchController.globalSearch
);

// Product search
router.get('/products',
  apiLimiter,
  searchController.searchProducts
);

// Autocomplete
router.get('/autocomplete',
  apiLimiter,
  query('q').trim().isLength({ min: 2 }),
  validate,
  searchController.autocomplete
);

// Product suggestions
router.get('/suggestions/:productId',
  apiLimiter,
  searchController.getSuggestions
);

module.exports = router;
