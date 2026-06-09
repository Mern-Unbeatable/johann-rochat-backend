import { json, urlencoded } from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import compression from 'compression';
import HTTP_STATUS from 'http-status-codes';
import apiStats from 'swagger-stats';
import express from 'express';
import passport from 'passport';

import { config } from './config/config.js';
import applicationRoutes from './routes/index.js';
import { Logger } from './config/logger.js';
import { CustomError } from './shared/globals/helpers/error-handler.js';
import './features/auth/google.strategy.js';

export class Server {
  constructor(app) {
    this.app = app;
    this.log = new Logger('Server');
    this.isConfigured = false;
  }

  start() {
    this.configure();
    void this.startServer(this.app);
  }

  configure() {
    if (this.isConfigured) return;
    this.securityMiddleware(this.app);
    this.webhookRawBody(this.app);
    this.standardMiddleware(this.app);
    this.routesMiddleware(this.app);
    this.apiMonitoring(this.app);
    this.globalErrorHandler(this.app);
    this.isConfigured = true;
  }

  securityMiddleware(app) {
    app.set('trust proxy', 1);
    app.use(hpp());

    app.use(
      helmet({
        crossOriginResourcePolicy: { policy: 'cross-origin' },
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            imgSrc: ["'self'", "data:", "https:"],
          },
        },
      }),
    );

    const allowedOrigins = [
      'http://localhost:5173',
      "https://casagen.ch"
    ];

    app.use(
      cors({
        origin: (origin, callback) => {
          if (!origin) return callback(null, true);

          if (allowedOrigins.includes(origin)) {
            return callback(null, true);
          }

          return callback(new Error(`CORS blocked: ${origin}`));
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        optionsSuccessStatus: 200,
      }),
    );
  }

  webhookRawBody(app) {
    app.use(
      '/api/v1/payments/webhook',
      express.raw({
        type: 'application/json',
        limit: '1mb',
      }),
    );
  }

  standardMiddleware(app) {
    app.use(compression());
    app.use(json({ limit: '50mb' }));
    app.use(urlencoded({ extended: true, limit: '50mb' }));
    app.use((req, _res, next) => {
      this.log.http(`${req.method} ${req.originalUrl}`);
      next();
    });

    app.use(passport.initialize());
  }

  routesMiddleware(app) {
    applicationRoutes(app);
  }

  apiMonitoring(app) {
    if (config.NODE_ENV === 'test') return;
    app.use(apiStats.getMiddleware({ uriPath: '/api-monitoring' }));
  }

  globalErrorHandler(app) {
    app.use((req, res) => {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        status: 'error',
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: `${req.originalUrl} not found`,
      });
    });

    app.use((error, _req, res, _next) => {
      this.log.error('Global error handler', {
        name: error.name,
        message: error.message,
      });

      if (error instanceof CustomError) {
        return res.status(error.statusCode).json(error.serializeErrors());
      }

      if (error.name === 'JsonWebTokenError') {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          status: 'error',
          statusCode: HTTP_STATUS.UNAUTHORIZED,
          message: 'Invalid authentication token',
        });
      }

      if (error.name === 'TokenExpiredError') {
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
          status: 'error',
          statusCode: HTTP_STATUS.UNAUTHORIZED,
          message: 'Authentication token expired',
        });
      }

      if (error.code === 'P2002') {
        return res.status(HTTP_STATUS.CONFLICT).json({
          status: 'error',
          statusCode: HTTP_STATUS.CONFLICT,
          message: 'A record with this value already exists',
        });
      }

      if (error.code === 'P2025') {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          status: 'error',
          statusCode: HTTP_STATUS.NOT_FOUND,
          message: 'Record not found',
        });
      }

      const isProduction = config.NODE_ENV === 'production';
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        status: 'error',
        statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        message: isProduction ? 'Internal server error' : error.message,
        ...(isProduction ? {} : { stack: error.stack }),
      });
    });
  }

  async startServer(app) {
    if (!config.JWT_TOKEN) throw new Error('JWT_TOKEN must be provided');
    try {
      const httpServer = new http.Server(app);
      this.startHttpServer(httpServer);
    } catch (error) {
      this.log.error('Failed to start server', error);
      process.exit(1);
    }
  }

  startHttpServer(httpServer) {
    this.log.info(`Worker started (PID: ${process.pid})`);
    httpServer.listen(config.PORT, () => {
      this.log.info(`Server running on port ${config.PORT}`);
      this.log.info(`Environment: ${config.NODE_ENV}`);
    });
    httpServer.on('error', (error) => {
      this.log.error('HTTP server error', error);
      if (error.code === 'EADDRINUSE') {
        this.log.error(`Port ${config.PORT} is already in use`);
        process.exit(1);
      }
    });
  }
}
