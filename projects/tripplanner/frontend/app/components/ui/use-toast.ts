import { toast as sonnerToast } from "sonner"

type ToastProps = {
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
}

export const toast = ({ title, description, action, duration }: ToastProps) => {
  sonnerToast(title, {
    description,
    action: action ? {
      label: action.label,
      onClick: action.onClick,
    } : undefined,
    duration,
  })
}