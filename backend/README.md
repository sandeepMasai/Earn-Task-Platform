# Earn Task Platform - Backend API

Complete backend API for the Earn Task Platform React Native app.

## Features

- **Authentication**: User registration, login, JWT tokens
- **Tasks**: Create, read, complete tasks with coin rewards
- **Wallet**: Balance tracking, transactions, withdrawal requests
- **Posts/Feed**: Upload posts, like/unlike, feed pagination
- **Referral System**: Referral codes and bonus rewards

## Tech Stack

- Node.js
- Express.js
- MongoDB with Mongoose
- JWT Authentication
- Multer for file uploads

## Installation

1. Install dependencies:
```bash
cd backend
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Update `.env` with your configuration:
```env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/earn-task-platform?replicaSet=rs0
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRE=1h
```

4. Use MongoDB Atlas or a local replica set. Wallet and reward operations require transactions. For a new local MongoDB instance:
```bash
mongod --replSet rs0 --bind_ip 127.0.0.1
# In another terminal, initialize once:
mongosh --eval "rs.initiate()"
```

5. Start the server:
```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (Protected)
- `PUT /api/auth/instagram-id` - Update Instagram ID (Protected)
- `POST /api/auth/logout` - Logout (Protected)

### Tasks
- `GET /api/tasks` - Get all tasks (Protected)
- `GET /api/tasks/:id` - Get task by ID (Protected)
- `POST /api/tasks/:id/complete` - Complete a task (Protected)
- `POST /api/tasks/verify/instagram-follow` - Verify Instagram follow (Protected)
- `POST /api/tasks/verify/youtube-subscribe` - Verify YouTube subscribe (Protected)

### Wallet
- `GET /api/wallet/balance` - Get wallet balance (Protected)
- `GET /api/wallet/transactions` - Get transaction history (Protected)
- `POST /api/wallet/withdraw` - Request withdrawal (Protected)
- `GET /api/wallet/withdrawals` - Get withdrawal requests (Protected)

### Posts
- `GET /api/posts/feed` - Get feed with pagination (Protected)
- `POST /api/posts` - Upload post (Protected, requires image)
- `POST /api/posts/:id/like` - Like a post (Protected)
- `POST /api/posts/:id/unlike` - Unlike a post (Protected)
- `GET /api/posts/:id` - Get post by ID (Protected)

## Database Models

### User
- email, password, name, username
- instagramId, coins, totalEarned, totalWithdrawn
- referralCode, referredBy

### Task
- type, title, description, coins
- videoUrl, videoDuration, instagramUrl, youtubeUrl
- completedBy (array of user completions)

### Transaction
- user, type, amount, description
- task, withdrawal (references)

### Withdrawal
- user, amount, status, paymentMethod
- accountDetails, processedAt

### Post
- user, imageUrl, caption
- likes, comments arrays

## Coin System

- Watch Video: 10 coins
- Instagram Follow: 50 coins
- Instagram Like: 20 coins
- YouTube Subscribe: 100 coins
- Referral Bonus: 500 coins
- Post Upload: 30 coins
- Daily Login: 25 coins

**Conversion**: 100 coins = ₹1
**Minimum Withdrawal**: 1000 coins

## Authentication

All protected routes require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

## File Uploads

Post images are uploaded to `/uploads` directory and served at `/uploads/:filename`

## Error Handling

All errors follow this format:
```json
{
  "success": false,
  "error": "Error message"
}
```

## Success Responses

All success responses follow this format:
```json
{
  "success": true,
  "data": { ... }
}
```

## Development

The server runs on `http://localhost:3000` by default.

Update the frontend `API_BASE_URL` in `src/constants/index.ts` to point to your backend:
```typescript
export const API_BASE_URL = 'http://localhost:3000/api';
```

For production, update to your deployed backend URL.


## Verification and rollout

Use Node.js 20+ and install MongoDB (`mongod`) on the test machine, then run:

```bash
npm test
```

Tests launch a temporary replica set on a random loopback port, create their own
accounts and upload directory, exercise all 80 declared API endpoints, and remove
the temporary database afterward. They never load `backend/.env`, connect to the
configured database, or upload to Cloudinary. Set `MONGOD_BINARY` if `mongod` is
not on PATH. See [API_AUDIT.md](./API_AUDIT.md) for results and limitations.

Restart the backend after updating. Existing sessions must sign in again because
access and refresh tokens now carry distinct token types. Configure `JWT_SECRET`;
there is no built-in secret fallback. `JWT_REFRESH_SECRET` is optional but should
be a separate random secret. Expiry timestamps follow the actual JWT expiry.

The server starts only after MongoDB connects and confirms transaction support.
`GET /api/health` returns 503 when its database connection is unavailable.
`CORS_ORIGINS` accepts comma-separated browser origins; native Android clients do
not require CORS. Do not include a trailing slash in a browser origin.

`npm run seed` adds missing sample tasks without deleting existing tasks.
`npm run create-admin` requires `ADMIN_PASSWORD` (at least 12 characters).
Only `.env` is loaded by the backend; a file named `Earn-Task-Platform.env` is not
loaded automatically. Keep backend credentials out of the mobile app environment.

## Production readiness

See [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) for verified results, current deployment blockers, configuration, tests, reconciliation safeguards and rollback steps.
