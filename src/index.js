require('dotenv').config();
const http = require('http');
const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');

const PORT = config.port;

/**
 * Create HTTP server
 */
const server = http.createServer(app);

/**
 * Initialize and start server
 */
const startServer = async () => {
  try {
    server.listen(PORT, () => {
      logger.info(`Server running in ${config.env} mode on port ${PORT}`);
      logger.info(`API available at ${config.api.prefix}`);
      logger.info(`API Documentation available at /api-docs`);
      logger.info(`Health check available at /health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION! Shutting down...');
  logger.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION! Shutting down...');
  logger.error(err.stack || err.message);
  process.exit(1);
});

// Handle SIGTERM
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Process terminated.');
  });
});

// Start server
startServer();

module.exports = server;
