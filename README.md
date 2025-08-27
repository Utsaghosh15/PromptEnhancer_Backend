# Prompt Enhancer Backend

A production-ready Node.js backend for the Prompt Enhancer Chrome Extension, built with TypeScript, Express, MongoDB, Redis, and OpenAI.

## Features

- **Authentication**: JWT-based auth with email/password and Google OAuth
- **Prompt Enhancement**: AI-powered prompt improvement using OpenAI
- **Session Management**: Conversation context and synopsis tracking
- **Rate Limiting**: Daily quotas for anonymous (10/day) and authenticated users (20/day)
- **Queue System**: BullMQ for async synopsis updates
- **Security**: Helmet, CORS, input validation with Zod
- **Monitoring**: Winston logging and health checks

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js with TypeScript
- **Database**: MongoDB with Mongoose
- **Cache/Queue**: Redis with BullMQ
- **AI**: OpenAI API
- **Auth**: JWT + Google OAuth
- **Validation**: Zod
- **Security**: Helmet, CORS
- **Process Manager**: PM2

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB
- Redis
- OpenAI API key
- Google OAuth credentials

### Installation

1. **Clone and install dependencies**
   ```bash
   git clone <repository-url>
   cd PromptEnhancerBackend
   npm install
   ```

2. **Environment setup**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Start the server**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

5. **Start the worker (in separate terminal)**
   ```bash
   npm run worker
   ```

### Environment Variables

Create a `.env` file with the following variables:

```env
# Server Configuration
PORT=8080
NODE_ENV=production

# Database
MONGO_URI=mongodb://localhost:27017/prompt-enhancer

# Redis
REDIS_URL=redis://127.0.0.1:6379

# JWT
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d

# OpenAI
OPENAI_API_KEY=your-openai-api-key-here
MODEL_FAST=gpt-4o-mini

# CORS
CORS_ORIGIN=chrome-extension://your-extension-id-here

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
GOOGLE_REDIRECT_URI=https://your-domain.com/api/auth/google/callback

# OAuth Success URL
OAUTH_SUCCESS_URL=https://your-domain.com/auth-success
```

## API Endpoints

### Authentication

- `POST /api/auth/signup` - Create account with email/password
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/link-anon` - Link anonymous usage to user (auth required)
- `GET /api/auth/google/init` - Start Google OAuth flow
- `GET /api/auth/google/callback` - Google OAuth callback

### Core Features

- `POST /api/enhance` - Enhance a prompt (optional auth)
- `GET /health` - Health check endpoint

### Rate Limits

- **Anonymous users**: 10 enhancements per day
- **Authenticated users**: 20 enhancements per day
- **IP-based soft caps**: 30/day (anon), 60/day (user)

## Development

### Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run worker       # Start BullMQ worker
npm run lint         # Run ESLint
npm test             # Run tests
```

### Project Structure

```
src/
├── middleware/          # Express middleware
│   ├── auth.ts         # JWT authentication
│   ├── anonId.ts       # Anonymous user tracking
│   ├── limitEnhance.ts # Rate limiting
│   └── zod.ts          # Request validation
├── models/             # Mongoose models
│   ├── User.ts         # User model
│   ├── Session.ts      # Session model
│   └── Prompt.ts       # Prompt model
├── routes/             # API routes
│   ├── auth.local.ts   # Email/password auth
│   ├── auth.google.ts  # Google OAuth
│   └── enhance.ts      # Prompt enhancement
├── services/           # Business logic
│   ├── openai.ts       # OpenAI integration
│   ├── redis.ts        # Redis operations
│   ├── context.ts      # Context building
│   ├── verify.ts       # Prompt verification
│   └── queue.ts        # BullMQ queue
├── utils/              # Utilities
│   ├── env.ts          # Environment config
│   ├── logger.ts       # Winston logger
│   └── dayKey.ts       # Redis key utilities
├── workers/            # Background workers
│   └── synopsis.worker.ts
└── server.ts           # Main server file
```

## Production Deployment

### PM2 Configuration

The project includes `ecosystem.config.js` for PM2 process management:

```bash
# Install PM2 globally
npm install -g pm2

# Start both API and worker
pm2 start ecosystem.config.js

# Monitor processes
pm2 monit

# View logs
pm2 logs
```

### Docker (Optional)

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist
EXPOSE 8080

CMD ["node", "dist/server.js"]
```

## Security Features

- **JWT Authentication**: Secure token-based auth
- **Google OAuth**: PKCE flow with state validation
- **Rate Limiting**: Daily quotas and IP-based limits
- **Input Validation**: Zod schema validation
- **CORS**: Configured for Chrome extension
- **Helmet**: Security headers
- **Anonymous Tracking**: Secure cookie-based tracking

## Monitoring

- **Health Check**: `/health` endpoint for load balancers
- **Structured Logging**: Winston with different levels
- **Error Handling**: Comprehensive error middleware
- **Graceful Shutdown**: Proper cleanup on SIGTERM

## Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
