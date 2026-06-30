const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/media.controller');
const { authMiddleware, requireRole } = require('../middlewares/auth');
const { uploadLimiter, apiLimiter } = require('../middlewares/rateLimiter');
const validate = require('../middlewares/validate');
const { param, body } = require('express-validator');

// Upload single file
router.post('/upload',
  authMiddleware,
  uploadLimiter,
  mediaController.upload.single('file'),
  mediaController.uploadSingle
);

// Upload multiple files
router.post('/upload/multiple',
  authMiddleware,
  uploadLimiter,
  mediaController.upload.array('files', 10),
  mediaController.uploadMultiple
);

// Get media library
router.get('/',
  authMiddleware,
  apiLimiter,
  mediaController.list
);

// Get folders
router.get('/folders',
  authMiddleware,
  apiLimiter,
  mediaController.getFolders
);

// Get single media
router.get('/:id',
  authMiddleware,
  apiLimiter,
  param('id').isUUID(),
  validate,
  mediaController.getById
);

// Delete media
router.delete('/:id',
  authMiddleware,
  param('id').isUUID(),
  validate,
  mediaController.delete
);

module.exports = router;
