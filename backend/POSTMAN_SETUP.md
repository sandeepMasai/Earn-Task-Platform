# Postman Collection Setup Guide

## Import Collection

1. Open Postman
2. Click **Import** button (top left)
3. Select the file: `Earn_Task_Platform.postman_collection.json`
4. Collection will be imported with all endpoints

## Environment Variables

The collection uses these variables:

### `base_url`
- **Default**: `http://localhost:3000`
- **Description**: Backend API base URL
- **Update for production**: Change to your production URL

### `auth_token`
- **Default**: Empty
- **Description**: JWT token for authenticated requests
- **How to set**: 
  1. Run "Login" or "Signup" request
  2. Copy the `token` from response
  3. Set it in collection variables or environment

## Quick Start

### 1. Set Base URL
1. Click on collection name
2. Go to **Variables** tab
3. Set `base_url` to `http://localhost:3000` (or your server URL)

### 2. Get Auth Token
1. Run **Signup** or **Login** request
2. Copy the `token` from response:
   ```json
   {
     "success": true,
     "data": {
       "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
     }
   }
   ```
3. Set `auth_token` variable in collection

### 3. Test Endpoints
All authenticated endpoints will now use the token automatically!

## Endpoints Overview

### Authentication
- ✅ **Signup** - Create new user account
- ✅ **Login** - Login with email/password
- ✅ **Get Current User** - Get logged in user info
- ✅ **Update Instagram ID** - Add Instagram username
- ✅ **Logout** - Logout user

### Tasks
- ✅ **Get All Tasks** - List all available tasks
- ✅ **Get Task by ID** - Get single task details
- ✅ **Complete Task** - Mark task as completed
- ✅ **Verify Instagram Follow** - Verify Instagram follow
- ✅ **Verify YouTube Subscribe** - Verify YouTube subscription

### Wallet
- ✅ **Get Balance** - Get user's coin balance
- ✅ **Get Transactions** - Get transaction history
- ✅ **Request Withdrawal** - Request coin withdrawal
- ✅ **Get Withdrawals** - Get withdrawal requests

### Posts
- ✅ **Get Feed** - Get posts feed with pagination
- ✅ **Upload Post** - Upload new post with image
- ✅ **Like Post** - Like a post
- ✅ **Unlike Post** - Unlike a post
- ✅ **Get Post by ID** - Get single post details

### Health Check
- ✅ **Health Check** - Check if API is running

## Testing Workflow

### 1. Create User
```
Signup → Copy token → Set auth_token variable
```

### 2. Test Authenticated Endpoints
```
Get Current User → Get All Tasks → Get Balance
```

### 3. Complete a Task
```
Get All Tasks → Copy task ID → Complete Task
```

### 4. Check Wallet
```
Get Balance → Get Transactions
```

### 5. Upload Post
```
Upload Post (with image file) → Get Feed
```

## Example Requests

### Signup Request
```json
POST /api/auth/signup
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "username": "johndoe"
}
```

### Complete Task Request
```json
POST /api/tasks/:taskId/complete
{
  "watchDuration": 120
}
```

### Withdrawal Request
```json
POST /api/wallet/withdraw
{
  "amount": 1000,
  "paymentMethod": "UPI",
  "accountDetails": "user@upi"
}
```

## Tips

1. **Save Responses**: Right-click response → Save Response
2. **Create Tests**: Add tests in Tests tab to validate responses
3. **Use Environments**: Create different environments (dev, staging, prod)
4. **Collection Runner**: Run entire collection to test all endpoints
5. **Pre-request Scripts**: Auto-set token from login response

## Troubleshooting

### Token Not Working
- Check if token is set in `auth_token` variable
- Verify token hasn't expired (7 days default)
- Re-login to get new token

### Connection Error
- Verify backend is running on port 3000
- Check `base_url` variable is correct
- For Android emulator, use `http://10.0.2.2:3000`

### 401 Unauthorized
- Token might be expired
- Token not set in Authorization header
- User doesn't exist or password wrong

## Next Steps

1. Import collection
2. Set base_url variable
3. Run Signup/Login to get token
4. Set auth_token variable
5. Test all endpoints!

