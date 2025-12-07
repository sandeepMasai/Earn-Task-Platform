# Frontend-Backend Connection Guide

## Quick Start

### 1. Start MongoDB
```bash
# Make sure MongoDB is running
mongod
# Or if using MongoDB service
brew services start mongodb-community
```

### 2. Start Backend Server
```bash
cd backend
npm install
npm run dev
```

The backend will run on `http://localhost:3000`

### 3. Start Frontend App
```bash
# In the root directory
npm start
# Then press 'a' for Android or 'i' for iOS
```

## Configuration

### Backend (.env)
The backend `.env` file is already created with default values:
- Port: 3000
- MongoDB: `mongodb://localhost:27017/earn-task-platform`
- JWT Secret: Set your own secret in production

### Frontend API URL
The frontend is configured to use:
- Development: `http://localhost:3000/api`
- Production: Update in `src/constants/index.ts`

## Testing the Connection

### 1. Health Check
```bash
curl http://localhost:3000/api/health
```

Should return:
```json
{
  "status": "ok",
  "message": "Earn Task Platform API is running"
}
```

### 2. Test from React Native
The app will automatically connect when you:
1. Start the backend server
2. Start the React Native app
3. Try to login or signup

## Common Issues

### 1. Network Error
**Problem**: "Network error. Please check your connection."

**Solution**: 
- Make sure backend is running on port 3000
- For Android emulator, use `10.0.2.2` instead of `localhost`
- For iOS simulator, `localhost` works fine
- For physical device, use your computer's IP address

### 2. CORS Error
**Solution**: Backend CORS is already configured to allow all origins

### 3. MongoDB Connection Error
**Problem**: "MongoDB connection error"

**Solution**:
- Make sure MongoDB is installed and running
- Check MongoDB URI in `.env` file
- Try: `mongosh` to test MongoDB connection

### 4. Port Already in Use
**Problem**: "Port 3000 already in use"

**Solution**:
- Change PORT in backend `.env` file
- Update API_BASE_URL in frontend constants

## API Endpoints

All endpoints are prefixed with `/api`:

- **Auth**: `/api/auth/*`
- **Tasks**: `/api/tasks/*`
- **Wallet**: `/api/wallet/*`
- **Posts**: `/api/posts/*`

## Seeding Initial Data

To add sample tasks:
```bash
cd backend
npm run seed
```

This will create 5 sample tasks in the database.

## Next Steps

1. ✅ Backend server running
2. ✅ Frontend app running
3. ✅ Test login/signup
4. ✅ Test task completion
5. ✅ Test wallet features

## Production Deployment

For production:
1. Update `API_BASE_URL` in frontend to your production backend URL
2. Set proper `JWT_SECRET` in backend `.env`
3. Configure MongoDB Atlas or production database
4. Set up file upload storage (S3, Cloudinary, etc.)
5. Enable HTTPS

