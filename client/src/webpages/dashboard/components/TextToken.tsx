import CloseButton from '@/components/common/CloseButton';

export default function TextToken(props: {
  title: string;
  onDelete: () => void;
  disabled?: boolean;
}) {
  const { title, onDelete, disabled } = props;
  return (
    <div className="flex text-start m-0.5 py-0.5 px-1.5 bg-gray-200 rounded items-center gap-1.5 text-base">
     <span className="flex items-center text-center">{title}</span>
     {Boolean(!disabled) ? <CloseButton onClose={onDelete} /> : null}
    </div>
  );
}
