const { getSupabaseAdmin } = require('../config/database');
const ApiResponse = require('../utils/response');
const logger = require('../utils/logger');

class DashboardController {
  async getAdminStats(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();

      const [productsResult, usersResult, ordersResult, reviewsResult] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('users').select('id', { count: 'exact', head: true }),
        supabase.from('orders').select('total'),
        supabase.from('reviews').select('id', { count: 'exact', head: true })
      ]);

      const totalRevenue = ordersResult.data?.reduce((sum, o) => sum + (o.total || 0), 0) || 0;

      const recentOrders = await supabase
        .from('orders')
        .select(`
          id, order_number, total, status, created_at,
          customer:users!orders_customer_id_fkey(id, username, email)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      const topProducts = await supabase
        .from('products')
        .select('id, name, purchase_count, average_rating, thumbnail_url')
        .order('purchase_count', { ascending: false })
        .limit(5);

      ApiResponse.success(res, {
        totalProducts: productsResult.count || 0,
        totalUsers: usersResult.count || 0,
        totalReviews: reviewsResult.count || 0,
        totalRevenue,
        recentOrders: recentOrders.data || [],
        topProducts: topProducts.data || []
      }, 'Admin dashboard stats retrieved successfully');
    } catch (error) {
      logger.error('Get admin stats error:', error);
      next(error);
    }
  }

  async getSellerStats(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const userId = req.user.id;

      const [productsResult, ordersResult, reviewsResult] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact' }).eq('seller_id', userId),
        supabase.from('order_items').select('total, product_id').eq('seller_id', userId),
        supabase.from('reviews').select('rating').eq('product.seller_id', userId)
      ]);

      const totalEarnings = ordersResult.data?.reduce((sum, o) => sum + (o.total || 0), 0) || 0;
      const avgRating = reviewsResult.data?.length > 0
        ? reviewsResult.data.reduce((sum, r) => sum + r.rating, 0) / reviewsResult.data.length
        : 0;

      const recentSales = await supabase
        .from('order_items')
        .select(`
          id, price, total, created_at,
          product:products(id, name, thumbnail_url),
          order:orders(id, order_number, created_at)
        `)
        .eq('seller_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      const topProducts = await supabase
        .from('products')
        .select('id, name, purchase_count, view_count, average_rating, thumbnail_url')
        .eq('seller_id', userId)
        .order('purchase_count', { ascending: false })
        .limit(5);

      ApiResponse.success(res, {
        totalProducts: productsResult.count || 0,
        totalSales: ordersResult.data?.length || 0,
        totalEarnings,
        averageRating: Math.round(avgRating * 100) / 100,
        recentSales: recentSales.data || [],
        topProducts: topProducts.data || []
      }, 'Seller dashboard stats retrieved successfully');
    } catch (error) {
      logger.error('Get seller stats error:', error);
      next(error);
    }
  }

  async getRevenueChart(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { period = 'month', sellerId } = req.query;

      const now = new Date();
      let startDate;

      switch (period) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          break;
        case 'year':
          startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      let ordersQuery = supabase
        .from('orders')
        .select('total, created_at, status')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (sellerId) {
        const { data: sellerOrders } = await supabase
          .from('order_items')
          .select('order_id')
          .eq('seller_id', sellerId);

        const orderIds = sellerOrders?.map(o => o.order_id) || [];
        ordersQuery = ordersQuery.in('id', orderIds);
      }

      const { data: orders, error } = await ordersQuery;

      if (error) throw error;

      const groupedData = {};
      orders?.forEach(order => {
        const date = new Date(order.created_at).toISOString().split('T')[0];
        if (!groupedData[date]) {
          groupedData[date] = { date, revenue: 0, orders: 0 };
        }
        groupedData[date].revenue += order.total || 0;
        groupedData[date].orders += 1;
      });

      const chartData = Object.values(groupedData);

      ApiResponse.success(res, chartData, 'Revenue chart data retrieved successfully');
    } catch (error) {
      logger.error('Get revenue chart error:', error);
      next(error);
    }
  }

  async getCategoryStats(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();

      const { data: categories } = await supabase
        .from('categories')
        .select(`
          id, name, slug,
          products:products(count)
        `);

      ApiResponse.success(res, categories || [], 'Category stats retrieved successfully');
    } catch (error) {
      logger.error('Get category stats error:', error);
      next(error);
    }
  }

  async getFrameworkStats(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();

      const { data: frameworks } = await supabase
        .from('frameworks')
        .select(`
          id, name, slug,
          products:products(count)
        `);

      ApiResponse.success(res, frameworks || [], 'Framework stats retrieved successfully');
    } catch (error) {
      logger.error('Get framework stats error:', error);
      next(error);
    }
  }
}

module.exports = new DashboardController();
