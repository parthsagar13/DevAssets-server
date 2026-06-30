const { getSupabaseAdmin } = require('../config/database');
const ApiResponse = require('../utils/response');
const PaginationHelper = require('../helpers/pagination');
const { slugify, generateUniqueSlug } = require('../helpers/slug');
const logger = require('../utils/logger');

class CategoryController {
  async create(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const {
        name,
        description,
        parentId,
        imageUrl,
        icon,
        sortOrder,
        isVisible,
        metaTitle,
        metaDescription
      } = req.body;

      const baseSlug = slugify(name);
      const slug = await generateUniqueSlug(baseSlug, supabase.from('categories'));

      const { data: category, error } = await supabase
        .from('categories')
        .insert({
          name,
          slug,
          description,
          parent_id: parentId,
          image_url: imageUrl,
          icon,
          sort_order: sortOrder || 0,
          is_visible: isVisible !== false,
          meta_title: metaTitle,
          meta_description: metaDescription
        })
        .select()
        .single();

      if (error) throw error;

      ApiResponse.success(res, category, 'Category created successfully', 201);
    } catch (error) {
      logger.error('Create category error:', error);
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { id } = req.params;

      const updateFields = {};
      const body = req.body;
      const fieldMapping = {
        name: 'name',
        description: 'description',
        parentId: 'parent_id',
        imageUrl: 'image_url',
        icon: 'icon',
        sortOrder: 'sort_order',
        isVisible: 'is_visible',
        metaTitle: 'meta_title',
        metaDescription: 'meta_description'
      };

      for (const [key, dbField] of Object.entries(fieldMapping)) {
        if (body[key] !== undefined) {
          updateFields[dbField] = body[key];
        }
      }

      updateFields.updated_at = new Date();

      const { data: category, error } = await supabase
        .from('categories')
        .update(updateFields)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      if (!category) {
        return ApiResponse.error(res, 'Category not found', 404);
      }

      ApiResponse.success(res, category, 'Category updated successfully');
    } catch (error) {
      logger.error('Update category error:', error);
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { id } = req.params;

      const { data: childCategories } = await supabase
        .from('categories')
        .select('id')
        .eq('parent_id', id)
        .limit(1);

      if (childCategories && childCategories.length > 0) {
        return ApiResponse.error(res, 'Cannot delete category with subcategories', 400);
      }

      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) throw error;

      ApiResponse.success(res, null, 'Category deleted successfully');
    } catch (error) {
      logger.error('Delete category error:', error);
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { id } = req.params;

      const { data: category, error } = await supabase
        .from('categories')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!category) {
        return ApiResponse.error(res, 'Category not found', 404);
      }

      ApiResponse.success(res, category, 'Category retrieved successfully');
    } catch (error) {
      logger.error('Get category error:', error);
      next(error);
    }
  }

  async getBySlug(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { slug } = req.params;

      const { data: category, error } = await supabase
        .from('categories')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();

      if (!category) {
        return ApiResponse.error(res, 'Category not found', 404);
      }

      ApiResponse.success(res, category, 'Category retrieved successfully');
    } catch (error) {
      logger.error('Get category by slug error:', error);
      next(error);
    }
  }

  async list(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { parentId, visibleOnly } = req.query;

      let query = supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true });

      if (parentId !== undefined) {
        query = query.is('parent_id', parentId === 'null' ? true : false);
        if (!parentId && parentId !== 'null') {
          query = query.eq('parent_id', parentId);
        }
      }

      if (visibleOnly === 'true') {
        query = query.eq('is_visible', true);
      }

      const { data: categories, error } = await query;

      if (error) throw error;

      ApiResponse.success(res, categories, 'Categories retrieved successfully');
    } catch (error) {
      logger.error('List categories error:', error);
      next(error);
    }
  }

  async getTree(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();

      const { data: categories, error } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;

      const buildTree = (cats, parentId = null) => {
        return cats
          .filter(cat => cat.parent_id === parentId)
          .map(cat => ({
            ...cat,
            children: buildTree(cats, cat.id)
          }));
      };

      const tree = buildTree(categories);

      ApiResponse.success(res, tree, 'Category tree retrieved successfully');
    } catch (error) {
      logger.error('Get category tree error:', error);
      next(error);
    }
  }

  async getProducts(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { id } = req.params;
      const { page = 1, limit = 12 } = req.query;
      const { offset } = PaginationHelper.getPagination(page, limit);

      const { data: products, count, error } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(id, name, slug),
          framework:frameworks(id, name, slug),
          seller:users!products_seller_id_fkey(id, username, store_name, avatar_url)
        `, { count: 'exact' })
        .eq('category_id', id)
        .eq('status', 'published')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(offset, offset + parseInt(limit) - 1);

      if (error) throw error;

      ApiResponse.paginated(res, products, page, limit, count, 'Category products retrieved successfully');
    } catch (error) {
      logger.error('Get category products error:', error);
      next(error);
    }
  }
}

module.exports = new CategoryController();
