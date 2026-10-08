import dotenv from 'dotenv';
import path from 'path';

// Load .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  CLIENT_CORS_ORIGIN: process.env.CLIENT_CORS_ORIGIN || '*',

  JWT_SECRET: process.env.JWT_SECRET || 'stockforge_super_secure_jwt_secret_dev_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  // Firebase Admin Credentials
  FIREBASE_SERVICE_ACCOUNT_PATH: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '',
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '',
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || '',
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : '',

  // Firebase Web API Key (Optional, used for email/password authentication REST API)
  FIREBASE_WEB_API_KEY: process.env.FIREBASE_WEB_API_KEY || '',

  DEFAULT_TRIAL_DAYS: parseInt(process.env.DEFAULT_TRIAL_DAYS || '14', 10),
};

