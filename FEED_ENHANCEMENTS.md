# Feed Enhancements - Video, Documents, Stories & Sharing

## Overview
Added comprehensive media support to the feed including video posts, document uploads, story/reel functionality, and social sharing capabilities.

## New Features

### 1. **Video Posts (2 Minutes Max)**
- Upload videos from gallery or record with camera
- Maximum duration: 2 minutes (120 seconds)
- Automatic duration validation
- Video player with native controls
- Duration badge display
- Thumbnail support

### 2. **Document Posts**
- Support for PDF, Text, Word documents
- Document picker integration
- Tap to open/view documents
- Document type indicator

### 3. **Story/Reel Functionality**
- Instagram-style stories
- 24-hour expiration
- View tracking
- Support for image and video stories
- Grouped by user

### 4. **Share Functionality**
- Share posts to Instagram, WhatsApp, etc.
- Native sharing integration
- Share images, videos, and documents
- Share with caption

## Backend Changes

### Models

#### Post Model (`backend/src/models/Post.js`)
- Added `type` field: `'image' | 'video' | 'document' | 'story' | 'reel'`
- Added `videoUrl` field
- Added `documentUrl` field
- Added `documentType` field: `'pdf' | 'text' | 'doc' | 'docx'`
- Added `videoDuration` field (in seconds)
- Added `thumbnailUrl` field
- Made `imageUrl` optional

#### Story Model (`backend/src/models/Story.js`) - NEW
- User reference
- Type: `'image' | 'video'`
- Media URL
- Video duration
- Thumbnail URL
- Views array (tracks who viewed)
- Expires after 24 hours
- Auto-cleanup via MongoDB TTL index

### Controllers

#### Post Controller (`backend/src/controllers/postController.js`)
- Updated `uploadPost` to handle multiple media types
- Video duration validation (max 2 minutes)
- Document type detection
- Updated `getFeed` to return all media types
- Updated `getPostById` to return all media types

#### Story Controller (`backend/src/controllers/storyController.js`) - NEW
- `getStories`: Get active stories grouped by user
- `uploadStory`: Upload new story
- `viewStory`: Track story views

### Routes

#### Post Routes (`backend/src/routes/postRoutes.js`)
- No changes (existing routes work with new media types)

#### Story Routes (`backend/src/routes/storyRoutes.js`) - NEW
- `GET /api/stories` - Get all active stories
- `POST /api/stories` - Upload story
- `POST /api/stories/:id/view` - Mark story as viewed

### Middleware

#### Upload Middleware (`backend/src/middleware/upload.js`)
- Updated to accept videos, PDFs, and documents
- Increased file size limit to 50MB (for videos)
- Added MIME type validation for:
  - Images: `image/*`
  - Videos: `video/*`
  - PDFs: `application/pdf`
  - Text: `text/plain`
  - Word: `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

## Frontend Changes

### Types (`src/types/index.ts`)
- Updated `Post` interface:
  - Added `type` field
  - Made `imageUrl` optional
  - Added `videoUrl`, `documentUrl`, `documentType`, `videoDuration`, `thumbnailUrl`
- Added `Story` interface
- Added `StoryGroup` interface

### Services

#### Post Service (`src/services/postService.ts`)
- Updated `uploadPost` to accept `type` and `videoDuration`
- Updated `getFeed` to transform all media URLs
- Added URL transformation for videos and documents

#### Story Service (`src/services/storyService.ts`) - NEW
- `getStories`: Fetch all active stories
- `uploadStory`: Upload new story
- `viewStory`: Mark story as viewed
- Media URL transformation

### Screens

#### Upload Post Screen (`src/screens/feed/UploadPostScreen.tsx`)
- Complete redesign with media type selector
- Image upload (gallery/camera)
- Video upload (gallery/camera) with duration validation
- Document picker integration
- Video preview with duration badge
- Document preview
- Type-specific UI

#### Comments Screen (`src/screens/feed/CommentsScreen.tsx`)
- Already exists, works with all post types

### Components

#### Post Card (`src/components/feed/PostCard.tsx`)
- Updated to display videos, images, and documents
- Video player with native controls
- Document viewer with tap to open
- Share button in header and actions
- Duration badge for videos
- Document type indicator

### Redux

#### Feed Slice (`src/store/slices/feedSlice.ts`)
- Updated `uploadPost` thunk to accept new parameters:
  - `fileUri` (instead of `imageUri`)
  - `type`: `'image' | 'video' | 'document'`
  - `videoDuration`: number (optional)

## Dependencies Added

```json
{
  "expo-document-picker": "^latest",
  "expo-sharing": "^latest"
}
```

## Video Duration Validation

### Backend
- Validates video duration on upload
- Maximum: 120 seconds (2 minutes)
- Returns error if exceeded

### Frontend
- `ImagePicker` configured with `videoMaxDuration: 120`
- Duration check before upload
- User-friendly error messages
- Duration display in UI

## Share Functionality

### Implementation
- Uses `expo-sharing` for native sharing
- Falls back to React Native `Share` API
- Supports sharing:
  - Images (JPEG)
  - Videos (MP4)
  - Documents (PDF)
- Includes post caption in share message

### Share Options
- Instagram
- WhatsApp
- Other installed apps
- Native share sheet

## Story/Reel Features

### Story Lifecycle
1. User uploads story (image/video)
2. Story expires after 24 hours
3. MongoDB TTL index auto-deletes expired stories
4. Views tracked per user

### Story Display
- Grouped by user
- Shows view count
- Indicates if current user has viewed
- Expiration time display

## Usage Examples

### Upload Video Post
```typescript
dispatch(uploadPost({
  fileUri: videoUri,
  caption: 'My video post',
  type: 'video',
  videoDuration: 45 // seconds
}));
```

### Upload Document Post
```typescript
dispatch(uploadPost({
  fileUri: documentUri,
  caption: 'Check out this document',
  type: 'document'
}));
```

### Share Post
```typescript
// Automatically handled in PostCard
// Uses expo-sharing or React Native Share
```

## Testing Checklist

- [ ] Upload image post
- [ ] Upload video post (under 2 minutes)
- [ ] Upload video post (over 2 minutes) - should fail
- [ ] Upload PDF document
- [ ] Upload text document
- [ ] Upload Word document
- [ ] View video in feed
- [ ] View document in feed
- [ ] Share image post
- [ ] Share video post
- [ ] Share document post
- [ ] Upload story
- [ ] View stories
- [ ] Story expiration (24 hours)

## Notes

- Video trimming: Users must trim videos before upload (2 min max)
- Document viewing: Opens in external app/browser
- Story expiration: Automatic cleanup via MongoDB TTL
- Share compatibility: Works on iOS and Android
- File size limits: 50MB for videos, 5MB for images/documents

## Future Enhancements

- In-app video trimming
- In-app document viewer
- Story highlights
- Reel-specific features
- Advanced sharing options
- Video compression
- Thumbnail generation

