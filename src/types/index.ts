// User Types
export interface User {
    id: string;
    email: string;
    name: string;
    username: string;
    instagramId?: string;
    coins: number;
    totalEarned: number;
    totalWithdrawn: number;
    referralCode: string;
    referredBy?: string;
    createdAt: string;
    updatedAt: string;
    role?: 'user' | 'admin';
    isActive?: boolean;
    followersCount?: number;
    followingCount?: number;
}

export interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
}

// Task Types
export interface Task {
    id: string;
    type: string;
    title: string;
    description: string;
    coins: number;
    videoUrl?: string;
    videoDuration?: number;
    instagramUrl?: string;
    youtubeUrl?: string;
    thumbnail?: string;
    isCompleted: boolean;
    completedAt?: string;
    createdAt: string;
}

export interface TaskState {
    tasks: Task[];
    currentTask: Task | null;
    isLoading: boolean;
    error: string | null;
}

// Video Player Types
export interface VideoPlayerState {
    currentVideo: Task | null;
    watchProgress: number;
    watchDuration: number;
    isPlaying: boolean;
    hasCompleted: boolean;
}

// Wallet Types
export interface WalletState {
    balance: number;
    totalEarned: number;
    totalWithdrawn: number;
    transactions: Transaction[];
    isLoading: boolean;
}

export interface Transaction {
    id: string;
    type: 'earned' | 'withdrawn' | 'bonus';
    amount: number;
    description: string;
    createdAt: string;
}

// Withdrawal Types
export interface WithdrawalRequest {
    id: string;
    amount: number;
    status: 'pending' | 'approved' | 'rejected' | 'completed';
    requestedAt: string;
    processedAt?: string;
    paymentMethod: string;
    accountDetails: string;
    rejectionReason?: string;
}

export interface WithdrawalState {
    requests: WithdrawalRequest[];
    isLoading: boolean;
    error: string | null;
}

// Post/Feed Types
export interface Post {
    id: string;
    userId: string;
    userName: string;
    userAvatar?: string;
    type: 'image' | 'video' | 'document' | 'story' | 'reel';
    imageUrl?: string;
    videoUrl?: string;
    documentUrl?: string;
    documentType?: 'pdf' | 'text' | 'doc' | 'docx';
    videoDuration?: number; // in seconds
    thumbnailUrl?: string;
    caption: string;
    likes: number;
    comments: number;
    isLiked: boolean;
    followersCount?: number;
    isFollowing?: boolean;
    createdAt: string;
}

export interface Story {
    id: string;
    userId: string;
    userName: string;
    username: string;
    type: 'image' | 'video';
    mediaUrl: string;
    videoDuration?: number;
    thumbnailUrl?: string;
    views: number;
    hasViewed: boolean;
    createdAt: string;
    expiresAt: string;
}

export interface StoryGroup {
    user: {
        id: string;
        name: string;
        username: string;
    };
    stories: Story[];
}

export interface FeedState {
    posts: Post[];
    isLoading: boolean;
    error: string | null;
    hasMore: boolean;
}

// API Response Types
export interface ApiResponse<T> {
    success: boolean;
    data: T;
    message?: string;
    error?: string;
}

export interface LoginResponse {
    user: User;
    token: string;
}

export interface SignupResponse {
    user: User;
    token: string;
}

// Navigation Types
export type RootStackParamList = {
    Splash: undefined;
    Onboarding: undefined;
    Login: undefined;
    Signup: undefined;
    InstagramId: undefined;
    MainTabs: undefined;
    TaskDetails: { taskId: string };
    VideoPlayer: { task: Task };
    Withdraw: undefined;
    UploadPost: undefined;
    AdminDashboard: undefined;
    AdminPayments: undefined;
    AdminUsers: undefined;
    AdminUserDetails: { userId: string };
    AdminCoinManagement: undefined;
    WithdrawalHistory: undefined;
    EarningHistory: undefined;
    Referrals: undefined;
    Comments: { postId: string };
    EditPost: { postId: string; currentCaption: string };
    UserProfile: { userId: string };
};

export type MainTabParamList = {
    HomeTab: undefined;
    EarnTab: undefined;
    FeedTab: undefined;
    WalletTab: undefined;
    ProfileTab: undefined;
};

