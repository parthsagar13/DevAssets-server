const { getSupabaseAdmin } = require('../config/database');
const ApiResponse = require('../utils/response');
const PaginationHelper = require('../helpers/pagination');
const logger = require('../utils/logger');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const storageConfig = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${uuidv4()}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const allowedDocTypes = ['application/pdf', 'application/zip', 'application/x-zip-compressed'];
  const allowedVideoTypes = ['video/mp4', 'video/webm'];

  const allAllowedTypes = [...allowedImageTypes, ...allowedDocTypes, ...allowedVideoTypes];

  if (allAllowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`), false);
  }
};

const upload = multer({
  storage: storageConfig,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }
});

class MediaController {
  constructor() {
    this.upload = upload;
  }

  async uploadSingle(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const userId = req.user.id;

      if (!req.file) {
        return ApiResponse.error(res, 'No file uploaded', 400);
      }

      const file = req.file;
      const fileUrl = `/uploads/${file.filename}`;

      const resourceType = file.mimetype.startsWith('image/') ? 'image' :
                          file.mimetype.startsWith('video/') ? 'video' : 'raw';

      const { data: media, error } = await supabase
        .from('media')
        .insert({
          user_id: userId,
          filename: file.filename,
          original_name: file.originalname,
          mime_type: file.mimetype,
          size: file.size,
          url: fileUrl,
          resource_type: resourceType,
          folder: req.body.folder || 'general'
        })
        .select()
        .single();

      if (error) throw error;

      ApiResponse.success(res, media, 'File uploaded successfully', 201);
    } catch (error) {
      logger.error('Upload error:', error);
      next(error);
    }
  }

  async uploadMultiple(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const userId = req.user.id;

      if (!req.files || req.files.length === 0) {
        return ApiResponse.error(res, 'No files uploaded', 400);
      }

      const uploadedFiles = [];

      for (const file of req.files) {
        const fileUrl = `/uploads/${file.filename}`;
        const resourceType = file.mimetype.startsWith('image/') ? 'image' :
                            file.mimetype.startsWith('video/') ? 'video' : 'raw';

        const { data: media, error } = await supabase
          .from('media')
          .insert({
            user_id: userId,
            filename: file.filename,
            original_name: file.originalname,
            mime_type: file.mimetype,
            size: file.size,
            url: fileUrl,
            resource_type: resourceType,
            folder: req.body.folder || 'general'
          })
          .select()
          .single();

        if (!error && media) {
          uploadedFiles.push(media);
        }
      }

      ApiResponse.success(res, uploadedFiles, `${uploadedFiles.length} files uploaded successfully`, 201);
    } catch (error) {
      logger.error('Multiple upload error:', error);
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { id } = req.params;
      const userId = req.user.id;
      const isAdmin = req.user.role?.name === 'admin';

      const { data: media, error: fetchError } = await supabase
        .from('media')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!media) {
        return ApiResponse.error(res, 'Media not found', 404);
      }

      if (!isAdmin && media.user_id !== userId) {
        return ApiResponse.error(res, 'Unauthorized', 403);
      }

      const filePath = path.join('uploads', media.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      const { error } = await supabase
        .from('media')
        .delete()
        .eq('id', id);

      if (error) throw error;

      ApiResponse.success(res, null, 'Media deleted successfully');
    } catch (error) {
      logger.error('Delete media error:', error);
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { id } = req.params;

      const { data: media, error } = await supabase
        .from('media')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!media) {
        return ApiResponse.error(res, 'Media not found', 404);
      }

      ApiResponse.success(res, media, 'Media retrieved successfully');
    } catch (error) {
      logger.error('Get media error:', error);
      next(error);
    }
  }

  async list(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const userId = req.user.id;
      const isAdmin = req.user.role?.name === 'admin';
      const { page = 1, limit = 20, folder, type } = req.query;
      const { offset } = PaginationHelper.getPagination(page, limit);

      let query = supabase
        .from('media')
        .select('*', { count: 'exact' });

      if (!isAdmin) {
        query = query.eq('user_id', userId);
      }

      if (folder) {
        query = query.eq('folder', folder);
      }

      if (type) {
        query = query.eq('resource_type', type);
      }

      query = query.order('created_at', { ascending: false });
      query = query.range(offset, offset + parseInt(limit) - 1);

      const { data: media, count, error } = await query;

      if (error) throw error;

      ApiResponse.paginated(res, media, page, limit, count, 'Media retrieved successfully');
    } catch (error) {
      logger.error('List media error:', error);
      next(error);
    }
  }

  async getFolders(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const userId = req.user.id;
      const isAdmin = req.user.role?.name === 'admin';

      let query = supabase
        .from('media')
        .select('folder');

      if (!isAdmin) {
        query = query.eq('user_id', userId);
      }

      const { data: media, error } = await query;

      if (error) throw error;

      const folders = [...new Set(media?.map(m => m.folder).filter(Boolean))];

      ApiResponse.success(res, folders, 'Folders retrieved successfully');
    } catch (error) {
      logger.error('Get folders error:', error);
      next(error);
    }
  }
}

module.exports = new MediaController();
