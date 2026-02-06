import CoopButton, { type CoopButtonType } from './CoopButton';

export type CoopModalFooterButtonProps = {
  title: string;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  type?: CoopButtonType;
  loading?: boolean;
  disabled?: boolean;
};

export default function CoopModalFooter(props: {
  buttons: CoopModalFooterButtonProps[];
}) {
  const { buttons } = props;
  return (
    <div className="flex justify-end pt-4 gap-2">
      {buttons.map((button, i) => (
        <CoopButton
          key={i}
          title={button.title}
          type={button.type}
          onClick={button.onClick}
          loading={button.loading ?? false}
          disabled={button.disabled ?? false}
        />
      ))}
    </div>
  );
}
