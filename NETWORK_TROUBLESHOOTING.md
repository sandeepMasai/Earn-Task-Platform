# Network Error Troubleshooting Guide

## Common Network Errors

### 1. "Network error. Please check your connection."

**Causes:**
- Backend server not running
- Wrong API URL
- Firewall blocking connection
- Device/emulator can't reach backend

**Solutions:**

#### Check Backend is Running
```bash
cd backend
npm run dev
```

You should see:
```
✅ MongoDB connected
🚀 Server running on port 3000
📱 API: http://localhost:3000/api
```

#### Check API URL by Platform

**Android Emulator:**
- Uses: `http://10.0.2.2:3000/api`
- This is automatically set in the code

**iOS Simulator:**
- Uses: `http://localhost:3000/api`
- This is automatically set in the code

**Physical Device:**
- Need to use your computer's IP address
- Find IP: Run `ifconfig` (Mac/Linux) or `ipconfig` (Windows)
- Update in `src/constants/index.ts`:
  ```typescript
  return 'http://YOUR_IP_ADDRESS:3000/api';
  ```

#### Test Backend Connection

```bash
# Test from terminal
curl http://localhost:3000/api/health

# Should return:
# {"status":"ok","message":"Earn Task Platform API is running"}
```

### 2. "Cannot connect to server at http://..."

**Solution:**
1. Verify backend is running on port 3000
2. Check if port 3000 is available:
   ```bash
   lsof -i :3000
   ```
3. For physical devices, ensure phone and computer are on same WiFi
4. Check firewall settings

### 3. CORS Errors

**Solution:**
Backend CORS is already configured. If you see CORS errors:
1. Restart backend server
2. Clear app cache
3. Check backend logs for CORS issues

## Debug Steps

### Step 1: Check Backend
```bash
cd backend
npm run dev
# Should see server running message
```

### Step 2: Test API Directly
```bash
# Test signup
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123",
    "name": "Test User",
    "username": "testuser"
  }'
```

### Step 3: Check Frontend Logs
- Open React Native debugger
- Check console logs for:
  - `🔗 API Base URL: ...`
  - `API POST: ...`
  - `API Error: ...`

### Step 4: Verify Network
- Android Emulator: Check if `10.0.2.2` is accessible
- iOS Simulator: Check if `localhost` is accessible
- Physical Device: Ping your computer's IP from device

## Quick Fixes

### Fix 1: Restart Everything
```bash
# Stop backend
# Stop React Native
# Restart backend
cd backend && npm run dev
# Restart React Native
npm start
```

### Fix 2: Clear Cache
```bash
# React Native
npm start -- --reset-cache

# Backend (if needed)
rm -rf node_modules && npm install
```

### Fix 3: Check MongoDB
```bash
# Make sure MongoDB is running
mongod
# Or
brew services start mongodb-community
```

## Platform-Specific Issues

### Android Emulator
- **Issue**: Can't connect to localhost
- **Fix**: Code automatically uses `10.0.2.2` for Android
- **Verify**: Check logs show `API Base URL (Android): http://10.0.2.2:3000/api`

### iOS Simulator
- **Issue**: Connection refused
- **Fix**: Ensure backend is running on `localhost:3000`
- **Verify**: Check logs show `API Base URL (iOS/Web): http://localhost:3000/api`

### Physical Device
- **Issue**: Network unreachable
- **Fix**: 
  1. Find your computer's IP: `ifconfig | grep "inet "`
  2. Update `src/constants/index.ts`:
     ```typescript
     if (Platform.OS === 'android') {
       return 'http://YOUR_IP:3000/api'; // e.g., http://192.168.1.5:3000/api
     }
     ```
  3. Ensure phone and computer are on same WiFi
  4. Disable firewall or allow port 3000

## Testing Network Connection

### From React Native App
1. Open app
2. Try to login/signup
3. Check console logs:
   - Should see: `🔗 API Base URL: ...`
   - Should see: `API POST: ...`
   - If error: `API Error: ...`

### From Terminal
```bash
# Test backend health
curl http://localhost:3000/api/health

# Test signup endpoint
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123","name":"Test","username":"test"}'
```

## Still Not Working?

1. **Check Backend Logs**: Look for incoming requests
2. **Check Frontend Logs**: Look for API calls and errors
3. **Verify Port**: Make sure nothing else is using port 3000
4. **Check Firewall**: Allow connections on port 3000
5. **Try Different Port**: Change backend port and update frontend

## Success Indicators

✅ Backend shows: `🚀 Server running on port 3000`
✅ Frontend logs show: `🔗 API Base URL: ...`
✅ API calls show in backend logs
✅ No network errors in frontend console

