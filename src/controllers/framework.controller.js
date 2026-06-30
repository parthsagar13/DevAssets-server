const { getSupabaseAdmin } = require('../config/database');
const ApiResponse = require('../utils/response');
const { slugify, generateUniqueSlug } = require('../helpers/slug');
const logger = require('../utils/logger');

class FrameworkController {
  async create(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const {
        name,
        description,
        logoUrl,
        websiteUrl,
        color,
        isPopular,
        sortOrder
      } = req.body;

      const baseSlug = slugify(name);
      const slug = await generateUniqueSlug(baseSlug, supabase.from('frameworks'));

      const { data: framework, error } = await supabase
        .from('frameworks')
        .insert({
          name,
          slug,
          description,
          logo_url: logoUrl,
          website_url: websiteUrl,
          color,
          is_popular: isPopular || false,
          sort_order: sortOrder || 0
        })
        .select()
        .single();

      if (error) throw error;

      ApiResponse.success(res, framework, 'Framework created successfully', 201);
    } catch (error) {
      logger.error('Create framework error:', error);
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { id } = req.params;

      const updateFields = { updated_at: new Date() };
      const body = req.body;
      const fieldMapping = {
        name: 'name',
        description: 'description',
        logoUrl: 'logo_url',
        websiteUrl: 'website_url',
        color: 'color',
        isPopular: 'is_popular',
        sortOrder: 'sort_order'
      };

      for (const [key, dbField] of Object.entries(fieldMapping)) {
        if (body[key] !== undefined) {
          updateFields[dbField] = body[key];
        }
      }

      const { data: framework, error } = await supabase
        .from('frameworks')
        .update(updateFields)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      if (!framework) {
        return ApiResponse.error(res, 'Framework not found', 404);
      }

      ApiResponse.success(res, framework, 'Framework updated successfully');
    } catch (error) {
      logger.error('Update framework error:', error);
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { id } = req.params;

      const { error } = await supabase
        .from('frameworks')
        .delete()
        .eq('id', id);

      if (error) throw error;

      ApiResponse.success(res, null, 'Framework deleted successfully');
    } catch (error) {
      logger.error('Delete framework error:', error);
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { id } = req.params;

      const { data: framework, error } = await supabase
        .from('frameworks')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!framework) {
        return ApiResponse.error(res, 'Framework not found', 404);
      }

      ApiResponse.success(res, framework, 'Framework retrieved successfully');
    } catch (error) {
      logger.error('Get framework error:', error);
      next(error);
    }
  }

  async getBySlug(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { slug } = req.params;

      const { data: framework, error } = await supabase
        .from('frameworks')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();

      if (!framework) {
        return ApiResponse.error(res, 'Framework not found', 404);
      }

      ApiResponse.success(res, framework, 'Framework retrieved successfully');
    } catch (error) {
      logger.error('Get framework by slug error:', error);
      next(error);
    }
  }

  async list(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { popularOnly } = req.query;

      let query = supabase
        .from('frameworks')
        .select('*')
        .order('sort_order', { ascending: true });

      if (popularOnly === 'true') {
        query = query.eq('is_popular', true);
      }

      const { data: frameworks, error } = await query;

      if (error) throw error;

      ApiResponse.success(res, frameworks, 'Frameworks retrieved successfully');
    } catch (error) {
      logger.error('List frameworks error:', error);
      next(error);
    }
  }

  async getProducts(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { id } = req.params;
      const { page = 1, limit = 12 } = req.query;
      const PaginationHelper = require('../helpers/pagination');
      const { offset } = PaginationHelper.getPagination(page, limit);

      const { data: products, count, error } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(id, name, slug),
          framework:frameworks(id, name, slug),
          seller:users!products_seller_id_fkey(id, username, store_name, avatar_url)
        `, { count: 'exact' })
        .eq('framework_id', id)
        .eq('status', 'published')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(offset, offset + parseInt(limit) - 1);

      if (error) throw error;

      ApiResponse.paginated(res, products, page, limit, count, 'Framework products retrieved successfully');
    } catch (error) {
      logger.error('Get framework products error:', error);
      next(error);
    }
  }
}

module.exports = new FrameworkController();
