// Mounted once at the app root (src/app/_layout.tsx): binds the imperative toast-store
// to the presentational <Toast>, so any code can call showToast() without passing props
// down through every screen.
import { Toast } from '@/components/Toast';
import { useToastStore } from '@/components/toast-store';

export function ToastHost() {
  const { visible, message, actionLabel, onAction, dismiss } = useToastStore();
  return <Toast visible={visible} message={message} actionLabel={actionLabel} onAction={onAction} onDismiss={dismiss} />;
}
