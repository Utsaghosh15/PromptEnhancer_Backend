# Postman API Testing Guide - PromptEnhancer Backend

## Base Configuration
- **Base URL**: `http://localhost:8080`
- **Global Headers**: 
  - `Content-Type: application/json`
  - `Authorization: Bearer <JWT_TOKEN>` (when authenticated)

---

## 🔐 Authentication Endpoints

### 1. User Signup (Email/Password)
**POST** `/api/auth/signup`

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Account created successfully! Please login to continue.",
  "data": {
    "user": {
      "id": "user123",
      "email": "user@example.com",
      "emailVerified": false
    }
  },
  "redirectTo": "/login"
}
```

**Error Responses:**
- `409 Conflict`: 
  ```json
  {
    "success": false,
    "message": "User already exists"
  }
  ```
- `400 Bad Request`: Validation errors
- `500 Internal Server Error`: Server error

---

### 2. User Login (Email/Password)
**POST** `/api/auth/login`

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "user123",
      "email": "user@example.com",
      "emailVerified": false
    },
    "token": "jwt_token_here"
  }
}
```

**Error Responses:**
- `401 Unauthorized`: 
  ```json
  {
    "success": false,
    "message": "Invalid credentials"
  }
  ```
- `400 Bad Request`: Validation errors

---

### 3. Link Anonymous Usage
**POST** `/api/auth/link-anon`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>
```

**Body:**
```json
{}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Anonymous usage linked successfully",
  "data": {
    "linkedCount": 2
  }
}
```

---

## 🚀 Core Enhancement Endpoint

### 4. Enhance Prompt
**POST** `/api/enhance`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN> (optional)
```

**Body Examples:**

#### Standalone Enhancement (Anonymous):
```json
{
  "prompt": "Write a blog post about AI",
  "autoCreateSession": true
}
```

#### Enhancement with Existing Session:
```json
{
  "prompt": "Continue with a stronger introduction",
  "sessionId": "session123",
  "useHistory": true,
  "lastMessages": [
    {
      "role": "user",
      "content": "Write a blog post about AI ethics"
    },
    {
      "role": "assistant", 
      "content": "Here's a draft about transparency and bias..."
    }
  ]
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "enhancedPrompt": "Create a comprehensive blog post about artificial intelligence...",
    "sessionId": "session123",
    "promptId": "prompt456",
    "latencyMs": 1250,
    "tokens": {
      "in": 45,
      "out": 120
    },
    "useHistory": true,
    "contextUsed": {
      "lastTurns": 2,
      "synopsisChars": 150
    }
  }
}
```

---

## 📋 Session Management Endpoints

### 5. Create Session
**POST** `/api/session`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN> (optional)
```

**Body:**
```json
{
  "title": "Blog Writing Session"
}
```

**Success Response (201):**
```json
{
  "sessionId": "session123",
  "title": "Blog Writing Session",
  "synopsis": {},
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

---

### 6. List Sessions
**GET** `/api/session`

**Headers:**
```
Authorization: Bearer <JWT_TOKEN> (optional)
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Success Response (200):**
```json
{
  "sessions": [
    {
      "sessionId": "session123",
      "title": "Blog Writing Session",
      "synopsis": {},
      "lastMessageAt": "2024-01-15T10:30:00.000Z",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10,
  "totalPages": 1
}
```

---

### 7. Get Session Details
**GET** `/api/session/:id`

**Headers:**
```
Authorization: Bearer <JWT_TOKEN> (optional)
```

**Success Response (200):**
```json
{
  "sessionId": "session123",
  "title": "Blog Writing Session",
  "synopsis": {
    "goal": "Write about AI",
    "tone": "professional"
  },
  "synopsisVersion": 2,
  "lastMessageAt": "2024-01-15T10:30:00.000Z",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "recentPrompts": [
    {
      "promptId": "prompt456",
      "original": "Write a blog post about AI",
      "enhanced": "Create a comprehensive blog post...",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

---

### 8. Update Session Title
**PUT** `/api/session/:id`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN> (optional)
```

**Body:**
```json
{
  "title": "Updated Session Title"
}
```

**Success Response (200):**
```json
{
  "sessionId": "session123",
  "title": "Updated Session Title",
  "synopsis": {},
  "lastMessageAt": "2024-01-15T10:30:00.000Z"
}
```

---

### 9. Delete Session
**DELETE** `/api/session/:id`

**Headers:**
```
Authorization: Bearer <JWT_TOKEN> (optional)
```

**Success Response (200):**
```json
{
  "message": "Session deleted successfully",
  "deletedPrompts": 5
}
```

---

### 10. Merge Anonymous Session
**POST** `/api/session/:id/merge`

**Headers:**
```
Authorization: Bearer <JWT_TOKEN> (required)
```

**Success Response (200):**
```json
{
  "message": "Session merged successfully",
  "sessionId": "session123"
}
```

---

## 🏥 Health Check

### 11. Health Check
**GET** `/health`

**Success Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600
}
```

---

## 📝 Testing Workflows

### Workflow 1: Anonymous User Journey
1. **Enhance Prompt (Anonymous)**
   ```bash
   POST /api/enhance
   {
     "prompt": "Write a product description",
     "autoCreateSession": true
   }
   ```

2. **Create Another Session**
   ```bash
   POST /api/session
   {
     "title": "Email Drafts"
   }
   ```

3. **Enhance in New Session**
   ```bash
   POST /api/enhance
   {
     "prompt": "Write a professional email",
     "sessionId": "<sessionId>",
     "useHistory": false
   }
   ```

### Workflow 2: Signup and Login Flow
1. **Signup**
   ```bash
   POST /api/auth/signup
   {
     "email": "user@example.com",
     "password": "password123"
   }
   ```
   - **Note**: Returns success message with redirect to login

2. **Login**
   ```bash
   POST /api/auth/login
   {
     "email": "user@example.com",
     "password": "password123"
   }
   ```
   - **Note**: Returns JWT token for authentication

3. **Link Anonymous Usage**
   ```bash
   POST /api/auth/link-anon
   Authorization: Bearer <JWT_TOKEN>
   ```

4. **Continue with Higher Limits**
   ```bash
   POST /api/enhance
   Authorization: Bearer <JWT_TOKEN>
   {
     "prompt": "Continue the previous conversation",
     "sessionId": "<previous_session_id>",
     "useHistory": true
   }
   ```

### Workflow 3: Session Management
1. **Create Multiple Sessions**
2. **List All Sessions**
3. **Get Session Details**
4. **Update Session Title**
5. **Delete Unwanted Sessions**

---

## ⚠️ Rate Limiting

### Headers in Responses:
- `X-RateLimit-Remaining`: Remaining quota
- `X-RateLimit-Limit`: Daily limit

### Limits:
- **Anonymous**: 10 enhancements/day
- **Authenticated**: 20 enhancements/day
- **IP-based**: 30/day (anon), 60/day (auth)

### Rate Limit Error (429):
```json
{
  "success": false,
  "message": "Daily quota exceeded",
  "data": {
    "retryAfter": "tomorrow"
  }
}
```

---

## 🔧 Environment Setup

### Required Environment Variables:
```bash
JWT_SECRET=your-super-secret-jwt-key-here-must-be-32-chars-minimum
MONGO_URI=mongodb://localhost:27017/prompt-enhancer
OPENAI_API_KEY=sk-your-actual-openai-api-key
CORS_ORIGIN=http://localhost:3000
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
GOOGLE_REDIRECT_URI=http://localhost:8080/api/auth/google/callback
OAUTH_SUCCESS_URL=http://localhost:3000/auth-success
```

### Prerequisites:
- MongoDB running on localhost:27017
- Redis running on localhost:6379
- OpenAI API key configured
- Server running on localhost:8080

---

## 🎯 Key Features to Test

1. **Anonymous Usage**: Test without authentication
2. **Session Isolation**: Different sessions maintain separate context
3. **Quota Management**: Rate limiting and quota tracking
4. **Authentication Flow**: Signup → Login → Enhanced limits
5. **Session Management**: CRUD operations on sessions
6. **Context Building**: History and synopsis usage
7. **Error Handling**: Proper error responses and validation

This guide covers all the main API endpoints and common testing scenarios for the PromptEnhancer backend!
