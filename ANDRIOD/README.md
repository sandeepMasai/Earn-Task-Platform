# Earn Task Platform - React Native App

A complete React Native application for earning rewards by completing tasks like watching videos, following Instagram accounts, subscribing to YouTube channels, and uploading posts.

## Quick Start

### Development
```bash
# Install dependencies
npm install

# Start development server
npm start

# Run on specific platform
npm run ios      # iOS Simulator
npm run android  # Android Emulator
npm run web      # Web Browser
```

These commands use Expo Go explicitly. For Android, start an emulator or connect
a phone with USB debugging enabled. This project uses Expo SDK 54, so use a
compatible Expo Go version from [expo.dev/go](https://expo.dev/go).

### Android development build

To test native configuration or features that require your own app binary, install
Android Studio, the Android SDK, and JDK 17, then run:

```bash
# Build and install the development app, then start Metro
npm run android:build

# On later runs, launch the installed development app
npm run android:dev
```

Rebuild after adding native dependencies or changing native app configuration.

### Building for Production
See [BUILD_GUIDE.md](./BUILD_GUIDE.md) for detailed build instructions.

**Quick Build Commands:**
```bash
# Install EAS CLI (if not installed)
npm install -g eas-cli

# Login to Expo
eas login

# Build for production
eas build --platform all --profile production
```

## Features

- **Authentication Flow**: Splash screen, onboarding, login, signup, and Instagram ID setup
- **Task Management**: View and complete various tasks to earn coins
- **Video Player**: Watch videos with progress tracking and completion verification
- **Wallet System**: Track earnings, view transactions, and request withdrawals
- **Social Feed**: Upload posts, view feed, like and interact with posts
- **Profile Management**: View profile, referral codes, and account settings

## Project Structure

```
Earn-Task-Platform/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── common/          # Button, Input, LoadingSpinner
│   │   ├── tasks/           # TaskCard
│   │   └── feed/            # PostCard
│   ├── screens/             # Screen components
│   │   ├── auth/            # Authentication screens
│   │   ├── home/            # Home screen
│   │   ├── earn/            # Earn/Tasks screen
│   │   ├── tasks/           # Task details and video player
│   │   ├── wallet/          # Wallet and withdrawal screens
│   │   ├── feed/            # Feed and upload post screens
│   │   └── profile/         # Profile screen
│   ├── navigation/          # Navigation setup
│   │   ├── AppNavigator.tsx
│   │   └── MainTabsNavigator.tsx
│   ├── store/               # Redux store and slices
│   │   ├── slices/          # Auth, Tasks, Wallet, Feed slices
│   │   ├── index.ts
│   │   └── hooks.ts
│   ├── services/            # API services
│   │   ├── api.ts
│   │   ├── authService.ts
│   │   ├── taskService.ts
│   │   ├── walletService.ts
│   │   └── postService.ts
│   ├── utils/               # Utility functions
│   │   ├── storage.ts
│   │   ├── validation.ts
│   │   └── helpers.ts
│   ├── constants/           # App constants
│   │   └── index.ts
│   └── types/               # TypeScript types
│       └── index.ts
├── assets/                  # Images and assets
├── App.tsx                  # Root component
├── package.json
├── app.json                 # Expo configuration
└── tsconfig.json            # TypeScript configuration
```

## Getting Started

### Prerequisites

- Node.js 20.19.4 or higher
- npm or yarn
- Expo CLI (included with the project; use `npx expo`)
- iOS Simulator (for Mac) or Android Emulator

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Run on your preferred platform:
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Scan QR code with Expo Go app on your phone

## Configuration

### API Configuration

The app defaults to `https://earn-task-platform.onrender.com/api`. To use the
local backend over Android USB, create `ANDRIOD/.env.local`:

```dotenv
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3000/api
```

Keep the backend running (`npm run dev` from `backend`), then run:

```bash
adb reverse tcp:3000 tcp:3000
adb reverse tcp:8081 tcp:8081
npm run android:offline
```

Restart Metro after creating the environment file and fully reload the app.
Repeat the forwarding commands after reconnecting the phone. USB forwarding
connects only the specified ports; it does not give the phone internet access.
To use the hosted backend again, remove the override and enable Wi-Fi or mobile
data on the phone. For production builds, use the hosted API URL.

### Environment Variables

The mobile app reads `EXPO_PUBLIC_API_BASE_URL` from its own environment files;
`backend/.env` configures only the backend. The API URL may include `/api` or
omit it. Only put public configuration in `EXPO_PUBLIC_` variables.

## Key Features Implementation

### Authentication
- Splash screen with app initialization
- Onboarding flow for new users
- Login/Signup with email and password
- Instagram ID addition for task completion
- Persistent authentication with AsyncStorage

### Task System
- View available tasks
- Task details screen
- Video player with progress tracking
- Instagram follow/like tasks
- YouTube subscribe tasks
- Task completion verification

### Wallet System
- Real-time balance tracking
- Transaction history
- Withdrawal requests
- Coin to rupee conversion (100 coins = ₹1)
- Minimum withdrawal amount validation

### Social Feed
- Post upload with image picker
- Feed with infinite scroll
- Like/unlike functionality
- Post interactions

### State Management
- Redux Toolkit for global state
- Async thunks for API calls
- Persistent storage for auth state

## Coin System

- **Watch Video**: 10 coins
- **Instagram Follow**: 50 coins
- **Instagram Like**: 20 coins
- **YouTube Subscribe**: 100 coins
- **Referral Bonus**: 500 coins
- **Post Upload**: 30 coins
- **Daily Login**: 25 coins

**Conversion Rate**: 100 coins = ₹1

**Minimum Withdrawal**: 1000 coins

## Navigation Structure

- **Auth Stack**: Splash → Onboarding → Login/Signup → Instagram ID
- **Main Tabs**: Home, Earn, Feed, Wallet, Profile
- **Stack Screens**: Task Details, Video Player, Withdraw, Upload Post

## API Endpoints (Expected)

### Authentication
- `POST /api/auth/login`
- `POST /api/auth/signup`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `PUT /api/auth/instagram-id`

### Tasks
- `GET /api/tasks`
- `GET /api/tasks/:id`
- `POST /api/tasks/:id/complete`
- `POST /api/tasks/verify/instagram-follow`
- `POST /api/tasks/verify/youtube-subscribe`

### Wallet
- `GET /api/wallet/balance`
- `GET /api/wallet/transactions`
- `POST /api/wallet/withdraw`
- `GET /api/wallet/withdrawals`

### Posts
- `GET /api/posts/feed`
- `POST /api/posts`
- `POST /api/posts/:id/like`
- `POST /api/posts/:id/unlike`

## Development

### Adding New Screens

1. Create screen component in `src/screens/`
2. Add route to navigation in `src/navigation/`
3. Update types in `src/types/index.ts`

### Adding New API Endpoints

1. Add service function in `src/services/`
2. Create/update Redux slice if needed
3. Use in components via `useAppDispatch` hook

## Troubleshooting

### Common Issues

**Network connection is unreliable / Networking has been disabled**: Expo could
not reach its online services. If Expo Go was uninstalled during the attempt,
first install the [SDK 54 Android version](https://expo.dev/go?sdkVersion=54&platform=android&device=true)
on your phone. Offline mode cannot download a missing Expo Go app.
Then connect the phone over USB with USB debugging enabled and run:

```bash
adb reverse tcp:8081 tcp:8081
npm run android:offline
```

This skips Expo's online checks and connects to Metro over USB. Backend API
connectivity is separate; the app still needs access to its configured API.

**No development build (com.earntaskplatform.app) is installed**: Expo selects a
development build automatically when `expo-dev-client` is installed. Stop the
existing Metro server with `Ctrl+C` and run `npm run android` to use Expo Go.
If you want the development client instead, run `npm run android:build` once
before using `npm run android:dev`. A production or preview APK does not replace
a development build.

1. **Metro bundler errors**: Clear cache with `expo start -c`
2. **Module resolution errors**: Check `babel.config.js` path aliases
3. **Type errors**: Run `npx tsc --noEmit` to check TypeScript errors

## Next Steps

1. Connect to backend API
2. Add image assets to `assets/` folder
3. Implement deep linking
4. Add push notifications
5. Add analytics
6. Implement admin panel features

## License

Private - All rights reserved

### Client regression checks

Run `npm run typecheck` and `npm test` from `ANDRIOD`. Tests use Node's built-in
runner and the installed TypeScript compiler, with mocked transport/storage and
no device, backend, or cloud connections. No native build is performed.

Watch progress comes from the backend's confirmed session state. On a timeout or
sequence conflict, the player reads the existing session, pauses, and returns to
its confirmed position; resume playback there. Failed recovery stops rather than
retrying indefinitely. Expired/replaced sessions require reopening the video.
Final updates respect the backend's minimum interval. Client-reported playback
is not independent evidence that a person actually watched the video.

Concurrent unauthorized requests share a refresh. Failed refresh or logout clears
stored authentication and Redux login state; an in-flight refresh cannot restore
a logged-out session. Rewards use the completion API's returned amount exactly
once; that endpoint does not currently return an authoritative total balance.
