# Feed & Post Fixes

## Issues Fixed

### 1. **Images Not Showing in Feed**
**Problem**: Posted images were not displaying in the feed.

**Root Cause**: 
- Backend returns image URL as `/uploads/filename`
- Frontend needs full URL like `http://192.168.1.5:3000/uploads/filename`

**Fix**:
- Added `getImageUrl()` helper function in `postService.ts`
- Transforms relative URLs to absolute URLs
- Applied to all post responses (getFeed, uploadPost, getPostById)
- Added error handling in PostCard for failed image loads
- Added placeholder for missing images

### 2. **Comment Functionality Missing**
**Problem**: No way to add or view comments on posts.

**Fix**:
- Added `addComment` and `getComments` endpoints in backend
- Created `CommentsScreen.tsx` for viewing and adding comments
- Added comment service methods in `postService.ts`
- Updated PostCard to navigate to comments screen
- Added comment count update in feedSlice

### 3. **Feed Not Refreshing After Upload**
**Problem**: After uploading a post, feed didn't show the new post.

**Fix**:
- Added `useFocusEffect` to refresh feed when screen comes into focus
- Added pull-to-refresh functionality
- Fixed feedSlice to handle refresh vs load more correctly
- Clear feed before fetching new data on refresh

## Changes Made

### Backend
1. **postController.js**:
   - Added `addComment` function
   - Added `getComments` function
   - Both populate user data for comments

2. **postRoutes.js**:
   - Added `POST /api/posts/:id/comments` - Add comment
   - Added `GET /api/posts/:id/comments` - Get comments

### Frontend
1. **postService.ts**:
   - Added `getImageUrl()` helper to construct full image URLs
   - Fixed response structure handling
   - Added `addComment()` and `getComments()` methods
   - Transform `_id` to `id` for all responses

2. **PostCard.tsx**:
   - Added image error handling
   - Added placeholder for missing images
   - Fixed image display

3. **FeedScreen.tsx**:
   - Added pull-to-refresh
   - Added `useFocusEffect` to refresh on focus
   - Fixed refresh logic

4. **CommentsScreen.tsx** (NEW):
   - Full comments screen with list and input
   - Real-time comment addition
   - User avatars and timestamps

5. **feedSlice.ts**:
   - Added `addComment` async thunk
   - Fixed feed refresh logic
   - Update comment count when comment added

## Image URL Construction

The `getImageUrl()` function:
- Checks if URL already starts with `http` (already absolute)
- Removes `/api` from `API_BASE_URL` (e.g., `http://192.168.1.5:3000/api` → `http://192.168.1.5:3000`)
- Appends the image path (e.g., `/uploads/image.jpg`)
- Result: `http://192.168.1.5:3000/uploads/image.jpg`

## Testing

1. **Upload Post**:
   - Upload an image with caption
   - Check feed - image should display
   - Pull to refresh - should see new post

2. **View Comments**:
   - Tap comment icon on any post
   - Should see comments screen
   - Add a comment
   - Comment should appear immediately

3. **Image Display**:
   - All posts should show images
   - If image fails to load, placeholder shows
   - Check console for any image errors

## Notes

- Image URLs are now properly constructed for all platforms
- Comments are stored in Post model (embedded documents)
- Feed automatically refreshes when navigating back from upload
- Pull-to-refresh works on feed screen
- Comment count updates in real-time

