const { getSupabaseAdmin } = require('../config/database');
const ApiResponse = require('../utils/response');
const { slugify, generateUniqueSlug } = require('../helpers/slug');
const logger = require('../utils/logger');

class TagController {
  async create(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { name } = req.body;

      const baseSlug = slugify(name);
      const slug = await generateUniqueSlug(baseSlug, supabase.from('tags'));

      const { data: tag, error } = await supabase
        .from('tags')
        .insert({ name, slug })
        .select()
        .single();

      if (error) throw error;

      ApiResponse.success(res, tag, 'Tag created successfully', 201);
    } catch (error) {
      logger.error('Create tag error:', error);
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { id } = req.params;

      const { error } = await supabase
        .from('tags')
        .delete()
        .eq('id', id);

      if (error) throw error;

      ApiResponse.success(res, null, 'Tag deleted successfully');
    } catch (error) {
      logger.error('Delete tag error:', error);
      next(error);
    }
  }

  async list(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();

      const { data: tags, error } = await supabase
        .from('tags')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;

      ApiResponse.success(res, tags, 'Tags retrieved successfully');
    } catch (error) {
      logger.error('List tags error:', error);
      next(error);
    }
  }

  async getProducts(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { slug } = req.params;
      const { page = 1, limit = 12 } = req.query;
      const PaginationHelper = require('../helpers/pagination');
      const { offset } = PaginationHelper.getPagination(page, limit);

      const { data: tag } = await supabase
        .from('tags')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();

      if (!tag) {
        return ApiResponse.error(res, 'Tag not found', 404);
      }

      const { data: productTags, count, error } = await supabase
        .from('product_tags')
        .select(`
          product:products!(
            *,
            category:categories(id, name, slug),
            framework:frameworks(id, name, slug),
            seller:users!products_seller_id_fkey(id, username, store_name, avatar_url)
          )
        `, { count: 'exact' })
        .eq('tag_id', tag.id)
        .range(offset, offset + parseInt(limit) - 1);

      if (error) throw error;

      const products = productTags?.map(pt => pt.product).filter(p => p.status === 'published') || [];

      ApiResponse.paginated(res, products, page, limit, count, 'Tag products retrieved successfully');
    } catch (error) {
      logger.error('Get tag products error:', error);
      next(error);
    }
  }
}

module.exports = new TagController();
