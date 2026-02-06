import TextToken from '../../../components/TextToken';

export default function RuleInsightsSampleDisabledTextTokenInput(props: {
  uniqueKey: string;
  tokens: readonly string[];
}) {
  const { uniqueKey, tokens } = props;

  return (
    <div
      key={uniqueKey}
      className="flex p-2 mx-2 bg-white rounded-lg whitespace-nowrap"
    >
      <div
        key={[uniqueKey, 'TextTokenInput-tokens'].join('_')}
        className="flex flex-wrap"
      >
        {tokens.map((token, idx) => {
          return (
            <TextToken
              title={token}
              key={idx}
              onDelete={() => {}}
              disabled={true}
            />
          );
        })}
      </div>
    </div>
  );
}
