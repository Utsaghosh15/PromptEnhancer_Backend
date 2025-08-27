// Jest setup file for test environment
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://localhost:27017/prompt-enhancer-test';
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.CORS_ORIGIN = 'chrome-extension://test-extension-id';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
process.env.GOOGLE_REDIRECT_URI = 'https://test.com/api/auth/google/callback';
process.env.OAUTH_SUCCESS_URL = 'https://test.com/auth-success';

// Global test timeout
jest.setTimeout(10000);
