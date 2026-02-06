export default function HTMLRenderer(props: { rawHTML: string }) {
  const { rawHTML } = props;
  return (
    <div className="text-start" dangerouslySetInnerHTML={{ __html: rawHTML }} />
  );
}
