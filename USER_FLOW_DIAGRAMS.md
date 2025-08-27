# User Flow Diagrams - PromptEnhancer Backend

## Table of Contents
1. [Anonymous User Enhancement Flow](#anonymous-user-enhancement-flow)
2. [Chat Switching Flow](#chat-switching-flow)
3. [Anonymous to Authenticated User Flow](#anonymous-to-authenticated-user-flow)
4. [Complete User Journey Flow](#complete-user-journey-flow)

---

## Anonymous User Enhancement Flow

### Flow Diagram
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Anonymous     │    │   Frontend      │    │   Backend       │
│     User        │    │   Client        │    │   API           │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │ 1. User types prompt  │                       │
         │──────────────────────▶│                       │
         │                       │                       │
         │                       │ 2. POST /api/enhance  │
         │                       │──────────────────────▶│
         │                       │ {                     │
         │                       │   prompt: "Write...", │
         │                       │   autoCreateSession: true │
         │                       │ }                     │
         │                       │                       │
         │                       │ 3. Anonymous ID Check │
         │                       │◀──────────────────────│
         │                       │ (anonId cookie)       │
         │                       │                       │
         │                       │ 4. Rate Limit Check   │
         │                       │◀──────────────────────│
         │                       │ Redis: anon:abc123:20240115 │
         │                       │                       │
         │                       │ 5. Auto-Create Session│
         │                       │◀──────────────────────│
         │                       │ Session.createSession │
         │                       │ (userId: null, anonId)│
         │                       │                       │
         │                       │ 6. OpenAI Enhancement │
         │                       │◀──────────────────────│
         │                       │ enhancePrompt()       │
         │                       │                       │
         │                       │ 7. Save Prompt        │
         │                       │◀──────────────────────│
         │                       │ Prompt.createPrompt() │
         │                       │                       │
         │                       │ 8. Response           │
         │                       │◀──────────────────────│
         │                       │ {                     │
         │                       │   enhancedPrompt: "...", │
         │                       │   sessionId: "sess_123", │
         │                       │   quotaRemaining: 9   │
         │                       │ }                     │
         │                       │                       │
         │ 9. Display enhanced   │                       │
         │◀──────────────────────│                       │
         │ prompt + session info │                       │
         │                       │                       │
```

### Detailed Steps

#### **Step 1: User Input**
- Anonymous user types a prompt in the frontend
- Frontend prepares request with `autoCreateSession: true`

#### **Step 2: API Request**
```javascript
POST /api/enhance
{
  "prompt": "Write a blog post about AI",
  "autoCreateSession": true,
  "useHistory": false
}
```

#### **Step 3: Anonymous ID Processing**
- Backend extracts `anonId` from cookie (e.g., `abc123`)
- If no anonId exists, creates new one and sets cookie

#### **Step 4: Rate Limiting Check**
```typescript
// Redis key: enh:anon:abc123:20240115
const quota = await checkAnonQuota(anonId);
// Returns: { allowed: true, remaining: 9 }
```

#### **Step 5: Session Creation**
```typescript
// Auto-create session for anonymous user
const session = await Session.createSession(
  userId: null,           // Anonymous user
  title: undefined,       // No title initially
  anonId: "abc123"        // Anonymous identifier
);
// Returns: sessionId: "sess_123"
```

#### **Step 6: Prompt Enhancement**
- OpenAI API call to enhance the prompt
- Returns enhanced version with token usage

#### **Step 7: Database Storage**
```typescript
// Save prompt with session association
const prompt = await Prompt.createPrompt({
  userId: null,           // Anonymous
  sessionId: "sess_123",  // Auto-created session
  original: "Write a blog post about AI",
  enhanced: "Create a comprehensive blog post...",
  useHistory: false,
  contextUsed: { lastTurns: 0, synopsisChars: 0 }
});
```

#### **Step 8: Response**
```json
{
  "enhancedPrompt": "Create a comprehensive blog post...",
  "sessionId": "sess_123",
  "promptId": "prompt_456",
  "latencyMs": 1250,
  "tokens": { "in": 45, "out": 120 },
  "quotaRemaining": 9
}
```

---

## Chat Switching Flow

### Flow Diagram
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Anonymous     │    ┌─────────────────┐    │   Backend       │
│     User        │    │   Frontend      │    │   API           │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │ 1. User clicks "New   │                       │
         │    Chat" button       │                       │
         │──────────────────────▶│                       │
         │                       │                       │
         │                       │ 2. POST /api/session  │
         │                       │──────────────────────▶│
         │                       │ { title: "New Chat" } │
         │                       │                       │
         │                       │ 3. Create New Session │
         │                       │◀──────────────────────│
         │                       │ Session.createSession │
         │                       │ (anonId: "abc123")    │
         │                       │                       │
         │                       │ 4. Response           │
         │                       │◀──────────────────────│
         │                       │ {                     │
         │                       │   sessionId: "sess_456", │
         │                       │   title: "New Chat"   │
         │                       │ }                     │
         │                       │                       │
         │ 5. Frontend switches  │                       │
         │◀──────────────────────│                       │
         │ to new session        │                       │
         │                       │                       │
         │ 6. User types prompt  │                       │
         │    in new chat        │                       │
         │──────────────────────▶│                       │
         │                       │                       │
         │                       │ 7. POST /api/enhance  │
         │                       │──────────────────────▶│
         │                       │ {                     │
         │                       │   prompt: "Write...", │
         │                       │   sessionId: "sess_456" │
         │                       │ }                     │
         │                       │                       │
         │                       │ 8. Same Rate Limit    │
         │                       │◀──────────────────────│
         │                       │ Check (anon:abc123)   │
         │                       │                       │
         │                       │ 9. Use Existing       │
         │                       │◀──────────────────────│
         │                       │ Session (sess_456)    │
         │                       │                       │
         │                       │ 10. Enhancement       │
         │                       │◀──────────────────────│
         │                       │ & Response            │
         │                       │                       │
         │ 11. Display in new    │                       │
         │◀──────────────────────│                       │
         │ chat tab              │                       │
         │                       │                       │
```

### Detailed Steps

#### **Step 1-2: New Chat Creation**
```javascript
// Frontend creates new chat
POST /api/session
{
  "title": "New Chat"
}
```

#### **Step 3: Session Creation**
```typescript
// Backend creates new session
const session = await Session.createSession(
  userId: null,
  title: "New Chat",
  anonId: "abc123"  // Same anonId, different session
);
// Returns: sessionId: "sess_456"
```

#### **Step 4: Session Response**
```json
{
  "sessionId": "sess_456",
  "title": "New Chat",
  "synopsis": {},
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```

#### **Step 5-7: Using New Session**
```javascript
// User types in new chat
POST /api/enhance
{
  "prompt": "Write an email to my boss",
  "sessionId": "sess_456",  // Different session ID
  "useHistory": false
}
```

#### **Step 8: Rate Limiting**
- Same anonId (`abc123`) used for quota tracking
- Quota is shared across all sessions for anonymous user
- Remaining: 8 (after previous enhancement)

#### **Step 9-10: Session Context**
- Uses `sess_456` session context (empty initially)
- Different from `sess_123` session
- Each session maintains separate conversation history

---

## Anonymous to Authenticated User Flow

### Flow Diagram
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Anonymous     │    ┌─────────────────┐    │   Backend       │
│     User        │    │   Frontend      │    │   API           │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │ 1. User clicks        │                       │
         │    "Sign Up"          │                       │
         │──────────────────────▶│                       │
         │                       │                       │
         │                       │ 2. POST /api/auth/signup │
         │                       │──────────────────────▶│
         │                       │ {                     │
         │                       │   email: "user@...",  │
         │                       │   password: "..."     │
         │                       │ }                     │
         │                       │                       │
         │                       │ 3. Create User        │
         │                       │◀──────────────────────│
         │                       │ User.createWithPassword() │
         │                       │                       │
         │                       │ 4. Link Anonymous     │
         │                       │◀──────────────────────│
         │                       │ Quota (anonId: abc123)│
         │                       │                       │
         │                       │ 5. Response with Token│
         │                       │◀──────────────────────│
         │                       │ {                     │
         │                       │   token: "jwt_xyz",   │
         │                       │   user: {...},        │
         │                       │   linkedCount: 2      │
         │                       │ }                     │
         │                       │                       │
         │ 6. Frontend updates   │                       │
         │◀──────────────────────│                       │
         │ with user session     │                       │
         │                       │                       │
         │ 7. User continues in  │                       │
         │    same chat          │                       │
         │──────────────────────▶│                       │
         │                       │                       │
         │                       │ 8. POST /api/enhance  │
         │                       │──────────────────────▶│
         │                       │ {                     │
         │                       │   prompt: "Continue...", │
         │                       │   sessionId: "sess_456", │
         │                       │   useHistory: true    │
         │                       │ }                     │
         │                       │                       │
         │                       │ 9. Higher Rate Limit  │
         │                       │◀──────────────────────│
         │                       │ Check (user:user123)  │
         │                       │                       │
         │                       │ 10. Merge Session     │
         │                       │◀──────────────────────│
         │                       │ Session.userId = user123 │
         │                       │                       │
         │                       │ 11. Enhanced Response │
         │                       │◀──────────────────────│
         │                       │ with higher quota     │
         │                       │                       │
         │ 12. Display with      │                       │
         │◀──────────────────────│                       │
         │ higher limit (20/day) │                       │
         │                       │                       │
```

### Detailed Steps

#### **Step 1-2: User Signup**
```javascript
// User signs up while in existing chat
POST /api/auth/signup
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

#### **Step 3: User Creation**
```typescript
// Backend creates authenticated user
const user = await User.createWithPassword(email, password);
// Returns: userId: "user123"
```

#### **Step 4: Anonymous Quota Linking**
```typescript
// Link anonymous usage to new user
const linkResult = await linkAnonQuota(userId, anonId);
// Redis operations:
// 1. Get anon usage: enh:anon:abc123:20240115 → "2"
// 2. Add to user: enh:user:user123:20240115 += 2
// 3. Mark linked: link:anon:user123:abc123:20240115 → "1"
// Returns: { linked: true, count: 2 }
```

#### **Step 5: Authentication Response**
```json
{
  "message": "User created successfully",
  "user": {
    "id": "user123",
    "email": "user@example.com",
    "emailVerified": false
  },
  "token": "jwt_xyz123",
  "linkedCount": 2
}
```

#### **Step 6-8: Continue in Same Chat**
```javascript
// User continues in existing chat (now authenticated)
POST /api/enhance
{
  "prompt": "Continue writing the email",
  "sessionId": "sess_456",  // Same session ID
  "useHistory": true
}
```

#### **Step 9: Higher Rate Limit**
```typescript
// Now uses user quota instead of anonymous
const quota = await checkUserQuota(userId);
// Redis key: enh:user:user123:20240115
// Current usage: 2 (from linked anonymous usage)
// Remaining: 18 (20 - 2)
```

#### **Step 10: Session Ownership Transfer**
```typescript
// Update session to belong to authenticated user
await Session.findOneAndUpdate(
  { _id: "sess_456", anonId: "abc123" },
  { userId: "user123", anonId: null }
);

// Update all prompts in this session
await Prompt.updateMany(
  { sessionId: "sess_456" },
  { userId: "user123", anonId: null }
);
```

#### **Step 11-12: Enhanced Response**
```json
{
  "enhancedPrompt": "Here's the continuation of your email...",
  "sessionId": "sess_456",
  "promptId": "prompt_789",
  "latencyMs": 1100,
  "tokens": { "in": 67, "out": 145 },
  "quotaRemaining": 17  // Higher limit (20/day)
}
```

---

## Complete User Journey Flow

### Comprehensive Flow Diagram
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Journey  │    │   Frontend      │    │   Backend       │
│                 │    │   State         │    │   State         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │ 1. Anonymous User     │                       │
         │    starts using app   │                       │
         │──────────────────────▶│                       │
         │                       │                       │
         │                       │ 2. Generate anonId    │
         │                       │◀──────────────────────│
         │                       │ (cookie: anonId=abc123) │
         │                       │                       │
         │ 3. First enhancement  │                       │
         │──────────────────────▶│                       │
         │                       │                       │
         │                       │ 4. Rate limit check   │
         │                       │◀──────────────────────│
         │                       │ Redis: anon:abc123:20240115 │
         │                       │                       │
         │                       │ 5. Auto-create session│
         │                       │◀──────────────────────│
         │                       │ Session: sess_123     │
         │                       │                       │
         │                       │ 6. Enhancement        │
         │                       │◀──────────────────────│
         │                       │ OpenAI API call       │
         │                       │                       │
         │                       │ 7. Save prompt        │
         │                       │◀──────────────────────│
         │                       │ Prompt: prompt_456    │
         │                       │                       │
         │ 8. Response (9 left)  │                       │
         │◀──────────────────────│                       │
         │                       │                       │
         │ 9. User creates       │                       │
         │    new chat           │                       │
         │──────────────────────▶│                       │
         │                       │                       │
         │                       │ 10. New session       │
         │                       │◀──────────────────────│
         │                       │ Session: sess_456     │
         │                       │                       │
         │ 11. Second enhancement│                       │
         │    in new chat        │                       │
         │──────────────────────▶│                       │
         │                       │                       │
         │                       │ 12. Same rate limit   │
         │                       │◀──────────────────────│
         │                       │ (8 left, same anonId) │
         │                       │                       │
         │ 13. Response (8 left) │                       │
         │◀──────────────────────│                       │
         │                       │                       │
         │ 14. User signs up     │                       │
         │    while in chat      │                       │
         │──────────────────────▶│                       │
         │                       │                       │
         │                       │ 15. Create user       │
         │                       │◀──────────────────────│
         │                       │ User: user123         │
         │                       │                       │
         │                       │ 16. Link quotas       │
         │                       │◀──────────────────────│
         │                       │ anon:abc123 → user:user123 │
         │                       │                       │
         │ 17. Continue in same  │                       │
         │    chat (authenticated)│                       │
         │──────────────────────▶│                       │
         │                       │                       │
         │                       │ 18. Higher rate limit │
         │                       │◀──────────────────────│
         │                       │ user:user123 (18 left)│
         │                       │                       │
         │                       │ 19. Transfer session  │
         │                       │◀──────────────────────│
         │                       │ sess_456.userId = user123 │
         │                       │                       │
         │ 20. Enhanced response │                       │
         │◀──────────────────────│                       │
         │ (18 left, 20/day limit)│                       │
         │                       │                       │
```

### Key State Transitions

#### **Anonymous State**
```typescript
// User starts anonymous
{
  anonId: "abc123",
  quota: { used: 0, limit: 10, remaining: 10 },
  sessions: [],
  isAuthenticated: false
}
```

#### **After First Enhancement**
```typescript
// First enhancement
{
  anonId: "abc123",
  quota: { used: 1, limit: 10, remaining: 9 },
  sessions: ["sess_123"],
  currentSession: "sess_123",
  isAuthenticated: false
}
```

#### **After New Chat**
```typescript
// New chat created
{
  anonId: "abc123",
  quota: { used: 2, limit: 10, remaining: 8 },
  sessions: ["sess_123", "sess_456"],
  currentSession: "sess_456",
  isAuthenticated: false
}
```

#### **After Signup**
```typescript
// User authenticated
{
  userId: "user123",
  anonId: "abc123", // Still available for linking
  quota: { used: 2, limit: 20, remaining: 18 }, // Higher limit
  sessions: ["sess_123", "sess_456"],
  currentSession: "sess_456",
  isAuthenticated: true
}
```

### Redis Key Evolution

#### **Anonymous Usage**
```
enh:anon:abc123:20240115 → "1"  (first enhancement)
enh:anon:abc123:20240115 → "2"  (second enhancement)
```

#### **After Signup**
```
enh:user:user123:20240115 → "2"  (linked from anonymous)
enh:anon:abc123:20240115 → "2"  (still exists, but not used)
link:anon:user123:abc123:20240115 → "1"  (marked as linked)
```

#### **Continued Usage**
```
enh:user:user123:20240115 → "3"  (third enhancement)
enh:user:user123:20240115 → "4"  (fourth enhancement)
```

### Database State Evolution

#### **Session Ownership**
```typescript
// Before signup
Session: { _id: "sess_456", userId: null, anonId: "abc123" }
Prompt: { sessionId: "sess_456", userId: null, anonId: "abc123" }

// After signup
Session: { _id: "sess_456", userId: "user123", anonId: null }
Prompt: { sessionId: "sess_456", userId: "user123", anonId: null }
```

This comprehensive flow ensures **seamless user experience** from anonymous usage to authenticated usage while maintaining **data integrity** and **proper quota management** across all scenarios!
