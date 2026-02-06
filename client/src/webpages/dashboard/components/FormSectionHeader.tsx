export default function FormSectionHeader(props: {
  title: string;
  subtitle?: string | React.ReactNode;
}) {
  const { title, subtitle } = props;
  return (
    <div className="flex flex-col">
      <div className="mb-1 text-lg font-semibold text-zinc-900 text-start">
        {title}
      </div>
      {subtitle ? (
        <div className="mb-4 text-base text-zinc-900 text-start">
          {subtitle}
        </div>
      ) : null}
    </div>
  );
}
