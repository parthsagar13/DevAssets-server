const { getSupabaseAdmin } = require('../config/database');
const ApiResponse = require('../utils/response');
const PaginationHelper = require('../helpers/pagination');
const logger = require('../utils/logger');

class DownloadController {
  async getDownloadUrl(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { productId } = req.params;
      const userId = req.user.id;

      const { data: orderItem } = await supabase
        .from('order_items')
        .select(`
          *,
          order:orders(status, payment_status)
        `)
        .eq('product_id', productId)
        .eq('order.customer_id', userId)
        .maybeSingle();

      if (!orderItem || orderItem.order?.status !== 'completed') {
        return ApiResponse.error(res, 'You do not have access to download this product', 403);
      }

      const { data: product } = await supabase
        .from('products')
        .select('id, name, file_path, file_size, version')
        .eq('id', productId)
        .maybeSingle();

      if (!product) {
        return ApiResponse.error(res, 'Product not found', 404);
      }

      await supabase
        .from('downloads')
        .insert({
          user_id: userId,
          product_id: productId,
          order_id: orderItem.order_id,
          ip_address: req.ip,
          user_agent: req.headers['user-agent']
        });

      await supabase
        .from('products')
        .update({
          download_count: (await supabase.from('products').select('download_count').eq('id', productId).single()).data?.download_count + 1
        })
        .eq('id', productId);

      ApiResponse.success(res, {
        productId: product.id,
        name: product.name,
        version: product.version,
        fileSize: product.file_size,
        filePath: product.file_path
      }, 'Download URL generated successfully');
    } catch (error) {
      logger.error('Get download URL error:', error);
      next(error);
    }
  }

  async getMyDownloads(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const userId = req.user.id;
      const { page = 1, limit = 20 } = req.query;
      const { offset } = PaginationHelper.getPagination(page, limit);

      const { data: downloads, count, error } = await supabase
        .from('downloads')
        .select(`
          *,
          product:products(id, name, slug, thumbnail_url, version)
        `, { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + parseInt(limit) - 1);

      if (error) throw error;

      ApiResponse.paginated(res, downloads, page, limit, count, 'Downloads retrieved successfully');
    } catch (error) {
      logger.error('Get my downloads error:', error);
      next(error);
    }
  }

  async getMyPurchasedProducts(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const userId = req.user.id;
      const { page = 1, limit = 20 } = req.query;
      const { offset } = PaginationHelper.getPagination(page, limit);

      const { data: items, count, error } = await supabase
        .from('order_items')
        .select(`
          *,
          product:products(
            id,
            name,
            slug,
            thumbnail_url,
            version,
            seller:users!products_seller_id_fkey(id, username, store_name)
          ),
          license:licenses(key, status, expires_at)
        `, { count: 'exact' })
        .eq('order.customer_id', userId)
        .eq('order.status', 'completed')
        .order('created_at', { ascending: false })
        .range(offset, offset + parseInt(limit) - 1);

      if (error) throw error;

      ApiResponse.paginated(res, items, page, limit, count, 'Purchased products retrieved successfully');
    } catch (error) {
      logger.error('Get purchased products error:', error);
      next(error);
    }
  }

  async verifyLicense(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { licenseKey, productId } = req.body;

      if (!licenseKey || !productId) {
        return ApiResponse.error(res, 'License key and product ID are required', 400);
      }

      const { data: license, error } = await supabase
        .from('licenses')
        .select('*, product:products(id, name)')
        .eq('key', licenseKey)
        .eq('product_id', productId)
        .maybeSingle();

      if (!license) {
        return ApiResponse.error(res, 'Invalid license key', 404);
      }

      if (license.status !== 'active') {
        return ApiResponse.error(res, `License is ${license.status}`, 400);
      }

      if (license.expires_at && new Date(license.expires_at) < new Date()) {
        await supabase
          .from('licenses')
          .update({ status: 'expired' })
          .eq('id', license.id);

        return ApiResponse.error(res, 'License has expired', 400);
      }

      if (license.activations >= license.max_activations) {
        return ApiResponse.error(res, 'License activation limit reached', 400);
      }

      ApiResponse.success(res, {
        valid: true,
        productId: license.product_id,
        productName: license.product?.name,
        activations: license.activations,
        maxActivations: license.max_activations,
        expiresAt: license.expires_at
      }, 'License is valid');
    } catch (error) {
      logger.error('Verify license error:', error);
      next(error);
    }
  }

  async activateLicense(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { licenseKey, productId } = req.body;

      const { data: license } = await supabase
        .from('licenses')
        .select('*')
        .eq('key', licenseKey)
        .eq('product_id', productId)
        .maybeSingle();

      if (!license) {
        return ApiResponse.error(res, 'Invalid license key', 404);
      }

      if (license.status !== 'active' || license.activations >= license.max_activations) {
        return ApiResponse.error(res, 'Cannot activate license', 400);
      }

      const { error } = await supabase
        .from('licenses')
        .update({ activations: license.activations + 1 })
        .eq('id', license.id);

      if (error) throw error;

      ApiResponse.success(res, {
        activated: true,
        activations: license.activations + 1,
        remaining: license.max_activations - license.activations - 1
      }, 'License activated successfully');
    } catch (error) {
      logger.error('Activate license error:', error);
      next(error);
    }
  }
}

module.exports = new DownloadController();
