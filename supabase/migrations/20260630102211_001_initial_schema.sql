/*
# Initial Schema for CodeMarket API

1. New Tables
- `roles` - User roles (admin, seller, customer)
- `permissions` - Granular permissions for RBAC
- `role_permissions` - Junction table for role-permission mapping
- `users` - User profiles extending auth.users
- `categories` - Product categories with nested support
- `frameworks` - Development frameworks (React, Vue, etc.)
- `product_types` - Types (template, component, plugin, etc.)
- `tags` - Product tags for organization
- `products` - Main product catalog
- `product_media` - Product images/files
- `orders` - Customer orders
- `order_items` - Individual items in orders
- `licenses` - Product licenses
- `downloads` - Download tracking
- `reviews` - Product reviews
- `coupons` - Discount coupons
- `wishlists` - User wishlists
- `media` - Media library
- `blog_posts` - Blog articles
- `blog_categories` - Blog categories
- `notifications` - User notifications
- `activity_logs` - User activity tracking
- `settings` - System settings

2. Security
- Enable RLS on all tables
- Owner-scoped policies for user-owned data
- Public read for published products/categories

3. Notes
- Uses auth.uid() for ownership checks
- Cascading deletes for referenced data
- Indexes for performance optimization
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(50) UNIQUE NOT NULL,
  description text,
  is_system boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) UNIQUE NOT NULL,
  resource varchar(50) NOT NULL,
  action varchar(50) NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Role-Permission junction table
CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(role_id, permission_id)
);

-- Users table (extends auth.users)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email varchar(255) UNIQUE NOT NULL,
  username varchar(100) UNIQUE,
  first_name varchar(100),
  last_name varchar(100),
  avatar_url text,
  bio text,
  role_id uuid REFERENCES roles(id),
  is_email_verified boolean DEFAULT false,
  is_active boolean DEFAULT true,
  seller_status varchar(50) DEFAULT 'pending',
  store_name varchar(200),
  store_description text,
  stripe_account_id varchar(200),
  total_sales integer DEFAULT 0,
  total_earnings decimal(12,2) DEFAULT 0,
  balance decimal(12,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_login_at timestamptz
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(200) NOT NULL,
  slug varchar(250) UNIQUE NOT NULL,
  description text,
  parent_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  image_url text,
  icon varchar(100),
  sort_order integer DEFAULT 0,
  is_visible boolean DEFAULT true,
  meta_title varchar(200),
  meta_description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Frameworks table
CREATE TABLE IF NOT EXISTS frameworks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL,
  slug varchar(150) UNIQUE NOT NULL,
  description text,
  logo_url text,
  website_url text,
  color varchar(20),
  is_popular boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Product Types table
CREATE TABLE IF NOT EXISTS product_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL,
  slug varchar(150) UNIQUE NOT NULL,
  description text,
  icon varchar(100),
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL,
  slug varchar(150) UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name varchar(300) NOT NULL,
  slug varchar(350) UNIQUE NOT NULL,
  short_description text,
  description text,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  framework_id uuid REFERENCES frameworks(id) ON DELETE SET NULL,
  product_type_id uuid REFERENCES product_types(id) ON DELETE SET NULL,
  price decimal(10,2) NOT NULL,
  compare_at_price decimal(10,2),
  currency varchar(10) DEFAULT 'USD',
  file_path text NOT NULL,
  file_size bigint,
  demo_url text,
  documentation_url text,
  version varchar(50) DEFAULT '1.0.0',
  changelog text,
  thumbnail_url text,
  preview_urls text[],
  status varchar(50) DEFAULT 'draft',
  is_featured boolean DEFAULT false,
  is_trending boolean DEFAULT false,
  is_free boolean DEFAULT false,
  requires_license boolean DEFAULT true,
  download_count integer DEFAULT 0,
  view_count integer DEFAULT 0,
  purchase_count integer DEFAULT 0,
  review_count integer DEFAULT 0,
  average_rating decimal(3,2) DEFAULT 0,
  seo_title varchar(200),
  seo_description text,
  seo_keywords text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  published_at timestamptz,
  deleted_at timestamptz
);

-- Product Tags junction table
CREATE TABLE IF NOT EXISTS product_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(product_id, tag_id)
);

-- Media library table
CREATE TABLE IF NOT EXISTS media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  filename varchar(500) NOT NULL,
  original_name varchar(500),
  mime_type varchar(100),
  size bigint,
  url text NOT NULL,
  public_id text,
  resource_type varchar(50),
  folder varchar(200),
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Product Media junction table
CREATE TABLE IF NOT EXISTS product_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  media_id uuid NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  sort_order integer DEFAULT 0,
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_number varchar(50) UNIQUE NOT NULL,
  subtotal decimal(12,2) NOT NULL,
  discount decimal(12,2) DEFAULT 0,
  tax decimal(12,2) DEFAULT 0,
  total decimal(12,2) NOT NULL,
  currency varchar(10) DEFAULT 'USD',
  status varchar(50) DEFAULT 'pending',
  payment_status varchar(50) DEFAULT 'pending',
  payment_method varchar(50),
  payment_id varchar(200),
  coupon_id uuid,
  notes text,
  billing_address jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  refunded_at timestamptz
);

-- Order Items table
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  price decimal(10,2) NOT NULL,
  quantity integer DEFAULT 1,
  total decimal(10,2) NOT NULL,
  license_key uuid,
  created_at timestamptz DEFAULT now()
);

-- Licenses table
CREATE TABLE IF NOT EXISTS licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key varchar(100) UNIQUE NOT NULL,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  customer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status varchar(50) DEFAULT 'active',
  activations integer DEFAULT 0,
  max_activations integer DEFAULT 1,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Downloads table
CREATE TABLE IF NOT EXISTS downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  license_id uuid REFERENCES licenses(id) ON DELETE SET NULL,
  ip_address varchar(50),
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title varchar(200),
  content text,
  status varchar(50) DEFAULT 'pending',
  is_verified_purchase boolean DEFAULT false,
  helpful_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(product_id, user_id)
);

-- Coupons table
CREATE TABLE IF NOT EXISTS coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) UNIQUE NOT NULL,
  description text,
  type varchar(50) NOT NULL,
  value decimal(10,2) NOT NULL,
  min_order_amount decimal(10,2),
  max_discount decimal(10,2),
  usage_limit integer,
  usage_count integer DEFAULT 0,
  valid_from timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  is_active boolean DEFAULT true,
  applicable_products uuid[],
  applicable_categories uuid[],
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Wishlists table
CREATE TABLE IF NOT EXISTS wishlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- Blog Categories table
CREATE TABLE IF NOT EXISTS blog_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(200) NOT NULL,
  slug varchar(250) UNIQUE NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Blog Posts table
CREATE TABLE IF NOT EXISTS blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id uuid REFERENCES blog_categories(id) ON DELETE SET NULL,
  title varchar(300) NOT NULL,
  slug varchar(350) UNIQUE NOT NULL,
  excerpt text,
  content text,
  featured_image_url text,
  status varchar(50) DEFAULT 'draft',
  is_featured boolean DEFAULT false,
  view_count integer DEFAULT 0,
  seo_title varchar(200),
  seo_description text,
  seo_keywords text[],
  published_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Blog Post Tags junction table
CREATE TABLE IF NOT EXISTS blog_post_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(post_id, tag_id)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type varchar(100) NOT NULL,
  title varchar(200) NOT NULL,
  message text,
  data jsonb,
  is_read boolean DEFAULT false,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Activity Logs table
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action varchar(100) NOT NULL,
  resource_type varchar(100),
  resource_id uuid,
  details jsonb,
  ip_address varchar(50),
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key varchar(100) UNIQUE NOT NULL,
  value text,
  type varchar(50) DEFAULT 'string',
  group_name varchar(100),
  is_public boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Refresh Tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token varchar(500) NOT NULL,
  expires_at timestamptz NOT NULL,
  is_revoked boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Password Reset Tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token varchar(500) NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Email Verification Tokens table
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token varchar(500) NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_seller ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_framework ON products(framework_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_products_created ON products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

-- Enable RLS on all tables
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE frameworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_post_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for roles (public read, admin write)
DROP POLICY IF EXISTS "roles_select" ON roles;
CREATE POLICY "roles_select" ON roles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "roles_admin_all" ON roles;
CREATE POLICY "roles_admin_all" ON roles FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role_id = (SELECT id FROM roles WHERE name = 'admin')));

-- RLS Policies for users
DROP POLICY IF EXISTS "users_select_own" ON users;
CREATE POLICY "users_select_own" ON users FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "users_update_own" ON users;
CREATE POLICY "users_update_own" ON users FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "users_insert_own" ON users;
CREATE POLICY "users_insert_own" ON users FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Admin can read all users
DROP POLICY IF EXISTS "admin_users_all" ON users;
CREATE POLICY "admin_users_all" ON users FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role_id = (SELECT id FROM roles WHERE name = 'admin')));

-- RLS Policies for products
DROP POLICY IF EXISTS "products_public_read" ON products;
CREATE POLICY "products_public_read" ON products FOR SELECT TO authenticated
  USING (status = 'published' AND deleted_at IS NULL);

DROP POLICY IF EXISTS "products_seller_read" ON products;
CREATE POLICY "products_seller_read" ON products FOR SELECT TO authenticated
  USING (seller_id = auth.uid());

DROP POLICY IF EXISTS "products_seller_insert" ON products;
CREATE POLICY "products_seller_insert" ON products FOR INSERT TO authenticated
  WITH CHECK (seller_id = auth.uid());

DROP POLICY IF EXISTS "products_seller_update" ON products;
CREATE POLICY "products_seller_update" ON products FOR UPDATE TO authenticated
  USING (seller_id = auth.uid()) WITH CHECK (seller_id = auth.uid());

DROP POLICY IF EXISTS "products_seller_delete" ON products;
CREATE POLICY "products_seller_delete" ON products FOR DELETE TO authenticated
  USING (seller_id = auth.uid());

DROP POLICY IF EXISTS "products_admin_all" ON products;
CREATE POLICY "products_admin_all" ON products FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role_id = (SELECT id FROM roles WHERE name = 'admin')));

-- RLS Policies for categories (public read)
DROP POLICY IF EXISTS "categories_public_read" ON categories;
CREATE POLICY "categories_public_read" ON categories FOR SELECT TO authenticated USING (is_visible = true OR is_visible IS NULL);

DROP POLICY IF EXISTS "categories_admin_write" ON categories;
CREATE POLICY "categories_admin_write" ON categories FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role_id = (SELECT id FROM roles WHERE name = 'admin')));

-- RLS Policies for frameworks (public read)
DROP POLICY IF EXISTS "frameworks_public_read" ON frameworks;
CREATE POLICY "frameworks_public_read" ON frameworks FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "frameworks_admin_write" ON frameworks;
CREATE POLICY "frameworks_admin_write" ON frameworks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role_id = (SELECT id FROM roles WHERE name = 'admin')));

-- RLS Policies for product_types (public read)
DROP POLICY IF EXISTS "product_types_public_read" ON product_types;
CREATE POLICY "product_types_public_read" ON product_types FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "product_types_admin_write" ON product_types;
CREATE POLICY "product_types_admin_write" ON product_types FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role_id = (SELECT id FROM roles WHERE name = 'admin')));

-- RLS Policies for tags (public read)
DROP POLICY IF EXISTS "tags_public_read" ON tags;
CREATE POLICY "tags_public_read" ON tags FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "tags_admin_write" ON tags;
CREATE POLICY "tags_admin_write" ON tags FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role_id = (SELECT id FROM roles WHERE name = 'admin')));

-- RLS Policies for orders
DROP POLICY IF EXISTS "orders_customer_read" ON orders;
CREATE POLICY "orders_customer_read" ON orders FOR SELECT TO authenticated USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "orders_customer_insert" ON orders;
CREATE POLICY "orders_customer_insert" ON orders FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "orders_seller_read" ON orders;
CREATE POLICY "orders_seller_read" ON orders FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM order_items WHERE order_items.order_id = orders.id AND order_items.seller_id = auth.uid()));

DROP POLICY IF EXISTS "orders_admin_all" ON orders;
CREATE POLICY "orders_admin_all" ON orders FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role_id = (SELECT id FROM roles WHERE name = 'admin')));

-- RLS Policies for reviews
DROP POLICY IF EXISTS "reviews_public_read" ON reviews;
CREATE POLICY "reviews_public_read" ON reviews FOR SELECT TO authenticated USING (status = 'approved');

DROP POLICY IF EXISTS "reviews_user_own" ON reviews;
CREATE POLICY "reviews_user_own" ON reviews FOR ALL TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "reviews_seller_read" ON reviews;
CREATE POLICY "reviews_seller_read" ON reviews FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM products WHERE products.id = reviews.product_id AND products.seller_id = auth.uid()));

DROP POLICY IF EXISTS "reviews_admin_all" ON reviews;
CREATE POLICY "reviews_admin_all" ON reviews FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role_id = (SELECT id FROM roles WHERE name = 'admin')));

-- RLS Policies for wishlists
DROP POLICY IF EXISTS "wishlists_user_own" ON wishlists;
CREATE POLICY "wishlists_user_own" ON wishlists FOR ALL TO authenticated USING (user_id = auth.uid());

-- RLS Policies for notifications
DROP POLICY IF EXISTS "notifications_user_own" ON notifications;
CREATE POLICY "notifications_user_own" ON notifications FOR ALL TO authenticated USING (user_id = auth.uid());

-- RLS Policies for media
DROP POLICY IF EXISTS "media_user_own" ON media;
CREATE POLICY "media_user_own" ON media FOR ALL TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "media_admin_all" ON media;
CREATE POLICY "media_admin_all" ON media FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role_id = (SELECT id FROM roles WHERE name = 'admin')));

-- RLS Policies for blog posts
DROP POLICY IF EXISTS "blog_posts_public_read" ON blog_posts;
CREATE POLICY "blog_posts_public_read" ON blog_posts FOR SELECT TO authenticated USING (status = 'published');

DROP POLICY IF EXISTS "blog_posts_author" ON blog_posts;
CREATE POLICY "blog_posts_author" ON blog_posts FOR ALL TO authenticated USING (author_id = auth.uid());

DROP POLICY IF EXISTS "blog_posts_admin_all" ON blog_posts;
CREATE POLICY "blog_posts_admin_all" ON blog_posts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role_id = (SELECT id FROM roles WHERE name = 'admin')));

-- RLS Policies for coupons
DROP POLICY IF EXISTS "coupons_admin_all" ON coupons;
CREATE POLICY "coupons_admin_all" ON coupons FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role_id = (SELECT id FROM roles WHERE name = 'admin')));

DROP POLICY IF EXISTS "coupons_seller_all" ON coupons;
CREATE POLICY "coupons_seller_all" ON coupons FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role_id = (SELECT id FROM roles WHERE name = 'seller')));

-- RLS Policies for settings
DROP POLICY IF EXISTS "settings_public_read" ON settings;
CREATE POLICY "settings_public_read" ON settings FOR SELECT TO authenticated USING (is_public = true);

DROP POLICY IF EXISTS "settings_admin_all" ON settings;
CREATE POLICY "settings_admin_all" ON settings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role_id = (SELECT id FROM roles WHERE name = 'admin')));

-- RLS Policies for activity_logs
DROP POLICY IF EXISTS "activity_logs_user_own" ON activity_logs;
CREATE POLICY "activity_logs_user_own" ON activity_logs FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "activity_logs_admin_all" ON activity_logs;
CREATE POLICY "activity_logs_admin_all" ON activity_logs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role_id = (SELECT id FROM roles WHERE name = 'admin')));

-- Insert default roles
INSERT INTO roles (id, name, description, is_system) VALUES
  (uuid_generate_v4(), 'admin', 'Administrator with full access', true),
  (uuid_generate_v4(), 'seller', 'Product seller with limited access', true),
  (uuid_generate_v4(), 'customer', 'Regular customer', true)
ON CONFLICT (name) DO NOTHING;

-- Insert default permissions
INSERT INTO permissions (id, name, resource, action, description) VALUES
  (uuid_generate_v4(), 'products.read', 'products', 'read', 'View products'),
  (uuid_generate_v4(), 'products.create', 'products', 'create', 'Create products'),
  (uuid_generate_v4(), 'products.update', 'products', 'update', 'Update products'),
  (uuid_generate_v4(), 'products.delete', 'products', 'delete', 'Delete products'),
  (uuid_generate_v4(), 'orders.read', 'orders', 'read', 'View orders'),
  (uuid_generate_v4(), 'orders.create', 'orders', 'create', 'Create orders'),
  (uuid_generate_v4(), 'orders.manage', 'orders', 'manage', 'Manage all orders'),
  (uuid_generate_v4(), 'users.read', 'users', 'read', 'View users'),
  (uuid_generate_v4(), 'users.manage', 'users', 'manage', 'Manage users'),
  (uuid_generate_v4(), 'reviews.moderate', 'reviews', 'moderate', 'Moderate reviews'),
  (uuid_generate_v4(), 'settings.manage', 'settings', 'manage', 'Manage settings'),
  (uuid_generate_v4(), 'media.upload', 'media', 'upload', 'Upload media'),
  (uuid_generate_v4(), 'coupons.manage', 'coupons', 'manage', 'Manage coupons'),
  (uuid_generate_v4(), 'blog.manage', 'blog', 'manage', 'Manage blog')
ON CONFLICT (name) DO NOTHING;

-- Insert default frameworks
INSERT INTO frameworks (id, name, slug, description, is_popular) VALUES
  (uuid_generate_v4(), 'React', 'react', 'React - A JavaScript library for building user interfaces', true),
  (uuid_generate_v4(), 'Vue.js', 'vue', 'Vue.js - The Progressive JavaScript Framework', true),
  (uuid_generate_v4(), 'Angular', 'angular', 'Angular - One framework. Mobile & desktop', true),
  (uuid_generate_v4(), 'Next.js', 'nextjs', 'Next.js - The React Framework for Production', true),
  (uuid_generate_v4(), 'Nuxt.js', 'nuxtjs', 'Nuxt.js - The Intuitive Vue Framework', true),
  (uuid_generate_v4(), 'Svelte', 'svelte', 'Svelte - Cybernetically enhanced web apps', false),
  (uuid_generate_v4(), 'WordPress', 'wordpress', 'WordPress - Open source CMS', false),
  (uuid_generate_v4(), 'Tailwind CSS', 'tailwind', 'Tailwind CSS - A utility-first CSS framework', true),
  (uuid_generate_v4(), 'Bootstrap', 'bootstrap', 'Bootstrap - The most popular HTML, CSS, and JS library', true),
  (uuid_generate_v4(), 'Node.js', 'nodejs', 'Node.js - JavaScript runtime built on V8', false)
ON CONFLICT (slug) DO NOTHING;

-- Insert default product types
INSERT INTO product_types (id, name, slug, description, sort_order) VALUES
  (uuid_generate_v4(), 'Template', 'template', 'Ready-to-use templates', 1),
  (uuid_generate_v4(), 'UI Kit', 'ui-kit', 'User interface component kits', 2),
  (uuid_generate_v4(), 'Component', 'component', 'Individual UI components', 3),
  (uuid_generate_v4(), 'Plugin', 'plugin', 'Software plugins and extensions', 4),
  (uuid_generate_v4(), 'Theme', 'theme', 'Website and application themes', 5),
  (uuid_generate_v4(), 'Dashboard', 'dashboard', 'Admin dashboard templates', 6),
  (uuid_generate_v4(), 'Landing Page', 'landing-page', 'Landing page templates', 7),
  (uuid_generate_v4(), 'E-commerce', 'ecommerce', 'E-commerce templates and kits', 8),
  (uuid_generate_v4(), 'Documentation', 'documentation', 'Documentation templates', 9),
  (uuid_generate_v4(), 'Boilerplate', 'boilerplate', 'Starter boilerplates', 10)
ON CONFLICT (slug) DO NOTHING;

-- Insert default categories
INSERT INTO categories (id, name, slug, description, sort_order) VALUES
  (uuid_generate_v4(), 'Web Templates', 'web-templates', 'Website templates and themes', 1),
  (uuid_generate_v4(), 'Admin Dashboards', 'admin-dashboards', 'Admin panel and dashboard templates', 2),
  (uuid_generate_v4(), 'E-commerce', 'ecommerce', 'E-commerce and online store templates', 3),
  (uuid_generate_v4(), 'Landing Pages', 'landing-pages', 'Landing page templates', 4),
  (uuid_generate_v4(), 'UI Components', 'ui-components', 'UI component libraries and kits', 5),
  (uuid_generate_v4(), 'Mobile Apps', 'mobile-apps', 'Mobile application templates', 6),
  (uuid_generate_v4(), 'Email Templates', 'email-templates', 'Email newsletter templates', 7),
  (uuid_generate_v4(), 'Documentation', 'documentation', 'Documentation and help center templates', 8),
  (uuid_generate_v4(), 'Portfolio', 'portfolio', 'Portfolio website templates', 9),
  (uuid_generate_v4(), 'Blog & Magazine', 'blog-magazine', 'Blog and magazine templates', 10)
ON CONFLICT (slug) DO NOTHING;

-- Insert default settings
INSERT INTO settings (id, key, value, type, group_name, is_public) VALUES
  (uuid_generate_v4(), 'site_name', 'CodeMarket', 'string', 'general', true),
  (uuid_generate_v4(), 'site_description', 'Premium templates and components marketplace', 'string', 'general', true),
  (uuid_generate_v4(), 'site_email', 'support@codemarket.com', 'string', 'general', true),
  (uuid_generate_v4(), 'currency', 'USD', 'string', 'general', true),
  (uuid_generate_v4(), 'commission_rate', '20', 'number', 'payment', false),
  (uuid_generate_v4(), 'minimum_payout', '50', 'number', 'payment', false),
  (uuid_generate_v4(), 'license_validity_days', '365', 'number', 'license', false),
  (uuid_generate_v4(), 'max_licenses_per_product', '10', 'number', 'license', false),
  (uuid_generate_v4(), 'max_file_size_mb', '50', 'number', 'upload', false),
  (uuid_generate_v4(), 'allowed_file_types', 'zip,rar,png,jpg,jpeg,gif,pdf,json', 'string', 'upload', false)
ON CONFLICT (key) DO NOTHING;
