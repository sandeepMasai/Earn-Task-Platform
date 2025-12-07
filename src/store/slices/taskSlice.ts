import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { TaskState, Task } from '@types';
import { taskService } from '@services/taskService';

const initialState: TaskState = {
  tasks: [],
  currentTask: null,
  isLoading: false,
  error: null,
};

export const fetchTasks = createAsyncThunk(
  'tasks/fetchTasks',
  async (_, { rejectWithValue }) => {
    try {
      const tasks = await taskService.getTasks();
      return tasks;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchTaskById = createAsyncThunk(
  'tasks/fetchTaskById',
  async (taskId: string, { rejectWithValue }) => {
    try {
      const task = await taskService.getTaskById(taskId);
      return task;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const completeTask = createAsyncThunk(
  'tasks/completeTask',
  async ({ taskId, data }: { taskId: string; data?: any }, { rejectWithValue }) => {
    try {
      const result = await taskService.completeTask(taskId, data);
      return { taskId, result };
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const taskSlice = createSlice({
  name: 'tasks',
  initialState,
  reducers: {
    setCurrentTask: (state, action: PayloadAction<Task | null>) => {
      state.currentTask = action.payload;
    },
    markTaskAsCompleted: (state, action: PayloadAction<string>) => {
      const task = state.tasks.find((t) => t.id === action.payload);
      if (task) {
        task.isCompleted = true;
        task.completedAt = new Date().toISOString();
      }
      if (state.currentTask?.id === action.payload) {
        state.currentTask.isCompleted = true;
        state.currentTask.completedAt = new Date().toISOString();
      }
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch Tasks
    builder
      .addCase(fetchTasks.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTasks.fulfilled, (state, action) => {
        state.isLoading = false;
        state.tasks = action.payload;
      })
      .addCase(fetchTasks.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Fetch Task By ID
    builder
      .addCase(fetchTaskById.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTaskById.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentTask = action.payload;
      })
      .addCase(fetchTaskById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Complete Task
    builder
      .addCase(completeTask.fulfilled, (state, action) => {
        const task = state.tasks.find((t) => t.id === action.payload.taskId);
        if (task) {
          task.isCompleted = true;
          task.completedAt = new Date().toISOString();
        }
        if (state.currentTask?.id === action.payload.taskId) {
          state.currentTask.isCompleted = true;
          state.currentTask.completedAt = new Date().toISOString();
        }
      });
  },
});

export const { setCurrentTask, markTaskAsCompleted, clearError } = taskSlice.actions;
export default taskSlice.reducer;

