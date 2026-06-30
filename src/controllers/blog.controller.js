const { getSupabaseAdmin } = require('../config/database');
const ApiResponse = require('../utils/response');
const PaginationHelper = require('../helpers/pagination');
const { slugify, generateUniqueSlug } = require('../helpers/slug');
const logger = require('../utils/logger');

class BlogController {
  async create(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const authorId = req.user.id;
      const {
        title,
        excerpt,
        content,
        categoryId,
        featuredImageUrl,
        status,
        isFeatured,
        seoTitle,
        seoDescription,
        seoKeywords,
        tags
      } = req.body;

      const baseSlug = slugify(title);
      const slug = await generateUniqueSlug(baseSlug, supabase.from('blog_posts'));

      const { data: post, error } = await supabase
        .from('blog_posts')
        .insert({
          author_id: authorId,
          title,
          slug,
          excerpt,
          content,
          category_id: categoryId,
          featured_image_url: featuredImageUrl,
          status: status || 'draft',
          is_featured: isFeatured || false,
          seo_title: seoTitle,
          seo_description: seoDescription,
          seo_keywords: seoKeywords,
          published_at: status === 'published' ? new Date() : null
        })
        .select(`
          *,
          author:users(id, username, avatar_url),
          category:blog_categories(*)
        `)
        .single();

      if (error) throw error;

      if (tags && tags.length > 0) {
        for (const tagId of tags) {
          await supabase
            .from('blog_post_tags')
            .insert({ post_id: post.id, tag_id: tagId });
        }
      }

      ApiResponse.success(res, post, 'Blog post created successfully', 201);
    } catch (error) {
      logger.error('Create blog post error:', error);
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
        title: 'title',
        excerpt: 'excerpt',
        content: 'content',
        categoryId: 'category_id',
        featuredImageUrl: 'featured_image_url',
        status: 'status',
        isFeatured: 'is_featured',
        seoTitle: 'seo_title',
        seoDescription: 'seo_description',
        seoKeywords: 'seo_keywords'
      };

      for (const [key, dbField] of Object.entries(fieldMapping)) {
        if (body[key] !== undefined) {
          updateFields[dbField] = body[key];
        }
      }

      if (body.status === 'published') {
        const { data: existing } = await supabase
          .from('blog_posts')
          .select('published_at')
          .eq('id', id)
          .maybeSingle();

        if (!existing?.published_at) {
          updateFields.published_at = new Date();
        }
      }

      const { data: post, error } = await supabase
        .from('blog_posts')
        .update(updateFields)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (!post) {
        return ApiResponse.error(res, 'Blog post not found', 404);
      }

      ApiResponse.success(res, post, 'Blog post updated successfully');
    } catch (error) {
      logger.error('Update blog post error:', error);
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { id } = req.params;

      const { error } = await supabase
        .from('blog_posts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      ApiResponse.success(res, null, 'Blog post deleted successfully');
    } catch (error) {
      logger.error('Delete blog post error:', error);
      next(error);
    }
  }

  async getBySlug(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { slug } = req.params;

      const { data: post, error } = await supabase
        .from('blog_posts')
        .select(`
          *,
          author:users(id, username, avatar_url),
          category:blog_categories(*),
          tags:blog_post_tags(tag:tags(*))
        `)
        .eq('slug', slug)
        .eq('status', 'published')
        .maybeSingle();

      if (!post) {
        return ApiResponse.error(res, 'Blog post not found', 404);
      }

      await supabase
        .from('blog_posts')
        .update({ view_count: post.view_count + 1 })
        .eq('id', post.id);

      ApiResponse.success(res, post, 'Blog post retrieved successfully');
    } catch (error) {
      logger.error('Get blog post error:', error);
      next(error);
    }
  }

  async list(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { page = 1, limit = 10, search, category, featured } = req.query;
      const { offset } = PaginationHelper.getPagination(page, limit);

      let query = supabase
        .from('blog_posts')
        .select(`
          *,
          author:users(id, username, avatar_url),
          category:blog_categories(*)
        `, { count: 'exact' })
        .eq('status', 'published');

      if (search) {
        query = query.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%`);
      }

      if (category) {
        query = query.eq('category_id', category);
      }

      if (featured === 'true') {
        query = query.eq('is_featured', true);
      }

      query = query.order('published_at', { ascending: false });
      query = query.range(offset, offset + parseInt(limit) - 1);

      const { data: posts, count, error } = await query;

      if (error) throw error;

      ApiResponse.paginated(res, posts, page, limit, count, 'Blog posts retrieved successfully');
    } catch (error) {
      logger.error('List blog posts error:', error);
      next(error);
    }
  }

  async getAllCategories(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();

      const { data: categories, error } = await supabase
        .from('blog_categories')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;

      ApiResponse.success(res, categories, 'Blog categories retrieved successfully');
    } catch (error) {
      logger.error('Get blog categories error:', error);
      next(error);
    }
  }

  async createCategory(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { name, description } = req.body;

      const baseSlug = slugify(name);
      const slug = await generateUniqueSlug(baseSlug, supabase.from('blog_categories'));

      const { data: category, error } = await supabase
        .from('blog_categories')
        .insert({ name, slug, description })
        .select()
        .single();

      if (error) throw error;

      ApiResponse.success(res, category, 'Blog category created successfully', 201);
    } catch (error) {
      logger.error('Create blog category error:', error);
      next(error);
    }
  }
}

module.exports = new BlogController();
