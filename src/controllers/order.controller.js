const { getSupabaseAdmin } = require('../config/database');
const ApiResponse = require('../utils/response');
const PaginationHelper = require('../helpers/pagination');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const emailService = require('../services/email.service');

class OrderController {
  async create(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const userId = req.user.id;
      const { items, couponCode, billingAddress } = req.body;

      if (!items || items.length === 0) {
        return ApiResponse.error(res, 'Order must contain at least one item', 400);
      }

      const productIds = items.map(item => item.productId);
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*, seller:users!products_seller_id_fkey(id, email, username)')
        .in('id', productIds)
        .eq('status', 'published');

      if (productsError) throw productsError;

      if (products.length !== productIds.length) {
        return ApiResponse.error(res, 'One or more products are not available', 400);
      }

      const existingOrders = await supabase
        .from('order_items')
        .select('product_id')
        .in('product_id', productIds);

      const purchasedProductIds = existingOrders.data?.map(o => o.product_id) || [];
      const alreadyPurchased = productIds.filter(id => purchasedProductIds.includes(id));

      if (alreadyPurchased.length > 0) {
        return ApiResponse.error(res, 'You have already purchased one or more of these products', 400);
      }

      let subtotal = 0;
      let discount = 0;
      const orderItems = [];

      for (const item of items) {
        const product = products.find(p => p.id === item.productId);
        const price = product.is_free ? 0 : product.price;
        const itemTotal = price * (item.quantity || 1);
        subtotal += itemTotal;

        orderItems.push({
          productId: product.id,
          sellerId: product.seller_id,
          price,
          quantity: item.quantity || 1,
          total: itemTotal,
          productName: product.name
        });
      }

      let coupon = null;
      if (couponCode) {
        const { data: couponData } = await supabase
          .from('coupons')
          .select('*')
          .eq('code', couponCode)
          .eq('is_active', true)
          .maybeSingle();

        if (couponData && new Date(couponData.valid_from) <= new Date() && new Date(couponData.valid_until) >= new Date()) {
          if (couponData.usage_limit === null || couponData.usage_count < couponData.usage_limit) {
            coupon = couponData;

            if (coupon.type === 'percentage') {
              discount = subtotal * (coupon.value / 100);
              if (coupon.max_discount) {
                discount = Math.min(discount, coupon.max_discount);
              }
            } else {
              discount = Math.min(coupon.value, subtotal);
            }

            if (coupon.min_order_amount && subtotal < coupon.min_order_amount) {
              discount = 0;
              coupon = null;
            }
          }
        }
      }

      const total = Math.max(0, subtotal - discount);

      const orderNumber = `ORD-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`;

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: userId,
          order_number: orderNumber,
          subtotal,
          discount,
          total,
          status: total === 0 ? 'completed' : 'pending',
          payment_status: total === 0 ? 'completed' : 'pending',
          coupon_id: coupon?.id,
          billing_address: billingAddress
        })
        .select()
        .single();

      if (orderError) throw orderError;

      for (const item of orderItems) {
        await supabase
          .from('order_items')
          .insert({
            order_id: order.id,
            product_id: item.productId,
            seller_id: item.sellerId,
            price: item.price,
            quantity: item.quantity,
            total: item.total
          });

        const seller = products.find(p => p.id === item.productId)?.seller;
        if (seller) {
          await supabase
            .from('users')
            .update({
              total_sales: (await supabase.from('users').select('total_sales').eq('id', seller.id).single()).data?.total_sales + 1,
              total_earnings: (await supabase.from('users').select('total_earnings').eq('id', seller.id).single()).data?.total_earnings + item.total
            })
            .eq('id', seller.id);

          await supabase
            .from('products')
            .update({
              purchase_count: (await supabase.from('products').select('purchase_count').eq('id', item.productId).single()).data?.purchase_count + 1
            })
            .eq('id', item.productId);
        }

        const licenseKey = uuidv4();
        await supabase
          .from('licenses')
          .insert({
            key: licenseKey,
            product_id: item.productId,
            order_id: order.id,
            customer_id: userId,
            max_activations: 1
          });
      }

      if (coupon) {
        await supabase
          .from('coupons')
          .update({ usage_count: coupon.usage_count + 1 })
          .eq('id', coupon.id);
      }

      const { data: customer } = await supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .maybeSingle();

      if (customer) {
        await emailService.sendOrderConfirmationEmail(customer.email, order, orderItems);
      }

      ApiResponse.success(res, order, 'Order created successfully', 201);
    } catch (error) {
      logger.error('Create order error:', error);
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { id } = req.params;
      const userId = req.user.id;
      const isAdmin = req.user.role?.name === 'admin';

      const { data: order, error } = await supabase
        .from('orders')
        .select(`
          *,
          items:order_items(
            *,
            product:products(*)
          ),
          customer:users!orders_customer_id_fkey(id, email, username)
        `)
        .eq('id', id)
        .maybeSingle();

      if (!order) {
        return ApiResponse.error(res, 'Order not found', 404);
      }

      if (!isAdmin && order.customer_id !== userId) {
        const isSeller = order.items?.some(item => item.seller_id === userId);
        if (!isSeller) {
          return ApiResponse.error(res, 'Unauthorized', 403);
        }
      }

      ApiResponse.success(res, order, 'Order retrieved successfully');
    } catch (error) {
      logger.error('Get order error:', error);
      next(error);
    }
  }

  async getMyOrders(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const userId = req.user.id;
      const { page = 1, limit = 10, status } = req.query;
      const { offset } = PaginationHelper.getPagination(page, limit);

      let query = supabase
        .from('orders')
        .select(`
          *,
          items:order_items(
            id,
            price,
            total,
            product:products(id, name, slug, thumbnail_url)
          )
        `, { count: 'exact' })
        .eq('customer_id', userId);

      if (status) {
        query = query.eq('status', status);
      }

      query = query.order('created_at', { ascending: false });
      query = query.range(offset, offset + parseInt(limit) - 1);

      const { data: orders, count, error } = await query;

      if (error) throw error;

      ApiResponse.paginated(res, orders, page, limit, count, 'Orders retrieved successfully');
    } catch (error) {
      logger.error('Get my orders error:', error);
      next(error);
    }
  }

  async getSellerOrders(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const userId = req.user.id;
      const { page = 1, limit = 10, status } = req.query;
      const { offset } = PaginationHelper.getPagination(page, limit);

      let query = supabase
        .from('order_items')
        .select(`
          *,
          order:orders(
            *,
            customer:users!orders_customer_id_fkey(id, username, email)
          ),
          product:products(id, name, thumbnail_url)
        `, { count: 'exact' })
        .eq('seller_id', userId);

      if (status) {
        query = query.eq('order.status', status);
      }

      query = query.order('created_at', { ascending: false });
      query = query.range(offset, offset + parseInt(limit) - 1);

      const { data: items, count, error } = await query;

      if (error) throw error;

      ApiResponse.paginated(res, items, page, limit, count, 'Seller orders retrieved successfully');
    } catch (error) {
      logger.error('Get seller orders error:', error);
      next(error);
    }
  }

  async updateStatus(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { id } = req.params;
      const { status } = req.body;

      const { data: order, error } = await supabase
        .from('orders')
        .update({
          status,
          updated_at: new Date(),
          completed_at: status === 'completed' ? new Date() : null
        })
        .eq('id', id)
        .select()
        .maybeSingle();

      if (!order) {
        return ApiResponse.error(res, 'Order not found', 404);
      }

      ApiResponse.success(res, order, 'Order status updated');
    } catch (error) {
      logger.error('Update order status error:', error);
      next(error);
    }
  }

  async refund(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { id } = req.params;

      const { data: order } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!order) {
        return ApiResponse.error(res, 'Order not found', 404);
      }

      if (order.status !== 'completed') {
        return ApiResponse.error(res, 'Only completed orders can be refunded', 400);
      }

      const { error } = await supabase
        .from('orders')
        .update({
          status: 'refunded',
          payment_status: 'refunded',
          refunded_at: new Date()
        })
        .eq('id', id);

      if (error) throw error;

      await supabase
        .from('licenses')
        .update({ status: 'revoked' })
        .eq('order_id', id);

      ApiResponse.success(res, null, 'Order refunded successfully');
    } catch (error) {
      logger.error('Refund order error:', error);
      next(error);
    }
  }

  async getAll(req, res, next) {
    try {
      const supabase = getSupabaseAdmin();
      const { page = 1, limit = 20, status, paymentStatus, search } = req.query;
      const { offset } = PaginationHelper.getPagination(page, limit);

      let query = supabase
        .from('orders')
        .select(`
          *,
          customer:users!orders_customer_id_fkey(id, email, username),
          items:order_items(id, product_id)
        `, { count: 'exact' });

      if (status) {
        query = query.eq('status', status);
      }

      if (paymentStatus) {
        query = query.eq('payment_status', paymentStatus);
      }

      if (search) {
        query = query.ilike('order_number', `%${search}%`);
      }

      query = query.order('created_at', { ascending: false });
      query = query.range(offset, offset + parseInt(limit) - 1);

      const { data: orders, count, error } = await query;

      if (error) throw error;

      ApiResponse.paginated(res, orders, page, limit, count, 'Orders retrieved successfully');
    } catch (error) {
      logger.error('Get all orders error:', error);
      next(error);
    }
  }
}

module.exports = new OrderController();
