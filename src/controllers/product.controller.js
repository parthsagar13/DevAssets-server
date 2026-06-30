const { getSupabaseAdmin } = require('../config/database');
const ApiResponse = require('../utils/response');
const PaginationHelper = require('../helpers/pagination');
const { slugify, generateUniqueSlug } = require('../helpers/slug');
const logger = require('../utils/logger');

class ProductController {
  async create(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const sellerId = req.user.id;
      const {
        name,
        shortDescription,
        description,
        categoryId,
        frameworkId,
        productTypeId,
        price,
        compareAtPrice,
        currency,
        filePath,
        fileSize,
        demoUrl,
        documentationUrl,
        version,
        thumbnailUrl,
        previewUrls,
        status,
        isFree,
        requiresLicense,
        seoTitle,
        seoDescription,
        seoKeywords,
        tags
      } = req.body;

      const baseSlug = slugify(name);
      const slug = await generateUniqueSlug(baseSlug, supabase.from('products'));

      const { data: product, error } = await supabase
        .from('products')
        .insert({
          seller_id: sellerId,
          name,
          slug,
          short_description: shortDescription,
          description,
          category_id: categoryId,
          framework_id: frameworkId,
          product_type_id: productTypeId,
          price,
          compare_at_price: compareAtPrice,
          currency: currency || 'USD',
          file_path: filePath,
          file_size: fileSize,
          demo_url: demoUrl,
          documentation_url: documentationUrl,
          version: version || '1.0.0',
          thumbnail_url: thumbnailUrl,
          preview_urls: previewUrls,
          status: status || 'draft',
          is_free: isFree || false,
          requires_license: requiresLicense !== false,
          seo_title: seoTitle,
          seo_description: seoDescription,
          seo_keywords: seoKeywords,
          published_at: status === 'published' ? new Date() : null
        })
        .select(`
          *,
          category:categories(*),
          framework:frameworks(*),
          product_type:product_types(*),
          seller:users!products_seller_id_fkey(id, email, username, store_name, avatar_url)
        `)
        .single();

      if (error) throw error;

      if (tags && tags.length > 0) {
        for (const tagId of tags) {
          await supabase
            .from('product_tags')
            .insert({ product_id: product.id, tag_id: tagId });
        }
      }

      ApiResponse.success(res, product, 'Product created successfully', 201);
    } catch (error) {
      logger.error('Create product error:', error);
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { id } = req.params;
      const userId = req.user.id;
      const isAdmin = req.user.role?.name === 'admin';

      const { data: existingProduct, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!existingProduct) {
        return ApiResponse.error(res, 'Product not found', 404);
      }

      if (!isAdmin && existingProduct.seller_id !== userId) {
        return ApiResponse.error(res, 'Unauthorized to update this product', 403);
      }

      const updateFields = {};
      const body = req.body;

      const fieldMapping = {
        name: 'name',
        shortDescription: 'short_description',
        description: 'description',
        categoryId: 'category_id',
        frameworkId: 'framework_id',
        productTypeId: 'product_type_id',
        price: 'price',
        compareAtPrice: 'compare_at_price',
        currency: 'currency',
        filePath: 'file_path',
        fileSize: 'file_size',
        demoUrl: 'demo_url',
        documentationUrl: 'documentation_url',
        thumbnailUrl: 'thumbnail_url',
        previewUrls: 'preview_urls',
        changelog: 'changelog',
        version: 'version',
        isFeatured: 'is_featured',
        isTrending: 'is_trending',
        isFree: 'is_free',
        requiresLicense: 'requires_license',
        seoTitle: 'seo_title',
        seoDescription: 'seo_description',
        seoKeywords: 'seo_keywords',
        status: 'status'
      };

      for (const [key, dbField] of Object.entries(fieldMapping)) {
        if (body[key] !== undefined) {
          updateFields[dbField] = body[key];
        }
      }

      if (body.status === 'published' && existingProduct.status !== 'published') {
        updateFields.published_at = new Date();
      }

      updateFields.updated_at = new Date();

      const { data: product, error } = await supabase
        .from('products')
        .update(updateFields)
        .eq('id', id)
        .select(`
          *,
          category:categories(*),
          framework:frameworks(*),
          product_type:product_types(*),
          seller:users!products_seller_id_fkey(id, email, username, store_name, avatar_url)
        `)
        .single();

      if (error) throw error;

      if (body.tags !== undefined) {
        await supabase
          .from('product_tags')
          .delete()
          .eq('product_id', id);

        if (body.tags.length > 0) {
          for (const tagId of body.tags) {
            await supabase
              .from('product_tags')
              .insert({ product_id: id, tag_id: tagId });
          }
        }
      }

      ApiResponse.success(res, product, 'Product updated successfully');
    } catch (error) {
      logger.error('Update product error:', error);
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { id } = req.params;
      const userId = req.user.id;
      const isAdmin = req.user.role?.name === 'admin';

      const { data: product, error: fetchError } = await supabase
        .from('products')
        .select('id, seller_id')
        .eq('id', id)
        .maybeSingle();

      if (!product) {
        return ApiResponse.error(res, 'Product not found', 404);
      }

      if (!isAdmin && product.seller_id !== userId) {
        return ApiResponse.error(res, 'Unauthorized to delete this product', 403);
      }

      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;

      ApiResponse.success(res, null, 'Product deleted successfully');
    } catch (error) {
      logger.error('Delete product error:', error);
      next(error);
    }
  }

  async softDelete(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { id } = req.params;
      const userId = req.user.id;
      const isAdmin = req.user.role?.name === 'admin';

      const { data: product } = await supabase
        .from('products')
        .select('id, seller_id')
        .eq('id', id)
        .maybeSingle();

      if (!product) {
        return ApiResponse.error(res, 'Product not found', 404);
      }

      if (!isAdmin && product.seller_id !== userId) {
        return ApiResponse.error(res, 'Unauthorized', 403);
      }

      const { error } = await supabase
        .from('products')
        .update({ deleted_at: new Date() })
        .eq('id', id);

      if (error) throw error;

      ApiResponse.success(res, null, 'Product soft deleted successfully');
    } catch (error) {
      logger.error('Soft delete product error:', error);
      next(error);
    }
  }

  async restore(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { id } = req.params;

      const { data: product } = await supabase
        .from('products')
        .select('id, deleted_at')
        .eq('id', id)
        .maybeSingle();

      if (!product) {
        return ApiResponse.error(res, 'Product not found', 404);
      }

      if (!product.deleted_at) {
        return ApiResponse.error(res, 'Product is not deleted', 400);
      }

      const { error } = await supabase
        .from('products')
        .update({ deleted_at: null })
        .eq('id', id);

      if (error) throw error;

      ApiResponse.success(res, null, 'Product restored successfully');
    } catch (error) {
      logger.error('Restore product error:', error);
      next(error);
    }
  }

  async duplicate(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { id } = req.params;
      const userId = req.user.id;

      const { data: original, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!original) {
        return ApiResponse.error(res, 'Product not found', 404);
      }

      if (original.seller_id !== userId) {
        return ApiResponse.error(res, 'Unauthorized', 403);
      }

      const baseSlug = slugify(original.name);
      const slug = await generateUniqueSlug(baseSlug, supabase.from('products'));

      const newProduct = await supabase
        .from('products')
        .insert({
          seller_id: userId,
          name: `${original.name} (Copy)`,
          slug,
          short_description: original.short_description,
          description: original.description,
          category_id: original.category_id,
          framework_id: original.framework_id,
          product_type_id: original.product_type_id,
          price: original.price,
          compare_at_price: original.compare_at_price,
          currency: original.currency,
          file_path: original.file_path,
          file_size: original.file_size,
          demo_url: original.demo_url,
          documentation_url: original.documentation_url,
          version: original.version,
          thumbnail_url: original.thumbnail_url,
          preview_urls: original.preview_urls,
          status: 'draft',
          is_free: original.is_free,
          requires_license: original.requires_license,
          seo_title: original.seo_title,
          seo_description: original.seo_description,
          seo_keywords: original.seo_keywords
        })
        .select(`
          *,
          category:categories(*),
          framework:frameworks(*),
          product_type:product_types(*),
          seller:users!products_seller_id_fkey(id, email, username, store_name, avatar_url)
        `)
        .single();

      const { data: tags } = await supabase
        .from('product_tags')
        .select('tag_id')
        .eq('product_id', id);

      if (tags && tags.length > 0) {
        for (const tag of tags) {
          await supabase
            .from('product_tags')
            .insert({ product_id: newProduct.data.id, tag_id: tag.tag_id });
        }
      }

      ApiResponse.success(res, newProduct.data, 'Product duplicated successfully', 201);
    } catch (error) {
      logger.error('Duplicate product error:', error);
      next(error);
    }
  }

  async publish(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { id } = req.params;
      const userId = req.user.id;
      const isAdmin = req.user.role?.name === 'admin';

      const { data: product } = await supabase
        .from('products')
        .select('id, seller_id, status')
        .eq('id', id)
        .maybeSingle();

      if (!product) {
        return ApiResponse.error(res, 'Product not found', 404);
      }

      if (!isAdmin && product.seller_id !== userId) {
        return ApiResponse.error(res, 'Unauthorized', 403);
      }

      const { data: updated, error } = await supabase
        .from('products')
        .update({
          status: 'published',
          published_at: new Date(),
          updated_at: new Date()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      ApiResponse.success(res, updated, 'Product published successfully');
    } catch (error) {
      logger.error('Publish product error:', error);
      next(error);
    }
  }

  async unpublish(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { id } = req.params;
      const userId = req.user.id;
      const isAdmin = req.user.role?.name === 'admin';

      const { data: product } = await supabase
        .from('products')
        .select('id, seller_id')
        .eq('id', id)
        .maybeSingle();

      if (!product) {
        return ApiResponse.error(res, 'Product not found', 404);
      }

      if (!isAdmin && product.seller_id !== userId) {
        return ApiResponse.error(res, 'Unauthorized', 403);
      }

      const { data: updated, error } = await supabase
        .from('products')
        .update({
          status: 'draft',
          updated_at: new Date()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      ApiResponse.success(res, updated, 'Product unpublished successfully');
    } catch (error) {
      logger.error('Unpublish product error:', error);
      next(error);
    }
  }

  async archive(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { id } = req.params;
      const userId = req.user.id;
      const isAdmin = req.user.role?.name === 'admin';

      const { data: product } = await supabase
        .from('products')
        .select('id, seller_id')
        .eq('id', id)
        .maybeSingle();

      if (!product) {
        return ApiResponse.error(res, 'Product not found', 404);
      }

      if (!isAdmin && product.seller_id !== userId) {
        return ApiResponse.error(res, 'Unauthorized', 403);
      }

      const { error } = await supabase
        .from('products')
        .update({ status: 'archived', updated_at: new Date() })
        .eq('id', id);

      if (error) throw error;

      ApiResponse.success(res, null, 'Product archived successfully');
    } catch (error) {
      logger.error('Archive product error:', error);
      next(error);
    }
  }

  async feature(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { id } = req.params;
      const { featured } = req.body;

      const { error } = await supabase
        .from('products')
        .update({ is_featured: featured !== false, updated_at: new Date() })
        .eq('id', id);

      if (error) throw error;

      ApiResponse.success(res, null, featured === false ? 'Product unfeatured' : 'Product featured');
    } catch (error) {
      logger.error('Feature product error:', error);
      next(error);
    }
  }

  async makeTrending(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { id } = req.params;
      const { trending } = req.body;

      const { error } = await supabase
        .from('products')
        .update({ is_trending: trending !== false, updated_at: new Date() })
        .eq('id', id);

      if (error) throw error;

      ApiResponse.success(res, null, trending === false ? 'Removed from trending' : 'Marked as trending');
    } catch (error) {
      logger.error('Trending product error:', error);
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { id } = req.params;

      await supabase
        .from('products')
        .update({ view_count: supabase.rpc('increment_view_count', { product_id: id }) })
        .eq('id', id);

      const { data: product, error } = await supabase
        .from('products')
        .update({ view_count: (await supabase.from('products').select('view_count').eq('id', id).single()).data?.view_count + 1 })
        .eq('id', id)
        .select(`
          *,
          category:categories(*),
          framework:frameworks(*),
          product_type:product_types(*),
          seller:users!products_seller_id_fkey(id, email, username, store_name, avatar_url, seller_status),
          tags:product_tags(tag:tags(*))
        `)
        .is('deleted_at', null)
        .maybeSingle();

      if (!product) {
        return ApiResponse.error(res, 'Product not found', 404);
      }

      ApiResponse.success(res, product, 'Product retrieved successfully');
    } catch (error) {
      logger.error('Get product error:', error);
      next(error);
    }
  }

  async getBySlug(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { slug } = req.params;

      const { data: product } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(*),
          framework:frameworks(*),
          product_type:product_types(*),
          seller:users!products_seller_id_fkey(id, email, username, store_name, avatar_url),
          tags:product_tags(tag:tags(*)),
          reviews:reviews(id, rating, title, content, status, created_at, user:users(id, username, avatar_url))
        `)
        .eq('slug', slug)
        .eq('status', 'published')
        .is('deleted_at', null)
        .maybeSingle();

      if (!product) {
        return ApiResponse.error(res, 'Product not found', 404);
      }

      await supabase
        .from('products')
        .update({ view_count: product.view_count + 1 })
        .eq('id', product.id);

      product.view_count += 1;

      ApiResponse.success(res, product, 'Product retrieved successfully');
    } catch (error) {
      logger.error('Get product by slug error:', error);
      next(error);
    }
  }

  async list(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const {
        page = 1,
        limit = 12,
        sortBy = 'created_at',
        sortOrder = 'desc',
        search,
        category,
        framework,
        productType,
        minPrice,
        maxPrice,
        isFree,
        isFeatured,
        isTrending,
        sellerId,
        status
      } = req.query;

      const { offset } = PaginationHelper.getPagination(page, limit);

      let query = supabase
        .from('products')
        .select(`
          *,
          category:categories(id, name, slug),
          framework:frameworks(id, name, slug),
          product_type:product_types(id, name, slug),
          seller:users!products_seller_id_fkey(id, username, store_name, avatar_url)
        `, { count: 'exact' })
        .is('deleted_at', null)
        .eq('status', status || 'published');

      if (search) {
        query = query.or(`name.ilike.%${search}%,short_description.ilike.%${search}%`);
      }

      if (category) {
        query = query.eq('category_id', category);
      }

      if (framework) {
        query = query.eq('framework_id', framework);
      }

      if (productType) {
        query = query.eq('product_type_id', productType);
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

      if (isFeatured !== undefined) {
        query = query.eq('is_featured', isFeatured === 'true');
      }

      if (isTrending !== undefined) {
        query = query.eq('is_trending', isTrending === 'true');
      }

      if (sellerId) {
        query = query.eq('seller_id', sellerId);
      }

      query = query.order(sortBy, { ascending: sortOrder === 'asc' });
      query = query.range(offset, offset + parseInt(limit) - 1);

      const { data: products, count, error } = await query;

      if (error) throw error;

      ApiResponse.paginated(res, products, page, limit, count, 'Products retrieved successfully');
    } catch (error) {
      logger.error('List products error:', error);
      next(error);
    }
  }

  async getFeatured(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { limit = 8 } = req.query;

      const { data: products, error } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(id, name, slug),
          framework:frameworks(id, name, slug),
          seller:users!products_seller_id_fkey(id, username, store_name, avatar_url)
        `)
        .eq('is_featured', true)
        .eq('status', 'published')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(parseInt(limit));

      if (error) throw error;

      ApiResponse.success(res, products, 'Featured products retrieved successfully');
    } catch (error) {
      logger.error('Get featured products error:', error);
      next(error);
    }
  }

  async getTrending(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { limit = 8 } = req.query;

      const { data: products, error } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(id, name, slug),
          framework:frameworks(id, name, slug),
          seller:users!products_seller_id_fkey(id, username, store_name, avatar_url)
        `)
        .eq('is_trending', true)
        .eq('status', 'published')
        .is('deleted_at', null)
        .order('download_count', { ascending: false })
        .limit(parseInt(limit));

      if (error) throw error;

      ApiResponse.success(res, products, 'Trending products retrieved successfully');
    } catch (error) {
      logger.error('Get trending products error:', error);
      next(error);
    }
  }

  async getLatest(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { limit = 8 } = req.query;

      const { data: products, error } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(id, name, slug),
          framework:frameworks(id, name, slug),
          seller:users!products_seller_id_fkey(id, username, store_name, avatar_url)
        `)
        .eq('status', 'published')
        .is('deleted_at', null)
        .order('published_at', { ascending: false })
        .limit(parseInt(limit));

      if (error) throw error;

      ApiResponse.success(res, products, 'Latest products retrieved successfully');
    } catch (error) {
      logger.error('Get latest products error:', error);
      next(error);
    }
  }

  async getPopular(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { limit = 8 } = req.query;

      const { data: products, error } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(id, name, slug),
          framework:frameworks(id, name, slug),
          seller:users!products_seller_id_fkey(id, username, store_name, avatar_url)
        `)
        .eq('status', 'published')
        .is('deleted_at', null)
        .order('purchase_count', { ascending: false })
        .limit(parseInt(limit));

      if (error) throw error;

      ApiResponse.success(res, products, 'Popular products retrieved successfully');
    } catch (error) {
      logger.error('Get popular products error:', error);
      next(error);
    }
  }

  async getRelated(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { id } = req.params;
      const { limit = 4 } = req.query;

      const { data: product } = await supabase
        .from('products')
        .select('id, category_id, framework_id')
        .eq('id', id)
        .maybeSingle();

      if (!product) {
        return ApiResponse.error(res, 'Product not found', 404);
      }

      const { data: related, error } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(id, name, slug),
          framework:frameworks(id, name, slug),
          seller:users!products_seller_id_fkey(id, username, store_name, avatar_url)
        `)
        .eq('status', 'published')
        .is('deleted_at', null)
        .neq('id', id)
        .or(`category_id.eq.${product.category_id},framework_id.eq.${product.framework_id}`)
        .limit(parseInt(limit));

      if (error) throw error;

      ApiResponse.success(res, related, 'Related products retrieved successfully');
    } catch (error) {
      logger.error('Get related products error:', error);
      next(error);
    }
  }

  async getBySeller(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { sellerId } = req.params;
      const { page = 1, limit = 12, status } = req.query;
      const { offset } = PaginationHelper.getPagination(page, limit);

      let query = supabase
        .from('products')
        .select(`
          *,
          category:categories(id, name, slug),
          framework:frameworks(id, name, slug)
        `, { count: 'exact' })
        .eq('seller_id', sellerId)
        .is('deleted_at', null);

      if (status) {
        query = query.eq('status', status);
      } else {
        query = query.eq('status', 'published');
      }

      query = query.order('created_at', { ascending: false });
      query = query.range(offset, offset + parseInt(limit) - 1);

      const { data: products, count, error } = await query;

      if (error) throw error;

      ApiResponse.paginated(res, products, page, limit, count, 'Seller products retrieved successfully');
    } catch (error) {
      logger.error('Get seller products error:', error);
      next(error);
    }
  }

  async getMyProducts(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const userId = req.user.id;
      const { page = 1, limit = 12, status, search } = req.query;
      const { offset } = PaginationHelper.getPagination(page, limit);

      let query = supabase
        .from('products')
        .select(`
          *,
          category:categories(id, name, slug),
          framework:frameworks(id, name, slug)
        `, { count: 'exact' })
        .eq('seller_id', userId);

      if (status) {
        query = query.eq('status', status);
      }

      if (search) {
        query = query.ilike('name', `%${search}%`);
      }

      query = query.order('created_at', { ascending: false });
      query = query.range(offset, offset + parseInt(limit) - 1);

      const { data: products, count, error } = await query;

      if (error) throw error;

      ApiResponse.paginated(res, products, page, limit, count, 'My products retrieved successfully');
    } catch (error) {
      logger.error('Get my products error:', error);
      next(error);
    }
  }
}

module.exports = new ProductController();
