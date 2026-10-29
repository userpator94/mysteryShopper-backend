import './loadEnv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp, { startTime } from 'pino-http';
import compression from 'compression';
import path from 'path';
import { randomUUID } from 'crypto';
import { IncomingMessage } from 'http';

import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { rateLimiter } from './middleware/rateLimiter';
import apiRoutes from './routes';
import { testConnection } from './config/database';
import { validateProductionEnv } from './config/validateEnv';
import { config } from './config';
import { getAllowedOrigins, isOriginAllowed } from './config/cors';
import { logger } from './utils/logger';

validateProductionEnv();

if (!config.email.requireVerification) {
  logger.warn('REQUIRE_EMAIL_VERIFICATION=false — email verification disabled at login');
}

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || (process.env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0');
const allowedOrigins = getAllowedOrigins();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // запросы без Origin (curl, server-to-server) пропускаем
    if (!origin) return callback(null, true);
    if (isOriginAllowed(origin, allowedOrigins)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true
}));

// Compression middleware
app.use(compression());

// Trust first proxy (nginx) so req.ip reflects real client, not loopback
app.set('trust proxy', 1);

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

const resolveRequestId = (header: string | string[] | undefined): string => {
  const value = Array.isArray(header) ? header[0] : header;
  if (value && REQUEST_ID_PATTERN.test(value)) return value;
  return randomUUID();
};

const responseTimeMs = (res: unknown): number => {
  const startedAt = (res as { [startTime]?: number })[startTime];
  return typeof startedAt === 'number' ? Date.now() - startedAt : 0;
};

// Logging middleware: структурированные JSON-логи + requestId для трассировки
app.use(
  pinoHttp({
    logger,
    genReqId: (req, res) => {
      const id = resolveRequestId(req.headers['x-request-id']);
      res.setHeader('X-Request-ID', id);
      return id;
    },
    autoLogging: {
      ignore: (req) => (req.url || '').split('?')[0] === '/health'
    },
    customLogLevel: (_req, res, error) => {
      if (error || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return responseTimeMs(res) >= 500 ? 'warn' : 'info';
    },
    customProps: (req, res) => {
      const request = req as IncomingMessage & {
        ip?: string;
        userId?: string;
        userRole?: string;
      };
      const responseTime = responseTimeMs(res);
      return {
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        userId: request.userId,
        userRole: request.userRole,
        responseTime,
        slow: responseTime >= 500
      };
    },
    serializers: {
      req: (req: IncomingMessage & { id?: string }) => ({
        id: req.id,
        method: req.method,
        url: req.url
      }),
      res: (res) => ({ statusCode: res.statusCode })
    }
  })
);

// Rate limiting
app.use(rateLimiter);

// Body parsing: для POST /api/report не вызываем json/urlencoded — иначе при multipart
// (или при неверном Content-Type от прокси) body-parser пытается JSON.parse тело с boundary WebKit → 400.
const jsonBodyParser = express.json({ limit: '10mb' });
const urlencodedBodyParser = express.urlencoded({ extended: true, limit: '10mb' });

function isPostReportMultipartRoute(req: express.Request): boolean {
  if (req.method !== 'POST') return false;
  const pathOnly = req.originalUrl.split('?')[0].replace(/\/$/, '') || '/';
  return pathOnly === '/api/report' || pathOnly.endsWith('/api/report');
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

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught exception — shutting down');
  process.exit(1);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received — shutting down');
  process.exit(0);
});

// Start server
const startServer = async (): Promise<void> => {
  logger.info({ port: PORT, host: HOST }, 'Starting Mystery Shopper Backend Server');

  try {
    logger.info('Step 1: testing database connection');
    const dbConnected = await testConnection();
    if (!dbConnected) {
      logger.fatal({
        dbHost: process.env.DB_HOST || 'localhost',
        dbPort: process.env.DB_PORT || '5432',
        dbName: process.env.DB_NAME || 'msDB'
      }, 'Failed to connect to database — server will not start');
      process.exit(1);
    }

    logger.info('Step 1 completed: database connection successful');
    logger.info('Step 2: starting Express server');

    app.listen(PORT, HOST, () => {
      logger.info({
        host: HOST,
        port: PORT,
        healthCheck: `http://${HOST}:${PORT}/health`,
        dbHost: process.env.DB_HOST || 'localhost',
        dbPort: process.env.DB_PORT || '5432',
        dbName: process.env.DB_NAME || 'msDB',
        corsOrigins: allowedOrigins
      }, 'Server started successfully');
    });
  } catch (error: unknown) {
    logger.fatal({ err: error }, 'Critical error during server startup');
    process.exit(1);
  }
};

startServer();

export default app;

