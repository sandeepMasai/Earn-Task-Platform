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

- Node.js (v16 or higher)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
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

Update the API base URL in `src/constants/index.ts`:

```typescript
export const API_BASE_URL = __DEV__ 
  ? 'http://localhost:3000/api' 
  : 'https://api.earntaskplatform.com/api';
```

### Environment Variables

Create a `.env` file (optional) for environment-specific configurations.

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
