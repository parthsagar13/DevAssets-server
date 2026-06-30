const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const config = require('./config');
const logger = require('./utils/logger');
const { initializeDatabase } = require('./config/database');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');
const { defaultLimiter } = require('./middlewares/rateLimiter');

// Routes
const authRoutes = require('./routes/auth.routes');
const productRoutes = require('./routes/product.routes');
const categoryRoutes = require('./routes/category.routes');
const frameworkRoutes = require('./routes/framework.routes');
const taxonomyRoutes = require('./routes/taxonomy.routes');
const mediaRoutes = require('./routes/media.routes');
const orderRoutes = require('./routes/order.routes');
const reviewRoutes = require('./routes/review.routes');
const couponRoutes = require('./routes/coupon.routes');
const wishlistRoutes = require('./routes/wishlist.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const blogRoutes = require('./routes/blog.routes');
const searchRoutes = require('./routes/search.routes');

const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS configuration
app.use(cors({
  origin: config.env === 'production' ? process.env.ALLOWED_ORIGINS?.split(',') : '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
app.use(morgan('combined', {
  stream: { write: message => logger.info(message.trim()) }
}));

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API routes
const apiPrefix = config.api.prefix;

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: config.env
  });
});

// API documentation
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'CodeMarket API',
    version: '1.0.0',
    description: 'Production-ready Backend API for CodeMarket AI Developer Marketplace',
    contact: {
      name: 'CodeMarket Support',
      email: 'support@codemarket.com'
    }
  },
  servers: [
    {
      url: `http://localhost:${config.port}${apiPrefix}`,
      description: 'Development server'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          username: { type: 'string' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          avatarUrl: { type: 'string' },
          role: { type: 'object' },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      Product: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          slug: { type: 'string' },
          price: { type: 'number' },
          compareAtPrice: { type: 'number' },
          shortDescription: { type: 'string' },
          description: { type: 'string' },
          thumbnailUrl: { type: 'string' },
          status: { type: 'string', enum: ['draft', 'pending', 'published', 'archived'] },
          isFeatured: { type: 'boolean' },
          isTrending: { type: 'boolean' },
          isFree: { type: 'boolean' },
          downloadCount: { type: 'integer' },
          viewCount: { type: 'integer' },
          purchaseCount: { type: 'integer' },
          averageRating: { type: 'number' },
          reviewCount: { type: 'integer' },
          category: { $ref: '#/components/schemas/Category' },
          framework: { $ref: '#/components/schemas/Framework' },
          seller: { $ref: '#/components/schemas/User' }
        }
      },
      Category: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          slug: { type: 'string' },
          description: { type: 'string' }
        }
      },
      Framework: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          slug: { type: 'string' }
        }
      },
      Order: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          orderNumber: { type: 'string' },
          subtotal: { type: 'number' },
          discount: { type: 'number' },
          total: { type: 'number' },
          status: { type: 'string' },
          paymentStatus: { type: 'string' },
          items: { type: 'array', items: { type: 'object' } }
        }
      },
      Review: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          rating: { type: 'integer', minimum: 1, maximum: 5 },
          title: { type: 'string' },
          content: { type: 'string' },
          status: { type: 'string' }
        }
      },
      Coupon: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          code: { type: 'string' },
          type: { type: 'string', enum: ['percentage', 'fixed'] },
          value: { type: 'number' },
          isActive: { type: 'boolean' }
        }
      },
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string' },
          errors: { type: 'array', items: { type: 'object' } },
          timestamp: { type: 'string', format: 'date-time' }
        }
      },
      Success: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: { type: 'object' },
          timestamp: { type: 'string', format: 'date-time' }
        }
      },
      PaginatedResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: { type: 'array', items: {} },
          pagination: {
            type: 'object',
            properties: {
              page: { type: 'integer' },
              limit: { type: 'integer' },
              total: { type: 'integer' },
              totalPages: { type: 'integer' },
              hasNext: { type: 'boolean' },
              hasPrev: { type: 'boolean' }
            }
          },
          timestamp: { type: 'string', format: 'date-time' }
        }
      }
    }
  },
  paths: {}
};

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'CodeMarket API Documentation'
}));

// Mount routes
app.use(`${apiPrefix}/auth`, authRoutes);
app.use(`${apiPrefix}/products`, productRoutes);
app.use(`${apiPrefix}/categories`, categoryRoutes);
app.use(`${apiPrefix}/frameworks`, frameworkRoutes);
app.use(`${apiPrefix}`, taxonomyRoutes);
app.use(`${apiPrefix}/media`, mediaRoutes);
app.use(`${apiPrefix}/orders`, orderRoutes);
app.use(`${apiPrefix}/reviews`, reviewRoutes);
app.use(`${apiPrefix}/coupons`, couponRoutes);
app.use(`${apiPrefix}/wishlist`, wishlistRoutes);
app.use(`${apiPrefix}/dashboard`, dashboardRoutes);
app.use(`${apiPrefix}/blog`, blogRoutes);
app.use(`${apiPrefix}/search`, searchRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize database and start server
const startServer = async () => {
  try {
    await initializeDatabase();
    logger.info(`Database initialized successfully`);
  } catch (error) {
    logger.warn(`Database initialization skipped: ${error.message}`);
    logger.info(`Running in mock mode without database connection`);
  }
};

startServer();

module.exports = app;
