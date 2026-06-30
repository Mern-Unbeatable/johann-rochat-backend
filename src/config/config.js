import { env } from './env.validation.js';
import { Logger } from './logger.js';
import { CloudinaryService } from './cloudinary.js';

class Config {
  // App
  NODE_ENV = env.NODE_ENV || 'development';
  PORT = env.PORT;
  API_URL = env.API_URL;
  CLIENT_URL = env.CLIENT_URLS?.[0] || 'http://localhost:5173';

  // Database
  DATABASE_URL = env.DATABASE_URL;

  // JWT
  JWT_TOKEN = env.JWT_TOKEN;
  JWT_REFRESH_TOKEN = env.JWT_REFRESH_TOKEN;

  // Redis
  REDIS_URL = env.REDIS_URL;

  // SMTP
  SMTP_HOST = env.SMTP_HOST;
  SMTP_PORT = env.SMTP_PORT;
  SMTP_USER = env.SMTP_USER;
  SMTP_PASS = env.SMTP_PASS;
  SMTP_FROM = env.SMTP_FROM || env.SMTP_USER;

  // Legacy
  SENDER_EMAIL = env.SENDER_EMAIL;
  SENDER_EMAIL_PASSWORD = env.SENDER_EMAIL_PASSWORD;

  // SendGrid
  SENDGRID_API_KEY = env.SENDGRID_API_KEY;
  SENDGRID_SENDER = env.SENDGRID_SENDER;

  // Cloudinary
  CLOUD_NAME = env.CLOUD_NAME;
  CLOUD_API_KEY = env.CLOUD_API_KEY;
  CLOUD_API_SECRET = env.CLOUD_API_SECRET;

  // Stripe
  STRIPE_SECRET_KEY = env.STRIPE_SECRET_KEY;
  STRIPE_WEBHOOK_SECRET = env.STRIPE_WEBHOOK_SECRET;

  // OpenAI
  OPENAI_API_KEY = env.OPENAI_API_KEY;

  // Admin
  ADMIN_EMAIL = env.ADMIN_EMAIL;
  ADMIN_PASSWORD = env.ADMIN_PASSWORD;

  // Google OAuth
  GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID;
  GOOGLE_CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET;
  GOOGLE_CALLBACK_URL = env.GOOGLE_CALLBACK_URL;
  FRONTEND_URL = env.FRONTEND_URL;
CHROME_BIN = env.CHROME_BIN;
  logger;
  cloudinary;

  constructor() {
    this.logger = new Logger('Config');
    this.cloudinary = new CloudinaryService(
      env.CLOUD_NAME,
      env.CLOUD_API_KEY,
      env.CLOUD_API_SECRET,
    );
  }

  initialize() {
    try {
      if (env.CLOUD_NAME && env.CLOUD_API_KEY && env.CLOUD_API_SECRET) {
        this.cloudinary.init();
      }
      this.logger.info(' Configuration initialized', {
        env: this.NODE_ENV,
        port: this.PORT,
        googleAuth: !!this.GOOGLE_CLIENT_ID,
      });
    } catch (error) {
      this.logger.error('Failed to initialize config', error);
      throw error;
    }
  }

  validateRequired() {
    const required = ['JWT_TOKEN', 'JWT_REFRESH_TOKEN', 'DATABASE_URL'];
    const missing = required.filter((key) => !this[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required config: ${missing.join(', ')}`);
    }
    return true;
  }
}

export const config = new Config();
