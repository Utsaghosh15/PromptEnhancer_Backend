# PromptEnhancer Backend - Architecture & API Documentation

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Technology Stack](#technology-stack)
3. [System Architecture](#system-architecture)
4. [API Endpoints](#api-endpoints)
5. [Session Management](#session-management)
6. [Data Models](#data-models)
7. [Services Layer](#services-layer)
8. [Middleware Stack](#middleware-stack)
9. [Request Flow](#request-flow)
10. [Security Features](#security-features)
11. [Deployment & Configuration](#deployment--configuration)

---

## Architecture Overview

The PromptEnhancer backend is a **Node.js/Express.js** application built with **TypeScript** that provides AI-powered prompt enhancement services. It follows a layered architecture with clear separation of concerns and enterprise-grade features.

### Key Features
- **AI-Powered Prompt Enhancement**: Uses OpenAI API for intelligent prompt rewriting
- **Multi-Session Support**: Handles multiple concurrent chat sessions
- **Smart Context Management**: Maintains conversation context and synopsis
- **Flexible Authentication**: Local auth + Google OAuth 2.0
- **Anonymous Usage**: Track usage before authentication
- **Background Processing**: Async synopsis updates via BullMQ
- **Production-Ready**: Security, rate limiting, logging, monitoring

---

## Technology Stack

### Core Technologies
- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js 4.18+
- **Database**: MongoDB with Mongoose ODM
- **Cache/Queue**: Redis with BullMQ
- **AI Integration**: OpenAI API
- **Authentication**: JWT + Google OAuth 2.0

### Security & Performance
- **Security**: Helmet, CORS, rate limiting
- **Validation**: Zod schema validation
- **Logging**: Winston structured logging
- **Testing**: Jest testing framework

### Dependencies
```json
{
  "express": "^4.18.2",
  "mongoose": "^8.0.3",
  "ioredis": "^5.3.2",
  "openai": "^4.20.1",
  "bullmq": "^5.0.0",
  "jsonwebtoken": "^9.0.2",
  "bcryptjs": "^2.4.3",
  "zod": "^3.22.4",
  "helmet": "^7.1.0",
  "cors": "^2.8.5"
}
```

---

## System Architecture

```
┌─────────────────────────────────────┐
│           API Routes                │  ← Express routes & controllers
├─────────────────────────────────────┤
│           Middleware                │  ← Auth, validation, rate limiting
├─────────────────────────────────────┤
│           Services                  │  ← Business logic (OpenAI, Redis, Queue)
├─────────────────────────────────────┤
│           Models                    │  ← MongoDB schemas & data access
├─────────────────────────────────────┤
│           Utils                     │  ← Environment, logging, helpers
└─────────────────────────────────────┘
```

### Directory Structure
```
src/
├── routes/           # API endpoints
│   ├── auth.local.ts
│   ├── auth.google.ts
│   └── enhance.ts
├── middleware/       # Request processing
│   ├── auth.ts
│   ├── anonId.ts
│   ├── limitEnhance.ts
│   └── zod.ts
├── services/         # Business logic
│   ├── openai.ts
│   ├── redis.ts
│   ├── queue.ts
│   ├── context.ts
│   └── verify.ts
├── models/          # Data models
│   ├── User.ts
│   ├── Session.ts
│   └── Prompt.ts
├── workers/         # Background processing
│   └── synopsis.worker.ts
└── utils/           # Utilities
    ├── env.ts
    ├── logger.ts
    └── dayKey.ts
```

---

## API Endpoints

### 1. Health Check
**GET** `/health`
- **Purpose**: Server health status
- **Response**: Server status, uptime, timestamp
- **Authentication**: None required

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600
}
```

### 2. Authentication Endpoints

#### Local Authentication (`/api/auth`)

**POST** `/api/auth/signup`
- **Purpose**: Create new user account
- **Body**: `{ email: string, password: string }`
- **Response**: User data + JWT token
- **Features**: Password hashing, duplicate email check

**POST** `/api/auth/login`
- **Purpose**: Authenticate with email/password
- **Body**: `{ email: string, password: string }`
- **Response**: User data + JWT token
- **Features**: Password verification, OAuth account check

**POST** `/api/auth/link-anon`
- **Purpose**: Link anonymous usage to authenticated user
- **Authentication**: Required
- **Response**: Link status and count
- **Features**: Idempotent operation

#### Google OAuth (`/api/auth/google`)

**GET** `/api/auth/google/init`
- **Purpose**: Initialize OAuth flow with PKCE
- **Query**: `redirect_uri` (optional)
- **Response**: Redirects to Google OAuth
- **Features**: CSRF protection, PKCE flow

**GET** `/api/auth/google/callback`
- **Purpose**: Handle OAuth callback
- **Query**: `code`, `state`, `error`
- **Response**: Redirects with token or error
- **Features**: Token verification, user creation/linking

### 3. Core Enhancement Endpoint

**POST** `/api/enhance`
- **Purpose**: Enhance prompts using AI
- **Authentication**: Optional (anonymous usage supported)
- **Body**:
  ```json
  {
    "prompt": "string",
    "sessionId": "string (optional)",
    "useHistory": "boolean (optional)",
    "autoCreateSession": "boolean (optional)",
    "lastMessages": [
      {
        "role": "user|assistant",
        "content": "string"
      }
    ]
  }
  ```
- **Response**:
  ```json
  {
    "enhancedPrompt": "string",
    "latencyMs": "number",
    "tokens": {
      "in": "number",
      "out": "number"
    },
    "promptId": "string",
    "sessionId": "string|null",
    "useHistory": "boolean",
    "contextUsed": {
      "lastTurns": "number",
      "synopsisChars": "number"
    }
  }
  ```

### 4. Session Management Endpoints

**Session Management** (`/api/session`)

**POST** `/api/session`
- **Purpose**: Create a new session
- **Authentication**: Optional (supports anonymous sessions)
- **Body**: `{ title?: string }`
- **Response**: Session data with ID

**GET** `/api/session`
- **Purpose**: List user's sessions
- **Authentication**: Optional
- **Query**: `page`, `limit`
- **Response**: Paginated list of sessions

**GET** `/api/session/:id`
- **Purpose**: Get session details and recent prompts
- **Authentication**: Optional
- **Response**: Session data with recent prompts

**PUT** `/api/session/:id`
- **Purpose**: Update session title
- **Authentication**: Optional
- **Body**: `{ title: string }`
- **Response**: Updated session data

**DELETE** `/api/session/:id`
- **Purpose**: Delete session and all associated prompts
- **Authentication**: Optional
- **Response**: Deletion confirmation

**POST** `/api/session/:id/merge`
- **Purpose**: Merge anonymous session with authenticated user
- **Authentication**: Required
- **Response**: Merge confirmation

### 5. Planned Endpoints (TODO)

**Feedback** (`/api/feedback`)
- User feedback collection
- Enhancement quality tracking

---

## Session Management

### Session Lifecycle

```
1. Client creates new chat → POST /api/session (or autoCreateSession: true)
2. Each enhancement request → sessionId passed in request
3. Context building → Uses session's synopsis + recent messages
4. Background updates → Synopsis worker updates session context
5. Session switching → Client sends different sessionId
6. Session management → Full CRUD via /api/session endpoints
```

### Session Isolation

Each chat conversation is treated as a separate session with:

- **Unique Session ID**: Each session has a unique identifier
- **Independent Context**: Separate synopsis and conversation history
- **Isolated Updates**: Background synopsis updates are session-scoped
- **Server-Managed**: Full session lifecycle managed by server
- **Anonymous Support**: Sessions work for both authenticated and anonymous users

### Session Context Structure

```typescript
interface ISynopsis {
  goal?: string;        // Conversation objective
  tone?: string;        // Communication style
  constraints?: string; // Limitations/requirements
  audience?: string;    // Target audience
  style?: string;       // Writing style preferences
  todos?: string[];     // Pending tasks
}
```

### Example Session Flow

```
Chat Tab 1 (Blog Writing):
├── SessionId: "abc123"
├── Synopsis: { goal: "Write tech blog", tone: "professional" }
└── Messages: [user: "Write about AI", assistant: "Here's a blog post..."]

Chat Tab 2 (Email Draft):
├── SessionId: "def456" 
├── Synopsis: { goal: "Draft email", tone: "formal" }
└── Messages: [user: "Write email to boss", assistant: "Dear..."]

When switching tabs:
├── Tab 1 request: sessionId: "abc123" → Uses blog context
└── Tab 2 request: sessionId: "def456" → Uses email context
```

---

## Data Models

### User Model (`src/models/User.ts`)

```typescript
interface IUser {
  email: string;
  passwordHash?: string;
  emailVerified: boolean;
  googleId?: string;
  googleProfile?: {
    sub: string;
    name?: string;
    picture?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

**Features**:
- Email/password authentication
- Google OAuth integration
- Password hashing with bcrypt
- Email verification status

### Session Model (`src/models/Session.ts`)

```typescript
interface ISession {
  userId?: string;
  title?: string;
  synopsis: ISynopsis;
  synopsisVersion: number;
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

**Features**:
- Anonymous and authenticated sessions
- Synopsis management with versioning
- Conversation context tracking
- Efficient indexing for queries

### Prompt Model (`src/models/Prompt.ts`)

```typescript
interface IPrompt {
  userId?: string;
  sessionId?: string;
  original: string;
  enhanced: string;
  useHistory: boolean;
  contextUsed: IContextUsed;
  model: string;
  latencyMs: number;
  tokens: ITokens;
  createdAt: Date;
}
```

**Features**:
- Original and enhanced prompt storage
- Usage analytics and metrics
- Context usage tracking
- Token consumption monitoring

---

## Services Layer

### OpenAI Service (`src/services/openai.ts`)

**Core Functions**:
- `initOpenAI()`: Initialize OpenAI client
- `enhancePrompt()`: Enhance prompts using AI
- `updateSynopsis()`: Update session synopsis

**Features**:
- Intelligent prompt rewriting
- Context-aware enhancements
- Token usage tracking
- Error handling and retries

### Redis Service (`src/services/redis.ts`)

**Core Functions**:
- Rate limiting storage
- OAuth state management
- Anonymous quota tracking
- Caching layer

**Features**:
- Distributed rate limiting
- Secure OAuth state storage
- Anonymous usage tracking
- Performance optimization

### Queue Service (`src/services/queue.ts`)

**Core Functions**:
- `enqueueSynopsisUpdate()`: Queue background synopsis updates
- Background job processing
- Async task handling

**Features**:
- BullMQ integration
- Background synopsis processing
- Job retry and failure handling
- Scalable async operations

### Context Service (`src/services/context.ts`)

**Core Functions**:
- `classifyInput()`: Detect standalone vs follow-up prompts
- `buildContext()`: Build conversation context

**Features**:
- Smart input classification
- Context-aware enhancements
- Synopsis integration
- Token budget management

---

## Middleware Stack

### 1. Security Middleware
- **Helmet**: Security headers and CSP
- **CORS**: Cross-origin resource sharing
- **Trust Proxy**: Real client IP detection

### 2. Request Processing
- **Body Parsing**: JSON and URL-encoded data
- **Cookie Parser**: JWT token cookies
- **Anonymous ID**: Track anonymous users

### 3. Authentication & Authorization
- **JWT Validation**: Token verification
- **Optional Auth**: Support for anonymous usage
- **User Context**: Add user data to requests

### 4. Rate Limiting
- **Enhancement Limits**: Prevent API abuse
- **Redis-Based**: Distributed rate limiting
- **Anonymous Quotas**: Track anonymous usage

### 5. Validation
- **Zod Schemas**: Request validation
- **Type Safety**: TypeScript integration
- **Error Handling**: Structured validation errors

---

## Request Flow

### Prompt Enhancement Flow

```
1. Request → Rate Limiting → Authentication → Validation
2. Input Classification (standalone/follow-up)
3. Context Building (if follow-up with history)
4. OpenAI API Call → Prompt Enhancement
5. Verification & Patching (if needed)
6. Database Persistence
7. Background Synopsis Update (if follow-up)
8. Response with Enhanced Prompt
```

### Authentication Flow

```
1. User Login/Signup → Password Validation/OAuth
2. JWT Token Generation
3. Anonymous Quota Linking (if applicable)
4. Token Cookie Setting
5. User Data Response
```

### Session Management Flow

```
1. Client creates session → POST /api/session (server generates ID)
2. Enhancement requests → sessionId included (or autoCreateSession: true)
3. Context retrieval → Session-specific synopsis
4. Background updates → Session-scoped processing
5. Session switching → Different sessionId sent
6. Session management → Full CRUD operations via API
```

---

## Security Features

### Authentication Security
- **JWT Tokens**: Secure token-based authentication
- **Password Hashing**: bcrypt with salt rounds
- **OAuth 2.0**: Secure Google authentication with PKCE
- **CSRF Protection**: State parameter validation

### API Security
- **Rate Limiting**: Prevent abuse and DDoS
- **Input Validation**: Zod schema validation
- **CORS Configuration**: Controlled cross-origin access
- **Security Headers**: Helmet for security headers

### Data Security
- **Environment Variables**: Secure configuration management
- **Database Security**: MongoDB connection security
- **Redis Security**: Secure Redis connections
- **Error Handling**: No sensitive data in error responses

---

## Deployment & Configuration

### Environment Variables

```bash
# Database
MONGO_URI=mongodb://localhost:27017/promptenhancer

# Redis
REDIS_URL=redis://localhost:6379

# OpenAI
OPENAI_API_KEY=your_openai_api_key
MODEL_FAST=gpt-4o-mini

# Authentication
JWT_SECRET=your_jwt_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# Application
PORT=3000
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com
OAUTH_SUCCESS_URL=https://yourdomain.com/auth/success
```

### Production Deployment

1. **Build Process**:
   ```bash
   npm run build
   npm start
   ```

2. **Worker Process**:
   ```bash
   npm run worker
   ```

3. **Process Management**:
   - Use PM2 or similar for process management
   - Separate processes for main app and workers
   - Health check monitoring

### Monitoring & Logging

- **Structured Logging**: Winston with JSON format
- **Error Tracking**: Comprehensive error handling
- **Performance Monitoring**: Latency and token tracking
- **Health Checks**: `/health` endpoint for monitoring

---

## Conclusion

The PromptEnhancer backend provides a robust, scalable foundation for AI-powered prompt enhancement with:

- **Enterprise-grade security** and authentication
- **Multi-session support** for concurrent conversations
- **Smart context management** with background processing
- **Production-ready features** including monitoring and logging
- **Flexible deployment** options for various environments

The architecture is designed to handle high-scale usage while maintaining code quality, security, and performance standards.
