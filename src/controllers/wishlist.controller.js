const { getSupabaseAdmin } = require('../config/database');
const ApiResponse = require('../utils/response');
const PaginationHelper = require('../helpers/pagination');
const logger = require('../utils/logger');

class WishlistController {
  async add(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const userId = req.user.id;
      const { productId } = req.body;

      const { data: product } = await supabase
        .from('products')
        .select('id')
        .eq('id', productId)
        .maybeSingle();

      if (!product) {
        return ApiResponse.error(res, 'Product not found', 404);
      }

      const { data: existing } = await supabase
        .from('wishlists')
        .select('id')
        .eq('user_id', userId)
        .eq('product_id', productId)
        .maybeSingle();

      if (existing) {
        return ApiResponse.error(res, 'Product already in wishlist', 400);
      }

      const { data: wishlist, error } = await supabase
        .from('wishlists')
        .insert({
          user_id: userId,
          product_id: productId
        })
        .select(`
          *,
          product:products(
            id, name, slug, price, thumbnail_url,
            seller:users!products_seller_id_fkey(id, username, store_name)
          )
        `)
        .single();

      if (error) throw error;

      ApiResponse.success(res, wishlist, 'Product added to wishlist', 201);
    } catch (error) {
      logger.error('Add to wishlist error:', error);
      next(error);
    }
  }

  async remove(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const userId = req.user.id;
      const { productId } = req.params;

      const { error } = await supabase
        .from('wishlists')
        .delete()
        .eq('user_id', userId)
        .eq('product_id', productId);

      if (error) throw error;

      ApiResponse.success(res, null, 'Product removed from wishlist');
    } catch (error) {
      logger.error('Remove from wishlist error:', error);
      next(error);
    }
  }

  async getMyWishlist(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const userId = req.user.id;
      const { page = 1, limit = 20 } = req.query;
      const { offset } = PaginationHelper.getPagination(page, limit);

      const { data: wishlist, count, error } = await supabase
        .from('wishlists')
        .select(`
          *,
          product:products(
            id, name, slug, price, compare_at_price, thumbnail_url,
            category:categories(id, name, slug),
            framework:frameworks(id, name, slug),
            seller:users!products_seller_id_fkey(id, username, store_name, avatar_url)
          )
        `, { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + parseInt(limit) - 1);

      if (error) throw error;

      ApiResponse.paginated(res, wishlist, page, limit, count, 'Wishlist retrieved successfully');
    } catch (error) {
      logger.error('Get wishlist error:', error);
      next(error);
    }
  }

  async check(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const userId = req.user.id;
      const { productId } = req.params;

      const { data: wishlist } = await supabase
        .from('wishlists')
        .select('id')
        .eq('user_id', userId)
        .eq('product_id', productId)
        .maybeSingle();

      ApiResponse.success(res, { inWishlist: !!wishlist }, 'Wishlist status retrieved');
    } catch (error) {
      logger.error('Check wishlist error:', error);
      next(error);
    }
  }
}

module.exports = new WishlistController();
