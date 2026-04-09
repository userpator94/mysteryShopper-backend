import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';

import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { rateLimiter } from './middleware/rateLimiter';
import apiRoutes from './routes';
import { testConnection } from './config/database';

// Load environment variables
dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || (process.env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0');

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Compression middleware
app.use(compression());

// Logging middleware
app.use(morgan('combined'));

// Rate limiting
app.use(rateLimiter);

// Body parsing: для POST /api/report не вызываем json/urlencoded — иначе при multipart
// (или при неверном Content-Type от прокси) body-parser пытается JSON.parse тело с boundary WebKit → 400.
const jsonBodyParser = express.json({ limit: '10mb' });
const urlencodedBodyParser = express.urlencoded({ extended: true, limit: '10mb' });

function isPostReportMultipartRoute(req: express.Request): boolean {
  if (req.method !== 'POST') return false;
  const pathOnly = req.originalUrl.split('?')[0].replace(/\/$/, '') || '/';
  return pathOnly === '/api/report';
}

app.use((req, res, next) => {
  if (isPostReportMultipartRoute(req)) return next();
  return jsonBodyParser(req, res, next);
});
app.use((req, res, next) => {
  if (isPostReportMultipartRoute(req)) return next();
  return urlencodedBodyParser(req, res, next);
});

// Static files for uploaded photos
app.use('/api/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api', apiRoutes);

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const startServer = async () => {
  console.log('🚀 Starting Mystery Shopper Backend Server...');
  console.log(`📅 Started at: ${new Date().toISOString()}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  try {
    console.log('🔍 Step 1: Testing database connection...');
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('❌ CRITICAL: Failed to connect to database. Server will not start.');
      console.error('💡 Please check:');
      console.error('   1. PostgreSQL is running');
      console.error('   2. Database credentials are correct');
      console.error('   3. Database exists');
      console.error('   4. Network connectivity');
      process.exit(1);
    }
    
    console.log('✅ Step 1 completed: Database connection successful');
    console.log('🔍 Step 2: Starting Express server...');

    app.listen(PORT, HOST, () => {
      console.log('🎉 SERVER STARTED SUCCESSFULLY!');
      console.log(`🚀 Server is running on ${HOST}:${PORT}`);
      console.log(`📊 Health check: http://${HOST}:${PORT}/health`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🗄️ Database: ${process.env.DB_NAME || 'msDB'} on ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}`);
      console.log(`🔒 CORS Origin: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`);
      console.log('📝 Ready to handle requests!');
    });
  } catch (error: any) {
    console.error('❌ CRITICAL ERROR during server startup:');
    console.error(`   Error: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
    console.error('💡 Server failed to start. Please check the logs above.');
    process.exit(1);
  }
};

startServer();

export default app;

