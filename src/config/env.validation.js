import dotenv from 'dotenv';
import { z } from 'zod';
import { Logger } from './logger.js';

dotenv.config();

const logger = new Logger('env-validation');

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']),

    PORT: z
      .string()
      .transform((val) => parseInt(val, 10))
      .refine((num) => !isNaN(num) && num > 0, {
        message: 'PORT must be a positive integer',
      }),

    API_URL: z.string().url(),
    DATABASE_URL: z.string().url(),

    JWT_TOKEN: z.string().min(32),
    JWT_REFRESH_TOKEN: z.string().min(32),

    CLIENT_URLS: z
      .string()
      .optional()
      .transform((val) => {
        if (!val) return null;
        return val.split(',').map((url) => url.trim());
      }),

    // Redis — optional
    REDIS_URL: z.string().optional(),

    // Cloudinary — optional
    CLOUD_NAME: z.string().optional(),
    CLOUD_API_KEY: z.string().optional(),
    CLOUD_API_SECRET: z.string().optional(),
CHROME_BIN: z.string().optional(),
    // SMTP
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z
      .string()
      .transform((val) => parseInt(val, 10))
      .optional(),
    SMTP_USER: z.string().email().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().optional(),

    // Legacy SMTP
    SENDER_EMAIL: z.string().email().optional(),
    SENDER_EMAIL_PASSWORD: z.string().optional(),

    // SendGrid
    SENDGRID_API_KEY: z.string().optional(),
    SENDGRID_SENDER: z.string().email().optional(),

    // Stripe
    STRIPE_SECRET_KEY: z.string().min(1, 'STRIPE_SECRET_KEY required'),
    STRIPE_WEBHOOK_SECRET: z.string().min(1, 'STRIPE_WEBHOOK_SECRET required'),

    // OpenAI
    OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY required'),

    // Admin
    ADMIN_EMAIL: z.string().email('ADMIN_EMAIL must be a valid email'),
    ADMIN_PASSWORD: z.string().min(6, 'ADMIN_PASSWORD must be at least 6 characters'),

    // Google OAuth
    GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required for Google OAuth'),
    GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required for Google OAuth'),
    GOOGLE_CALLBACK_URL: z.string().url('GOOGLE_CALLBACK_URL must be a valid URL'),
    FRONTEND_URL: z.string().url('FRONTEND_URL must be a valid URL'),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production') {
      const hasSMTP =
        (data.SMTP_HOST && data.SMTP_USER && data.SMTP_PASS) ||
        (data.SENDER_EMAIL && data.SENDER_EMAIL_PASSWORD);
      const hasSendGrid = data.SENDGRID_API_KEY && data.SENDGRID_SENDER;

      if (!hasSMTP && !hasSendGrid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Production: Either SMTP or SendGrid must be configured',
          path: ['SMTP_HOST'],
        });
      }
    }
  });

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  logger.error('❌ Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
