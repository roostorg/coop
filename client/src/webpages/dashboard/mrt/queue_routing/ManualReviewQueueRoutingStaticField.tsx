// This component is used to display fields in an MRT routing rule when it isn't
// in editing mode
export function ManualReviewQueueRoutingStaticTextField(props: {
  text: string;
}) {
  return (
    <div className="px-4 py-2 font-medium bg-white border border-solid rounded-md border-slate-200 text-slate-500">
      {props.text}
    </div>
  );
}

export function ManualReviewQueueRoutingStaticTokenField(props: {
  tokens: readonly string[];
  reducePadding?: boolean;
}) {
  return (
    <div
      className={`flex flex-row justify-start px-3 space-x-1 border border-solid rounded-md border-slate-200 text-slate-500 ${
        Boolean(props.reducePadding) ? 'px-2 py-1' : 'px-3 py-2'
      }`}
    >
      {props.tokens.map((token) => (
        <div
          className={`p-1 rounded bg-slate-200 ${
            Boolean(props.reducePadding) ? 'px-2 py-1' : 'px-3 py-2'
          }`}
          key={token}
        >
          {token}
        </div>
      ))}
    </div>
  );
}
