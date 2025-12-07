import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { WalletState, Transaction, WithdrawalRequest } from '@types';
import { walletService } from '@services/walletService';

const initialState: WalletState = {
  balance: 0,
  totalEarned: 0,
  totalWithdrawn: 0,
  transactions: [],
  isLoading: false,
};

export const fetchBalance = createAsyncThunk(
  'wallet/fetchBalance',
  async (_, { rejectWithValue }) => {
    try {
      const balance = await walletService.getBalance();
      return balance;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchTransactions = createAsyncThunk(
  'wallet/fetchTransactions',
  async (_, { rejectWithValue }) => {
    try {
      const transactions = await walletService.getTransactions();
      return transactions;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const requestWithdrawal = createAsyncThunk(
  'wallet/requestWithdrawal',
  async (
    {
      amount,
      paymentMethod,
      accountDetails,
    }: {
      amount: number;
      paymentMethod: string;
      accountDetails: string;
    },
    { rejectWithValue }
  ) => {
    try {
      const request = await walletService.requestWithdrawal(amount, paymentMethod, accountDetails);
      return request;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const walletSlice = createSlice({
  name: 'wallet',
  initialState,
  reducers: {
    addCoins: (state, action: PayloadAction<number>) => {
      state.balance += action.payload;
      state.totalEarned += action.payload;
      state.transactions.unshift({
        id: Date.now().toString(),
        type: 'earned',
        amount: action.payload,
        description: 'Task completed',
        createdAt: new Date().toISOString(),
      });
    },
    subtractCoins: (state, action: PayloadAction<number>) => {
      state.balance -= action.payload;
      state.totalWithdrawn += action.payload;
    },
    setBalance: (state, action: PayloadAction<number>) => {
      state.balance = action.payload;
    },
  },
  extraReducers: (builder) => {
    // Fetch Balance
    builder
      .addCase(fetchBalance.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchBalance.fulfilled, (state, action) => {
        state.isLoading = false;
        state.balance = action.payload;
      })
      .addCase(fetchBalance.rejected, (state) => {
        state.isLoading = false;
      });

    // Fetch Transactions
    builder
      .addCase(fetchTransactions.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchTransactions.fulfilled, (state, action) => {
        state.isLoading = false;
        state.transactions = action.payload;
      })
      .addCase(fetchTransactions.rejected, (state) => {
        state.isLoading = false;
      });

    // Request Withdrawal
    builder
      .addCase(requestWithdrawal.fulfilled, (state, action) => {
        state.balance -= action.payload.amount;
        state.totalWithdrawn += action.payload.amount;
      });
  },
});

export const { addCoins, subtractCoins, setBalance } = walletSlice.actions;
export default walletSlice.reducer;

