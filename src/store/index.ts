import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import taskReducer from './slices/taskSlice';
import walletReducer from './slices/walletSlice';
import feedReducer from './slices/feedSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    tasks: taskReducer,
    wallet: walletReducer,
    feed: feedReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

