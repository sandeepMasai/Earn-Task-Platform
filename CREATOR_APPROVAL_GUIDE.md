# Creator Request Approval Guide

## How to Check and Approve Creator Requests (Admin)

### Step 1: Login as Admin
1. Open the app
2. Login with your admin credentials
3. You should see the Admin Dashboard

### Step 2: Access Creator Requests
There are **two ways** to access Creator Requests:

#### Method 1: From Admin Dashboard Header
1. On the Admin Dashboard screen
2. Look at the top right corner
3. Click the **⭐ Star icon** (orange/yellow color)
4. This will open the Creator Requests screen

#### Method 2: From Quick Actions (if available)
1. Scroll down on Admin Dashboard
2. Find the "Quick Actions" section
3. Click on "Creator Requests" card

### Step 3: View Creator Requests
Once you're on the Creator Requests screen:

1. **Filter Options** (at the top):
   - **Pending** - Shows only pending requests (default)
   - **All** - Shows all requests (pending, approved, rejected)

2. **Request Card Shows**:
   - User Name
   - Email Address
   - Username (@username)
   - Status Badge (Pending/Approved/Rejected)
   - YouTube URL (if provided)
   - Instagram URL (if provided)
   - Request Date

### Step 4: Approve a Creator Request

1. Find the pending request you want to approve
2. Review the user's information:
   - Check their name, email, username
   - Verify their YouTube URL (if provided)
   - Verify their Instagram URL (if provided)
3. Click the **"Approve"** button (green button)
4. Confirm the approval in the popup
5. The user will now be an approved creator!

**What happens when you approve:**
- User's `creatorStatus` changes to "approved"
- User's `role` changes to "creator"
- User can now access Creator Dashboard
- User can create tasks using their creator wallet

### Step 5: Reject a Creator Request

1. Find the pending request you want to reject
2. Review the user's information
3. Click the **"Reject"** button (red button)
4. Enter a rejection reason in the popup (optional but recommended)
5. Click "Reject" to confirm

**What happens when you reject:**
- User's `creatorStatus` changes to "rejected"
- User's `isCreator` flag is set to false
- User can try registering again later

### Step 6: View All Requests

1. Click the **"All"** filter button at the top
2. You'll see:
   - All pending requests
   - All approved requests
   - All rejected requests

### Important Notes:

✅ **Before Approving:**
- Verify the YouTube/Instagram URLs are valid
- Check if the user has provided at least one URL
- Make sure the user is legitimate

✅ **Rejection Reasons:**
- Always provide a reason when rejecting (helps user improve)
- Common reasons:
  - "Invalid YouTube URL"
  - "Invalid Instagram URL"
  - "Incomplete information"
  - "Does not meet creator requirements"

✅ **After Approval:**
- User can immediately start using creator features
- User needs to request coins to their creator wallet first
- User can then create tasks

## API Endpoints Used:

- `GET /api/admin/creator-requests` - Get all creator requests
- `GET /api/admin/creator-requests?status=pending` - Get pending requests only
- `PUT /api/admin/creator-requests/:id/approve` - Approve a creator
- `PUT /api/admin/creator-requests/:id/reject` - Reject a creator

## Troubleshooting:

**Q: I don't see the Creator Requests option?**
- Make sure you're logged in as admin (role: "admin")
- Check if the star icon is visible in Admin Dashboard header
- Try refreshing the app

**Q: No pending requests showing?**
- Click "All" filter to see if there are any requests
- Check if users have actually submitted creator registration requests
- Verify the backend is running and connected

**Q: Approval not working?**
- Check your internet connection
- Verify backend API is running
- Check console logs for errors

## Example Flow:

1. **User Side:**
   - User opens Profile → "Become a Creator"
   - Enters YouTube URL: `https://youtube.com/@channel`
   - Enters Instagram URL: `https://instagram.com/profile`
   - Submits request
   - Status: **Pending**

2. **Admin Side:**
   - Admin opens Admin Dashboard
   - Clicks ⭐ Star icon
   - Sees pending request with user details
   - Reviews URLs
   - Clicks "Approve"
   - User is now approved!

3. **User Side (After Approval):**
   - User sees "Creator Dashboard" option in profile
   - Can access Creator Dashboard
   - Can request coins
   - Can create tasks

---

**Need Help?** Check the backend logs or contact support.

