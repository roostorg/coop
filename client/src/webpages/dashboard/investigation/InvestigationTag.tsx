export default function InvestigationTag(props: {
  title: string;
  key: string | number;
}) {
  const { title, key } = props;
  return (
    <div
      key={key}
      className="p-2 m-0.5 rounded-md border-solid border-gray-200 text-gray-500 bg-gray-50"
    >
      {title}
    </div>
  );
}
