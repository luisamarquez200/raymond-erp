import { create } from 'zustand';

interface LoadingState {
  activeRequests: number;
  isLoading: boolean;
  startRequest: () => void;
  endRequest: () => void;
}

export const useLoadingStore = create<LoadingState>((set) => ({
  activeRequests: 0,
  isLoading: false,
  startRequest: () =>
    set((state) => {
      const nextCount = state.activeRequests + 1;
      return { activeRequests: nextCount, isLoading: nextCount > 0 };
    }),
  endRequest: () =>
    set((state) => {
      const nextCount = Math.max(0, state.activeRequests - 1);
      return { activeRequests: nextCount, isLoading: nextCount > 0 };
    }),
}));
