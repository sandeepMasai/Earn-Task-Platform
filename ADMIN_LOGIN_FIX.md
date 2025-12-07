# Admin Login Fix

## Issue
Admin users were not seeing the Admin Dashboard option in the Profile screen after login.

## Root Cause
The `role` and `isActive` fields were not being returned in the authentication responses (login, signup, getMe, updateInstagramId).

## Fix Applied
Updated all authentication endpoints to include `role` and `isActive` fields in user responses:

1. **Login endpoint** (`/api/auth/login`)
2. **Signup endpoint** (`/api/auth/signup`)
3. **Get current user** (`/api/auth/me`)
4. **Update Instagram ID** (`/api/auth/instagram-id`)

All endpoints now return:
```json
{
  "user": {
    ...
    "role": "admin" | "user",
    "isActive": true | false
  }
}
```

## How to Test

1. **Create admin user** (if not already created):
   ```bash
   cd backend
   npm run create-admin
   ```

2. **Login as admin**:
   - Email: `admin@earntask.com` (or your ADMIN_EMAIL)
   - Password: `admin123` (or your ADMIN_PASSWORD)

3. **Check Profile screen**:
   - Navigate to Profile tab
   - You should see "Admin Dashboard" menu item
   - Tap it to access admin panel

4. **Verify role in app**:
   - The ProfileScreen checks `user?.role === 'admin'` to show admin menu
   - If role is not showing, try:
     - Logout and login again
     - Pull to refresh on Profile screen
     - Check backend logs to verify role is being returned

## Backend Logs
Check backend logs to see if role is being returned:
```bash
tail -f /tmp/backend.log
```

When you login, you should see the user object with role field in the response.

## Frontend Check
The ProfileScreen checks:
```typescript
user?.role === 'admin'
```

Make sure the user object in Redux state includes the role field after login.

