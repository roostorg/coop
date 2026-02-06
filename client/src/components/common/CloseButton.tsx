import { CloseFilled } from '@/icons';

export default function CloseButton(props: {
  onClose: ((event: React.MouseEvent<HTMLElement>) => void) | (() => void);
  customWidth?: `w-${string}`;
}) {
  const { onClose, customWidth } = props;
  return (
    <div className="flex w-fit h-fit" onClick={onClose}>
      <CloseFilled
        className={`rounded-full bg-slate-400/70 hover:bg-slate-400/50 p-1 cursor-pointer text-slate-200 ${
          customWidth ?? 'w-4'
        }`}
      />
    </div>
  );
}
