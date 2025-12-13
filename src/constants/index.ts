// API Configuration
// For Android emulator, use 'http://10.0.2.2:3000/api'
// For iOS simulator, use 'http://localhost:3000/api'
// For physical device, use your computer's IP address (e.g., 'http://192.168.1.5:3000/api')
import { Platform } from 'react-native';

// Get local IP for network access
const getLocalIP = (): string => {
  // For Android emulator, try 10.0.2.2 first (emulator's localhost)
  // If that doesn't work, use actual network IP
  return '192.168.1.5'; // Update this to your computer's IP if different
};

const getBaseURL = (): string => {
  if (__DEV__) {
    // Android emulator: Try 10.0.2.2 first, fallback to network IP
    if (Platform.OS === 'android') {
      // Try network IP first (more reliable)
      const networkIP = getLocalIP();
      const url = `http://${networkIP}:3000/api`;
      console.log('🔗 API Base URL (Android):', url);
      console.log('💡 If this doesn\'t work, try: http://10.0.2.2:3000/api');
      return url;
    }
    // iOS simulator and web can use localhost
    const url = 'http://localhost:3000/api';
    console.log('🔗 API Base URL (iOS/Web):', url);
    return url;
  }
  return 'https://api.earntaskplatform.com/api';
};

export const API_BASE_URL = getBaseURL();

// App Constants
export const APP_NAME = 'Earn Task Platform';

// Coin System Constants
export const COIN_VALUES = {
  WATCH_VIDEO: 10,
  INSTAGRAM_FOLLOW: 50,
  INSTAGRAM_LIKE: 20,
  YOUTUBE_SUBSCRIBE: 100,
  REFERRAL_BONUS: 500,
  POST_UPLOAD: 30,
  DAILY_LOGIN: 25,
} as const;

export const MIN_WITHDRAWAL_AMOUNT = 1000;
export const COIN_TO_RUPEE_RATE = 100; // 100 coins = 1 rupee

// Support Channels
export const SUPPORT_CHANNELS = {
  TELEGRAM: 'https://t.me/EranMoneyIndia123', // Update with your Telegram channel/group link
  WHATSAPP: 'https://wa.me/9772512267', // Update with your WhatsApp number (format: country code + number, no + or spaces)
} as const;

// Task Types
export const TASK_TYPES = {
  WATCH_VIDEO: 'watch_video',
  INSTAGRAM_FOLLOW: 'instagram_follow',
  INSTAGRAM_LIKE: 'instagram_like',
  YOUTUBE_SUBSCRIBE: 'youtube_subscribe',
  UPLOAD_POST: 'upload_post',
} as const;

// Video Watch Requirements
export const VIDEO_WATCH_DURATION = 30; // seconds
export const VIDEO_WATCH_PERCENTAGE = 80; // 80% of video must be watched

// Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: '@auth_token',
  USER_DATA: '@user_data',
  ONBOARDING_COMPLETE: '@onboarding_complete',
  INSTAGRAM_ID: '@instagram_id',
} as const;

// Navigation Routes
export const ROUTES = {
  // Auth
  SPLASH: 'Splash',
  ONBOARDING: 'Onboarding',
  LOGIN: 'Login',
  SIGNUP: 'Signup',
  INSTAGRAM_ID: 'InstagramId',

  // Main
  HOME: 'Home',
  EARN: 'Earn',
  TASK_DETAILS: 'TaskDetails',
  VIDEO_PLAYER: 'VideoPlayer',
  WALLET: 'Wallet',
  WITHDRAW: 'Withdraw',
  UPLOAD_POST: 'UploadPost',
  FEED: 'Feed',
  PROFILE: 'Profile',

  // Tabs
  HOME_TAB: 'HomeTab',
  EARN_TAB: 'EarnTab',
  FEED_TAB: 'FeedTab',
  WALLET_TAB: 'WalletTab',
  PROFILE_TAB: 'ProfileTab',

  // Admin
  ADMIN_DASHBOARD: 'AdminDashboard',
  ADMIN_PAYMENTS: 'AdminPayments',
  ADMIN_USERS: 'AdminUsers',
  ADMIN_USER_DETAILS: 'AdminUserDetails',
  ADMIN_COIN_MANAGEMENT: 'AdminCoinManagement',
  ADMIN_WITHDRAWAL_MANAGEMENT: 'AdminWithdrawalManagement',
  ADMIN_TASKS: 'AdminTasks',
  ADMIN_CREATE_TASK: 'AdminCreateTask',
  ADMIN_EDIT_TASK: 'AdminEditTask',
  ADMIN_TASK_DETAILS: 'AdminTaskDetails',
  ADMIN_TASK_SUBMISSIONS: 'AdminTaskSubmissions',
  ADMIN_TASK_SUBMISSION_DETAILS: 'AdminTaskSubmissionDetails',
  ADMIN_CREATOR_REQUESTS: 'AdminCreatorRequests',
  ADMIN_CREATOR_COIN_REQUESTS: 'AdminCreatorCoinRequests',

  // Creator
  CREATOR_REGISTER: 'CreatorRegister',
  CREATOR_DASHBOARD: 'CreatorDashboard',
  CREATOR_REQUEST_COINS: 'CreatorRequestCoins',
  CREATOR_COIN_REQUESTS: 'CreatorCoinRequests',
  CREATOR_CREATE_TASK: 'CreatorCreateTask',
  CREATOR_EDIT_TASK: 'CreatorEditTask',
  CREATOR_REQUEST_HISTORY: 'CreatorRequestHistory',
  CREATOR_TASK_SUBMISSIONS: 'CreatorTaskSubmissions',
  CREATOR_TASK_SUBMISSION_DETAILS: 'CreatorTaskSubmissionDetails',

  // Profile
  WITHDRAWAL_HISTORY: 'WithdrawalHistory',
  EARNING_HISTORY: 'EarningHistory',
  REFERRALS: 'Referrals',
  EDIT_PROFILE: 'EditProfile',
  SETTINGS: 'Settings',
  PRIVACY_POLICY: 'PrivacyPolicy',
  TERMS_AND_CONDITIONS: 'TermsAndConditions',
  REFUND_POLICY: 'RefundPolicy',
  COMMUNITY_GUIDELINES: 'CommunityGuidelines',
  ABOUT_APP: 'AboutApp',

  // Feed
  COMMENTS: 'Comments',
  EDIT_POST: 'EditPost',

  // User Profile
  USER_PROFILE: 'UserProfile',
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  INVALID_CREDENTIALS: 'Invalid email or password.',
  USER_EXISTS: 'User already exists with this email.',
  TASK_ALREADY_COMPLETED: 'You have already completed this task.',
  INSUFFICIENT_COINS: 'Insufficient coins for withdrawal.',
  MIN_WITHDRAWAL_NOT_MET: `Minimum withdrawal amount is ${MIN_WITHDRAWAL_AMOUNT} coins.`,
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Login successful!',
  SIGNUP_SUCCESS: 'Account created successfully!',
  TASK_COMPLETED: 'Task completed! Coins added to your wallet.',
  WITHDRAWAL_REQUESTED: 'Withdrawal request submitted successfully!',
  POST_UPLOADED: 'Post uploaded successfully!',
} as const;

