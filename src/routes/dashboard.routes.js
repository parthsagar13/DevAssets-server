const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { authMiddleware, requireRole } = require('../middlewares/auth');
const { apiLimiter } = require('../middlewares/rateLimiter');

// Admin dashboard stats
router.get('/admin',
  authMiddleware,
  requireRole('admin'),
  apiLimiter,
  dashboardController.getAdminStats
);

// Seller dashboard stats
router.get('/seller',
  authMiddleware,
  requireRole('seller', 'admin'),
  apiLimiter,
  dashboardController.getSellerStats
);

// Revenue chart
router.get('/revenue',
  authMiddleware,
  apiLimiter,
  dashboardController.getRevenueChart
);

// Category stats
router.get('/categories',
  authMiddleware,
  requireRole('admin'),
  apiLimiter,
  dashboardController.getCategoryStats
);

// Framework stats
router.get('/frameworks',
  authMiddleware,
  requireRole('admin'),
  apiLimiter,
  dashboardController.getFrameworkStats
);

module.exports = router;
