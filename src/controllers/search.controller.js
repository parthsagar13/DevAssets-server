const { getSupabaseAdmin } = require('../config/database');
const ApiResponse = require('../utils/response');
const logger = require('../utils/logger');

class SearchController {
  async globalSearch(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { q, limit = 10 } = req.query;

      if (!q || q.trim().length < 2) {
        return ApiResponse.error(res, 'Search query must be at least 2 characters', 400);
      }

      const searchTerm = q.trim();

      const [productsResult, categoriesResult, frameworksResult] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, slug, price, thumbnail_url, is_free')
          .eq('status', 'published')
          .is('deleted_at', null)
          .or(`name.ilike.%${searchTerm}%,short_description.ilike.%${searchTerm}%`)
          .limit(parseInt(limit)),
        supabase
          .from('categories')
          .select('id, name, slug')
          .or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
          .limit(5),
        supabase
          .from('frameworks')
          .select('id, name, slug')
          .ilike('name', `%${searchTerm}%`)
          .limit(5)
      ]);

      const results = [
        {
          type: 'products',
          items: productsResult.data || []
        },
        {
          type: 'categories',
          items: categoriesResult.data || []
        },
        {
          type: 'frameworks',
          items: frameworksResult.data || []
        }
      ];

      ApiResponse.success(res, results, 'Search results retrieved successfully');
    } catch (error) {
      logger.error('Global search error:', error);
      next(error);
    }
  }

  async searchProducts(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { q, page = 1, limit = 12, category, framework, minPrice, maxPrice, isFree, sortBy, sortOrder } = req.query;
      const PaginationHelper = require('../helpers/pagination');
      const { offset } = PaginationHelper.getPagination(page, limit);

      let query = supabase
        .from('products')
        .select(`
          *,
          category:categories(id, name, slug),
          framework:frameworks(id, name, slug),
          seller:users!products_seller_id_fkey(id, username, store_name, avatar_url)
        `, { count: 'exact' })
        .eq('status', 'published')
        .is('deleted_at', null);

      if (q) {
        query = query.or(`name.ilike.%${q}%,short_description.ilike.%${q}%,description.ilike.%${q}%`);
      }

      if (category) {
        query = query.eq('category_id', category);
      }

      if (framework) {
        query = query.eq('framework_id', framework);
      }

      if (minPrice !== undefined) {
        query = query.gte('price', parseFloat(minPrice));
      }

      if (maxPrice !== undefined) {
        query = query.lte('price', parseFloat(maxPrice));
      }

      if (isFree !== undefined) {
        query = query.eq('is_free', isFree === 'true');
      }

      const sortField = sortBy || 'created_at';
      const ascending = sortOrder === 'asc';
      query = query.order(sortField, { ascending });
      query = query.range(offset, offset + parseInt(limit) - 1);

      const { data: products, count, error } = await query;

      if (error) throw error;

      ApiResponse.paginated(res, products, page, limit, count, 'Product search results retrieved successfully');
    } catch (error) {
      logger.error('Search products error:', error);
      next(error);
    }
  }

  async autocomplete(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { q, limit = 5 } = req.query;

      if (!q || q.trim().length < 2) {
        return ApiResponse.success(res, [], 'Autocomplete results');
      }

      const searchTerm = q.trim();

      const [products, categories, frameworks, tags] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, slug')
          .eq('status', 'published')
          .ilike('name', `${searchTerm}%`)
          .limit(parseInt(limit)),
        supabase
          .from('categories')
          .select('id, name, slug')
          .ilike('name', `${searchTerm}%`)
          .limit(3),
        supabase
          .from('frameworks')
          .select('id, name, slug')
          .ilike('name', `${searchTerm}%`)
          .limit(3),
        supabase
          .from('tags')
          .select('id, name, slug')
          .ilike('name', `${searchTerm}%`)
          .limit(3)
      ]);

      const suggestions = [
        ...(products.data?.map(p => ({ type: 'product', id: p.id, name: p.name, slug: p.slug })) || []),
        ...(categories.data?.map(c => ({ type: 'category', id: c.id, name: c.name, slug: c.slug })) || []),
        ...(frameworks.data?.map(f => ({ type: 'framework', id: f.id, name: f.name, slug: f.slug })) || []),
        ...(tags.data?.map(t => ({ type: 'tag', id: t.id, name: t.name, slug: t.slug })) || [])
      ];

      ApiResponse.success(res, suggestions, 'Autocomplete suggestions retrieved successfully');
    } catch (error) {
      logger.error('Autocomplete error:', error);
      next(error);
    }
  }

  async getSuggestions(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { productId } = req.params;

      const { data: product } = await supabase
        .from('products')
        .select('id, category_id, framework_id')
        .eq('id', productId)
        .maybeSingle();

      if (!product) {
        return ApiResponse.error(res, 'Product not found', 404);
      }

      const { data: suggestions, error } = await supabase
        .from('products')
        .select(`
          id, name, slug, price, thumbnail_url, average_rating
        `)
        .eq('status', 'published')
        .neq('id', productId)
        .or(`category_id.eq.${product.category_id},framework_id.eq.${product.framework_id}`)
        .limit(8);

      ApiResponse.success(res, suggestions || [], 'Product suggestions retrieved successfully');
    } catch (error) {
      logger.error('Get suggestions error:', error);
      next(error);
    }
  }
}

module.exports = new SearchController();
