import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { AuthState, User } from '@types';
import { authService } from '@services/authService';
import { authStorage } from '@utils/storage';

const initialState: AuthState = {
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
};

// Async thunks
export const loginUser = createAsyncThunk(
    'auth/login',
    async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
        try {
            const response = await authService.login(email, password);
            await authStorage.saveToken(response.token);
            await authStorage.saveUser(response.user);
            return response;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

export const signupUser = createAsyncThunk(
    'auth/signup',
    async (
        {
            email,
            password,
            name,
            username,
            referralCode,
        }: {
            email: string;
            password: string;
            name: string;
            username: string;
            referralCode?: string;
        },
        { rejectWithValue }
    ) => {
        try {
            const response = await authService.signup(email, password, name, username, referralCode);
            await authStorage.saveToken(response.token);
            await authStorage.saveUser(response.user);
            return response;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

export const logoutUser = createAsyncThunk('auth/logout', async (_, { rejectWithValue }) => {
    try {
        await authService.logout();
        await authStorage.clearAuth();
    } catch (error: any) {
        await authStorage.clearAuth();
        return rejectWithValue(error.message);
    }
});

export const loadUser = createAsyncThunk('auth/loadUser', async (_, { rejectWithValue }) => {
    try {
        const [token, user] = await Promise.all([authStorage.getToken(), authStorage.getUser()]);
        if (token && user) {
            return { token, user };
        }
        return null;
    } catch (error: any) {
        return rejectWithValue(error.message);
    }
});

export const refreshUser = createAsyncThunk('auth/refreshUser', async (_, { rejectWithValue }) => {
    try {
        const user = await authService.getCurrentUser();
        await authStorage.saveUser(user);
        return { user };
    } catch (error: any) {
        return rejectWithValue(error.message);
    }
});

export const updateInstagramId = createAsyncThunk(
    'auth/updateInstagramId',
    async (instagramId: string, { rejectWithValue }) => {
        try {
            const user = await authService.updateInstagramId(instagramId);
            await authStorage.saveUser(user);
            return user;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        updateUserCoins: (state, action: PayloadAction<number>) => {
            if (state.user) {
                state.user.coins = action.payload;
            }
        },
        setUser: (state, action: PayloadAction<User | null>) => {
            state.user = action.payload;
            state.isAuthenticated = !!action.payload;
        },
        clearAuth: (state) => {
            state.user = null;
            state.token = null;
            state.isAuthenticated = false;
        },
    },
    extraReducers: (builder) => {
        // Login
        builder
            .addCase(loginUser.pending, (state) => {
                state.isLoading = true;
            })
            .addCase(loginUser.fulfilled, (state, action) => {
                state.isLoading = false;
                state.user = action.payload.user;
                state.token = action.payload.token;
                state.isAuthenticated = true;
            })
            .addCase(loginUser.rejected, (state) => {
                state.isLoading = false;
                state.isAuthenticated = false;
            });

        // Signup
        builder
            .addCase(signupUser.pending, (state) => {
                state.isLoading = true;
            })
            .addCase(signupUser.fulfilled, (state, action) => {
                state.isLoading = false;
                state.user = action.payload.user;
                state.token = action.payload.token;
                state.isAuthenticated = true;
            })
            .addCase(signupUser.rejected, (state) => {
                state.isLoading = false;
                state.isAuthenticated = false;
            });

        // Logout
        builder
            .addCase(logoutUser.fulfilled, (state) => {
                state.user = null;
                state.token = null;
                state.isAuthenticated = false;
            })
            .addCase(logoutUser.rejected, (state) => {
                state.user = null;
                state.token = null;
                state.isAuthenticated = false;
            });

        // Load User
        builder
            .addCase(loadUser.pending, (state) => {
                state.isLoading = true;
            })
            .addCase(loadUser.fulfilled, (state, action) => {
                state.isLoading = false;
                if (action.payload) {
                    state.user = action.payload.user;
                    state.token = action.payload.token;
                    state.isAuthenticated = true;
                }
            })
            .addCase(loadUser.rejected, (state) => {
                state.isLoading = false;
                state.isAuthenticated = false;
            });

        // Update Instagram ID
        builder
            .addCase(updateInstagramId.fulfilled, (state, action) => {
                state.user = action.payload;
            });
    },
});

export const { updateUserCoins, setUser, clearAuth } = authSlice.actions;
export default authSlice.reducer;

