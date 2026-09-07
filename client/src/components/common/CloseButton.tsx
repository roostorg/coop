import { X } from 'lucide-react';

export default function CloseButton(props: {
  onClose: ((event: React.MouseEvent<HTMLElement>) => void) | (() => void);
  customWidth?: `w-${string}`;
}) {
  const { onClose, customWidth } = props;
  const sizeClass = customWidth
    ? `${customWidth} ${customWidth.replace('w-', 'h-')}`
    : 'w-4 h-4';
  return (
    <div className="flex w-fit h-fit" onClick={onClose}>
      <X
        className={`rounded-full bg-slate-400/70 hover:bg-slate-400/50 p-1 cursor-pointer text-slate-200 ${sizeClass}`}
      />
    </div>
  );
}
