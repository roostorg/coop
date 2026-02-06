import {
  CircleCheck,
  CircleX,
  Info,
  LoaderCircle,
  TriangleAlert,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { toast, Toaster } from 'sonner';

type ToastProps = React.ComponentProps<typeof Toaster>;

const Toast = ({ ...props }: ToastProps) => {
  const { theme = 'light' } = useTheme();

  return (
    <Toaster
      theme={theme as ToastProps['theme']}
      className="toaster"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: 'p-4 border rounded-lg shadow-sm flex items-center space-x-3',
          default: 'bg-white',
          icon: 'w-5 h-5',
          description: 'text-sm',
        },
      }}
      icons={{
        success: <CircleCheck className="text-teal-500 icon" />,
        info: <Info className="text-blue-500 icon" />,
        warning: <TriangleAlert className="text-yellow-500 icon" />,
        error: <CircleX className="text-red-500 icon" />,
        loading: <LoaderCircle className="icon animate-spin" />,
      }}
      {...props}
    />
  );
};

export { Toast, toast };
