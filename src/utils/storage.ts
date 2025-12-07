import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@constants';

export const storage = {
  async setItem(key: string, value: any): Promise<void> {
    try {
      const jsonValue = JSON.stringify(value);
      await AsyncStorage.setItem(key, jsonValue);
    } catch (error) {
      console.error('Error saving to storage:', error);
      throw error;
    }
  },

  async getItem<T>(key: string): Promise<T | null> {
    try {
      const jsonValue = await AsyncStorage.getItem(key);
      return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (error) {
      console.error('Error reading from storage:', error);
      return null;
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing from storage:', error);
      throw error;
    }
  },

  async clear(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.error('Error clearing storage:', error);
      throw error;
    }
  },
};

// Specific storage helpers
export const authStorage = {
  async saveToken(token: string): Promise<void> {
    await storage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
  },

  async getToken(): Promise<string | null> {
    return await storage.getItem<string>(STORAGE_KEYS.AUTH_TOKEN);
  },

  async removeToken(): Promise<void> {
    await storage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  },

  async saveUser(user: any): Promise<void> {
    await storage.setItem(STORAGE_KEYS.USER_DATA, user);
  },

  async getUser(): Promise<any> {
    return await storage.getItem(STORAGE_KEYS.USER_DATA);
  },

  async removeUser(): Promise<void> {
    await storage.removeItem(STORAGE_KEYS.USER_DATA);
  },

  async clearAuth(): Promise<void> {
    await Promise.all([
      this.removeToken(),
      this.removeUser(),
    ]);
  },
};

export const onboardingStorage = {
  async setComplete(): Promise<void> {
    await storage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, true);
  },

  async isComplete(): Promise<boolean> {
    const value = await storage.getItem<boolean>(STORAGE_KEYS.ONBOARDING_COMPLETE);
    return value === true;
  },
};

