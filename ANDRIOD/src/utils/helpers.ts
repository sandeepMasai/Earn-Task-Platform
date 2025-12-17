import { Platform } from 'react-native';

export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';

export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

export const generateReferralCode = (userId: string): string => {
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${userId.substring(0, 3)}${random}`;
};

export const validateTaskCompletion = (
  watchDuration: number,
  videoDuration: number,
  requiredPercentage: number = 80
): boolean => {
  const percentageWatched = (watchDuration / videoDuration) * 100;
  return percentageWatched >= requiredPercentage;
};

export const calculateCoinsEarned = (
  baseCoins: number,
  multiplier: number = 1
): number => {
  return Math.floor(baseCoins * multiplier);
};

export const isTaskExpired = (taskCreatedAt: string, expiryHours: number = 24): boolean => {
  const createdAt = new Date(taskCreatedAt);
  const now = new Date();
  const diffInHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
  return diffInHours > expiryHours;
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export const extractInstagramUsername = (url: string): string | null => {
  const match = url.match(/instagram\.com\/([a-zA-Z0-9._]+)/);
  return match ? match[1] : null;
};

export const extractYouTubeChannelId = (url: string): string | null => {
  const patterns = [
    /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/c\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/user\/([a-zA-Z0-9_-]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
};

