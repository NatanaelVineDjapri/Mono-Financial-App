// The single imperative toast queue (DESIGN.md section 8/16: snackbar, with Undo). One
// toast at a time — a second show() while one is visible replaces it, same as the design's
// snackbar never stacking. <ToastHost> renders this; call showToast() from anywhere.
import { create } from 'zustand';

interface ToastOptions {
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastState extends ToastOptions {
  visible: boolean;
  message: string;
  show: (message: string, options?: ToastOptions) => void;
  dismiss: () => void;
}

export const useToastStore = create<ToastState>(set => ({
  visible: false,
  message: '',
  actionLabel: undefined,
  onAction: undefined,
  show: (message, options = {}) => set({ visible: true, message, actionLabel: options.actionLabel, onAction: options.onAction }),
  dismiss: () => set({ visible: false }),
}));

export function showToast(message: string, options?: ToastOptions): void {
  useToastStore.getState().show(message, options);
}
