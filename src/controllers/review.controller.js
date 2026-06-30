const { getSupabaseAdmin } = require('../config/database');
const ApiResponse = require('../utils/response');
const PaginationHelper = require('../helpers/pagination');
const logger = require('../utils/logger');

class ReviewController {
  async create(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const userId = req.user.id;
      const { productId, rating, title, content } = req.body;

      const { data: existingReview } = await supabase
        .from('reviews')
        .select('id')
        .eq('product_id', productId)
        .eq('user_id', userId)
        .maybeSingle();

      if (existingReview) {
        return ApiResponse.error(res, 'You have already reviewed this product', 400);
      }

      const { data: purchase } = await supabase
        .from('order_items')
        .select('id')
        .eq('product_id', productId)
        .eq('order.customer_id', userId)
        .eq('order.status', 'completed')
        .maybeSingle();

      const isVerifiedPurchase = !!purchase;

      const { data: review, error } = await supabase
        .from('reviews')
        .insert({
          product_id: productId,
          user_id: userId,
          rating,
          title,
          content,
          is_verified_purchase: isVerifiedPurchase,
          status: 'pending'
        })
        .select(`
          *,
          user:users(id, username, avatar_url)
        `)
        .single();

      if (error) throw error;

      await this.updateProductRating(productId);

      ApiResponse.success(res, review, 'Review submitted successfully. It will be visible after approval.', 201);
    } catch (error) {
      logger.error('Create review error:', error);
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { id } = req.params;
      const userId = req.user.id;
      const { rating, title, content } = req.body;

      const { data: existingReview } = await supabase
        .from('reviews')
        .select('*, product:products(id)')
        .eq('id', id)
        .maybeSingle();

      if (!existingReview) {
        return ApiResponse.error(res, 'Review not found', 404);
      }

      if (existingReview.user_id !== userId) {
        return ApiResponse.error(res, 'Unauthorized', 403);
      }

      const { data: review, error } = await supabase
        .from('reviews')
        .update({
          rating,
          title,
          content,
          status: 'pending',
          updated_at: new Date()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      await this.updateProductRating(existingReview.product_id);

      ApiResponse.success(res, review, 'Review updated successfully');
    } catch (error) {
      logger.error('Update review error:', error);
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { id } = req.params;
      const userId = req.user.id;
      const isAdmin = req.user.role?.name === 'admin';

      const { data: review } = await supabase
        .from('reviews')
        .select('id, user_id, product_id')
        .eq('id', id)
        .maybeSingle();

      if (!review) {
        return ApiResponse.error(res, 'Review not found', 404);
      }

      if (!isAdmin && review.user_id !== userId) {
        return ApiResponse.error(res, 'Unauthorized', 403);
      }

      const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await this.updateProductRating(review.product_id);

      ApiResponse.success(res, null, 'Review deleted successfully');
    } catch (error) {
      logger.error('Delete review error:', error);
      next(error);
    }
  }

  async approve(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { id } = req.params;

      const { data: review, error } = await supabase
        .from('reviews')
        .update({ status: 'approved', updated_at: new Date() })
        .eq('id', id)
        .select()
        .maybeSingle();

      if (!review) {
        return ApiResponse.error(res, 'Review not found', 404);
      }

      await this.updateProductRating(review.product_id);

      ApiResponse.success(res, review, 'Review approved');
    } catch (error) {
      logger.error('Approve review error:', error);
      next(error);
    }
  }

  async reject(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { id } = req.params;

      const { data: review, error } = await supabase
        .from('reviews')
        .update({ status: 'rejected', updated_at: new Date() })
        .eq('id', id)
        .select()
        .maybeSingle();

      if (!review) {
        return ApiResponse.error(res, 'Review not found', 404);
      }

      await this.updateProductRating(review.product_id);

      ApiResponse.success(res, review, 'Review rejected');
    } catch (error) {
      logger.error('Reject review error:', error);
      next(error);
    }
  }

  async getProductReviews(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { productId } = req.params;
      const { page = 1, limit = 10, rating } = req.query;
      const { offset } = PaginationHelper.getPagination(page, limit);

      let query = supabase
        .from('reviews')
        .select(`
          *,
          user:users(id, username, avatar_url)
        `, { count: 'exact' })
        .eq('product_id', productId)
        .eq('status', 'approved');

      if (rating) {
        query = query.eq('rating', parseInt(rating));
      }

      query = query.order('created_at', { ascending: false });
      query = query.range(offset, offset + parseInt(limit) - 1);

      const { data: reviews, count, error } = await query;

      if (error) throw error;

      ApiResponse.paginated(res, reviews, page, limit, count, 'Reviews retrieved successfully');
    } catch (error) {
      logger.error('Get product reviews error:', error);
      next(error);
    }
  }

  async getMyReviews(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const userId = req.user.id;
      const { page = 1, limit = 10 } = req.query;
      const { offset } = PaginationHelper.getPagination(page, limit);

      const { data: reviews, count, error } = await supabase
        .from('reviews')
        .select(`
          *,
          product:products(id, name, slug, thumbnail_url)
        `, { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + parseInt(limit) - 1);

      if (error) throw error;

      ApiResponse.paginated(res, reviews, page, limit, count, 'My reviews retrieved successfully');
    } catch (error) {
      logger.error('Get my reviews error:', error);
      next(error);
    }
  }

  async getAll(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { page = 1, limit = 20, status, productId } = req.query;
      const { offset } = PaginationHelper.getPagination(page, limit);

      let query = supabase
        .from('reviews')
        .select(`
          *,
          user:users(id, username, email),
          product:products(id, name, slug)
        `, { count: 'exact' });

      if (status) {
        query = query.eq('status', status);
      }

      if (productId) {
        query = query.eq('product_id', productId);
      }

      query = query.order('created_at', { ascending: false });
      query = query.range(offset, offset + parseInt(limit) - 1);

      const { data: reviews, count, error } = await query;

      if (error) throw error;

      ApiResponse.paginated(res, reviews, page, limit, count, 'Reviews retrieved successfully');
    } catch (error) {
      logger.error('Get all reviews error:', error);
      next(error);
    }
  }

  async updateProductRating(productId) {
    const supabase = getSupabaseAdmin();

    const { data: reviews } = await supabase
      .from('reviews')
      .select('rating')
      .eq('product_id', productId)
      .eq('status', 'approved');

    if (reviews && reviews.length > 0) {
      const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      await supabase
        .from('products')
        .update({
          average_rating: Math.round(avgRating * 100) / 100,
          review_count: reviews.length
        })
        .eq('id', productId);
    }
  }
}

module.exports = new ReviewController();
