# Admin Dashboard Setup Guide

## Backend Setup

### 1. Create Admin User

Run the following command to create an admin user:

```bash
cd backend
npm run create-admin
```

This will create an admin user with:
- **Email**: `admin@earntask.com` (or set `ADMIN_EMAIL` in `.env`)
- **Password**: `admin123` (or set `ADMIN_PASSWORD` in `.env`)
- **Role**: `admin`

### 2. Update Existing User to Admin

To make an existing user an admin, update the user in MongoDB:

```javascript
db.users.updateOne(
  { email: "user@example.com" },
  { $set: { role: "admin" } }
)
```

Or use the create-admin script which will update if user exists.

## Admin Features

### Dashboard (`/api/admin/dashboard`)
- View platform statistics (users, withdrawals, transactions, tasks, posts)
- See recent withdrawals and users
- Total withdrawal amounts

### Payment Management (`/api/admin/payments`)
- View all payment requests
- Filter by status (pending, approved, rejected, completed)
- Update payment status
- Add rejection reasons
- Download payments as CSV

**Status Flow:**
- `pending` → `approved` → `completed` (manual)
- `pending` → `rejected` (with optional reason)

### User Management (`/api/admin/users`)
- View all users
- Search users by name, email, or username
- Filter by active/blocked status
- View user details
- Block/unblock users

### User Details (`/api/admin/users/:id`)
- View complete user profile
- See all withdrawal requests
- View transaction history
- Block/unblock user

## Frontend Access

1. **Login as Admin**: Use the admin credentials to login
2. **Access Admin Panel**: Go to Profile → Admin Dashboard
3. **Navigate**:
   - Dashboard: Overview of platform
   - Payments: Manage withdrawal requests
   - Users: Manage user accounts

## API Endpoints

### Dashboard
- `GET /api/admin/dashboard` - Get dashboard statistics

### Payments
- `GET /api/admin/payments` - Get all payments (with filters)
- `PUT /api/admin/payments/:id/status` - Update payment status
- `GET /api/admin/payments/download` - Download payments as CSV

### Users
- `GET /api/admin/users` - Get all users (with filters)
- `GET /api/admin/users/:id` - Get user details
- `PUT /api/admin/users/:id/block` - Block/unblock user

## Payment Status Management

### Status Options:
1. **Pending**: Initial status when user requests withdrawal
2. **Approved**: Admin approves the request (coins deducted from user)
3. **Rejected**: Admin rejects the request (coins refunded if was approved)
4. **Completed**: Manual status for completed payments

### Status Transitions:
- `pending` → `approved`: Coins deducted from user
- `approved` → `rejected`: Coins refunded to user
- `approved` → `completed`: Manual completion (no coin change)

## Security

- All admin routes are protected by `admin` middleware
- Only users with `role: 'admin'` can access admin endpoints
- Admin middleware checks authentication first, then role

## Testing

1. Create admin user: `npm run create-admin`
2. Login with admin credentials
3. Navigate to Profile → Admin Dashboard
4. Test payment approval/rejection
5. Test user blocking/unblocking

## Notes

- Admin users can still use the app normally
- Admin role is checked on each admin API call
- Payment status changes affect user coin balance
- CSV download requires proper file handling (expo-file-system recommended)

