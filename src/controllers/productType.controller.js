const { getSupabaseAdmin } = require('../config/database');
const ApiResponse = require('../utils/response');
const { slugify, generateUniqueSlug } = require('../helpers/slug');
const logger = require('../utils/logger');

class ProductTypeController {
  async create(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { name, description, icon, sortOrder } = req.body;

      const baseSlug = slugify(name);
      const slug = await generateUniqueSlug(baseSlug, supabase.from('product_types'));

      const { data: productType, error } = await supabase
        .from('product_types')
        .insert({
          name,
          slug,
          description,
          icon,
          sort_order: sortOrder || 0
        })
        .select()
        .single();

      if (error) throw error;

      ApiResponse.success(res, productType, 'Product type created successfully', 201);
    } catch (error) {
      logger.error('Create product type error:', error);
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
        icon: 'icon',
        sortOrder: 'sort_order'
      };

      for (const [key, dbField] of Object.entries(fieldMapping)) {
        if (body[key] !== undefined) {
          updateFields[dbField] = body[key];
        }
      }

      const { data: productType, error } = await supabase
        .from('product_types')
        .update(updateFields)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      if (!productType) {
        return ApiResponse.error(res, 'Product type not found', 404);
      }

      ApiResponse.success(res, productType, 'Product type updated successfully');
    } catch (error) {
      logger.error('Update product type error:', error);
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { id } = req.params;

      const { error } = await supabase
        .from('product_types')
        .delete()
        .eq('id', id);

      if (error) throw error;

      ApiResponse.success(res, null, 'Product type deleted successfully');
    } catch (error) {
      logger.error('Delete product type error:', error);
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { id } = req.params;

      const { data: productType, error } = await supabase
        .from('product_types')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!productType) {
        return ApiResponse.error(res, 'Product type not found', 404);
      }

      ApiResponse.success(res, productType, 'Product type retrieved successfully');
    } catch (error) {
      logger.error('Get product type error:', error);
      next(error);
    }
  }

  async list(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();

      const { data: productTypes, error } = await supabase
        .from('product_types')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;

      ApiResponse.success(res, productTypes, 'Product types retrieved successfully');
    } catch (error) {
      logger.error('List product types error:', error);
      next(error);
    }
  }
}

module.exports = new ProductTypeController();
