import { ArrowLeft } from 'lucide-react';

import { Dialog, DialogContent } from '@/coop-ui/Dialog';
import CloseButton from '@/components/common/CloseButton';

import CoopModalFooter, { CoopModalFooterButtonProps } from './CoopModalFooter';

export default function CoopModal({
  children,
  ...props
}: {
  children: React.ReactNode;
  visible: boolean;
  onClose?: (e: React.MouseEvent<HTMLElement>) => void;
  title?: string;
  footer?: CoopModalFooterButtonProps[];
  showBack?: boolean;
  onBack?: () => void;
  className?: string;
  hideCloseButton?: boolean;
}) {
  const {
    visible,
    onClose,
    title,
    footer,
    onBack,
    showBack,
    className,
    hideCloseButton,
  } = props;

  const backButton = (
    <div
      onClick={onBack}
      className="flex flex-row items-center justify-center rounded-full cursor-pointer text-slate-400 hover:text-primary/70"
    >
      <ArrowLeft className="h-4 w-4" />
      {!title && (
        <div className="font-medium text-start ml-2 text-sm pb-0.5">Back</div>
      )}
    </div>
  );

  return (
    <Dialog
      open={visible}
      onOpenChange={(open) => {
        if (!open && onClose) {
          onClose({} as React.MouseEvent<HTMLElement>);
        }
      }}
    >
      <DialogContent
        className={`p-8 rounded-lg max-w-5xl ${className ?? ''}`}
      >
        <div className="flex flex-row min-w-[24rem] justify-between items-start pb-6">
          <div className="flex flex-row items-center justify-start">
            {showBack && backButton}
            {title && (
              <div className="mr-12 text-2xl font-bold text-start">{title}</div>
            )}
          </div>
          {hideCloseButton || !onClose ? null : (
            <div className="flex flex-col items-center justify-center h-full pb-0">
              <CloseButton onClose={onClose} customWidth="w-5" />
            </div>
          )}
        </div>
        {children}
        {footer && <CoopModalFooter buttons={footer} />}
      </DialogContent>
    </Dialog>
  );
}
