const { getSupabaseAdmin } = require('../config/database');
const ApiResponse = require('../utils/response');
const PaginationHelper = require('../helpers/pagination');
const { slugify, generateUniqueSlug } = require('../helpers/slug');
const logger = require('../utils/logger');

class CouponController {
  async create(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const {
        code,
        description,
        type,
        value,
        minOrderAmount,
        maxDiscount,
        usageLimit,
        validFrom,
        validUntil,
        isActive,
        applicableProducts,
        applicableCategories
      } = req.body;
      const userId = req.user.id;

      const { data: existingCoupon } = await supabase
        .from('coupons')
        .select('id')
        .eq('code', code.toUpperCase())
        .maybeSingle();

      if (existingCoupon) {
        return ApiResponse.error(res, 'Coupon code already exists', 400);
      }

      const { data: coupon, error } = await supabase
        .from('coupons')
        .insert({
          code: code.toUpperCase(),
          description,
          type,
          value,
          min_order_amount: minOrderAmount,
          max_discount: maxDiscount,
          usage_limit: usageLimit,
          valid_from: validFrom,
          valid_until: validUntil,
          is_active: isActive !== false,
          applicable_products: applicableProducts,
          applicable_categories: applicableCategories,
          created_by: userId
        })
        .select()
        .single();

      if (error) throw error;

      ApiResponse.success(res, coupon, 'Coupon created successfully', 201);
    } catch (error) {
      logger.error('Create coupon error:', error);
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
        description: 'description',
        type: 'type',
        value: 'value',
        minOrderAmount: 'min_order_amount',
        maxDiscount: 'max_discount',
        usageLimit: 'usage_limit',
        validFrom: 'valid_from',
        validUntil: 'valid_until',
        isActive: 'is_active',
        applicableProducts: 'applicable_products',
        applicableCategories: 'applicable_categories'
      };

      for (const [key, dbField] of Object.entries(fieldMapping)) {
        if (body[key] !== undefined) {
          updateFields[dbField] = body[key];
        }
      }

      const { data: coupon, error } = await supabase
        .from('coupons')
        .update(updateFields)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (!coupon) {
        return ApiResponse.error(res, 'Coupon not found', 404);
      }

      ApiResponse.success(res, coupon, 'Coupon updated successfully');
    } catch (error) {
      logger.error('Update coupon error:', error);
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { id } = req.params;

      const { error } = await supabase
        .from('coupons')
        .delete()
        .eq('id', id);

      if (error) throw error;

      ApiResponse.success(res, null, 'Coupon deleted successfully');
    } catch (error) {
      logger.error('Delete coupon error:', error);
      next(error);
    }
  }

  async validate(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { code, subtotal, productIds, categoryIds } = req.body;

      const { data: coupon } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', code.toUpperCase())
        .eq('is_active', true)
        .maybeSingle();

      if (!coupon) {
        return ApiResponse.error(res, 'Invalid coupon code', 400);
      }

      if (new Date(coupon.valid_from) > new Date()) {
        return ApiResponse.error(res, 'Coupon is not yet valid', 400);
      }

      if (new Date(coupon.valid_until) < new Date()) {
        return ApiResponse.error(res, 'Coupon has expired', 400);
      }

      if (coupon.usage_limit !== null && coupon.usage_count >= coupon.usage_limit) {
        return ApiResponse.error(res, 'Coupon usage limit reached', 400);
      }

      if (coupon.min_order_amount && subtotal < coupon.min_order_amount) {
        return ApiResponse.error(res, `Minimum order amount is ${coupon.min_order_amount}`, 400);
      }

      if (coupon.applicable_products && coupon.applicable_products.length > 0) {
        const hasApplicableProduct = productIds.some(id => coupon.applicable_products.includes(id));
        if (!hasApplicableProduct) {
          return ApiResponse.error(res, 'Coupon not applicable to these products', 400);
        }
      }

      if (coupon.applicable_categories && coupon.applicable_categories.length > 0) {
        const hasApplicableCategory = categoryIds.some(id => coupon.applicable_categories.includes(id));
        if (!hasApplicableCategory) {
          return ApiResponse.error(res, 'Coupon not applicable to these categories', 400);
        }
      }

      let discount = 0;
      if (coupon.type === 'percentage') {
        discount = subtotal * (coupon.value / 100);
        if (coupon.max_discount) {
          discount = Math.min(discount, coupon.max_discount);
        }
      } else {
        discount = Math.min(coupon.value, subtotal);
      }

      ApiResponse.success(res, {
        valid: true,
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        discount: Math.round(discount * 100) / 100,
        description: coupon.description
      }, 'Coupon is valid');
    } catch (error) {
      logger.error('Validate coupon error:', error);
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { id } = req.params;

      const { data: coupon } = await supabase
        .from('coupons')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!coupon) {
        return ApiResponse.error(res, 'Coupon not found', 404);
      }

      ApiResponse.success(res, coupon, 'Coupon retrieved successfully');
    } catch (error) {
      logger.error('Get coupon error:', error);
      next(error);
    }
  }

  async list(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { page = 1, limit = 20, isActive } = req.query;
      const { offset } = PaginationHelper.getPagination(page, limit);

      let query = supabase
        .from('coupons')
        .select('*', { count: 'exact' });

      if (isActive !== undefined) {
        query = query.eq('is_active', isActive === 'true');
      }

      query = query.order('created_at', { ascending: false });
      query = query.range(offset, offset + parseInt(limit) - 1);

      const { data: coupons, count, error } = await query;

      if (error) throw error;

      ApiResponse.paginated(res, coupons, page, limit, count, 'Coupons retrieved successfully');
    } catch (error) {
      logger.error('List coupons error:', error);
      next(error);
    }
  }
}

module.exports = new CouponController();
