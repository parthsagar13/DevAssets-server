const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  port: parseInt(process.env.PORT) || 5000,
  env: process.env.NODE_ENV || 'development',
  api: {
    prefix: process.env.API_PREFIX || '/api'
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'codemarket-super-secret-jwt-key-2024',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'codemarket-super-secret-refresh-key-2024',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
  },
  email: {
    host: process.env.SMTP_HOST || 'smtp.example.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'noreply@codemarket.com'
  },
  upload: {
    maxSize: parseInt(process.env.MAX_FILE_SIZE) || 52428800,
    dir: process.env.UPLOAD_DIR || 'uploads'
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
  },
  supabase: {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || null,
    anonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || null,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || null
  }
};
