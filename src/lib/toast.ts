import { toast } from '@/components/ui/use-toast';

type ToastVariant = 'default' | 'destructive';

const showToast = (title: string, description?: string, variant: ToastVariant = 'default') =>
  toast({
    title,
    description,
    variant,
  });

export const showErrorToast = (title: string, description?: string) => showToast(title, description, 'destructive');

export const showSuccessToast = (title: string, description?: string) => showToast(title, description, 'default');
