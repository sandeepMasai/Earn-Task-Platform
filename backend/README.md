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
MONGODB_URI=mongodb://localhost:27017/earn-task-platform
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRE=7d
```

4. Start MongoDB (if running locally):
```bash
mongod
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

