import { configureStore } from '@reduxjs/toolkit';
import authReducer, { clearAuth, accessRefreshed } from './slices/authSlice';
import { apiService } from '../services/api';
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

apiService.auth.onLogout = () => { store.dispatch(clearAuth()); };
apiService.auth.onRefresh = data => { store.dispatch(accessRefreshed(data)); };

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

