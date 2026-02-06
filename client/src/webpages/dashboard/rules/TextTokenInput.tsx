import { useEffect, useMemo, useRef, useState } from 'react';

import TextToken from '../components/TextToken';

export default function TextTokenInput(props: {
  uniqueKey: string;
  title?: string;
  placeholder?: string;
  updateTokenValues: (value: string[]) => void;
  initialValues: readonly string[] | undefined;
  disabled?: boolean;
}) {
  const {
    uniqueKey,
    title,
    placeholder,
    updateTokenValues,
    initialValues,
    disabled,
  } = props;
  const [tokens, setTokens] = useState<readonly string[]>(initialValues ?? []);
  const [tokenBuilder, setTokenBuiler] = useState<string>('');
  const inputEl = useRef<HTMLInputElement>(null);

  // The initialValues prop is sometimes stateful -- i.e. the parent passes
  // in the prop as initialValue={state.someProp}. So when that state changes
  // the initialValue prop updates, but tokens doesn't. So we want to make sure
  // that the tokens value does indeed update whenever initialValues changes
  useMemo(() => setTokens(initialValues ?? []), [initialValues]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputEl.current &&
        !inputEl.current.contains(event.target as Node) &&
        tokenBuilder.length > 0
      ) {
        addToken();
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenBuilder]);

  const onClick = () => {
    if (inputEl.current != null) {
      inputEl.current.focus();
    }
  };

  const addToken = () => {
    const newTokens = [...tokens];
    if (!newTokens.includes(tokenBuilder)) {
      newTokens.push(tokenBuilder);
      setTokens([...newTokens]);
      updateTokenValues([...newTokens]);
    }
    setTokenBuiler('');
  };

  const onDelete = (index: number) => {
    if (Boolean(disabled)) {
      return;
    }
    const prevTokens = [...tokens];
    prevTokens.splice(index, 1);
    setTokens([...prevTokens]);
    updateTokenValues([...prevTokens]);
  };

  return (
    <div key={uniqueKey}>
      {title && <div className="text-xs font-bold">{title}</div>}
      <div
        key={[uniqueKey, 'TextTokenInput-field'].join('_')}
        className={`flex flex-row flex-wrap rounded px-2.5 border border-solid border-[#d9d9d9] cursor-text text-base bg-white hover:border-primary focus:border-primary ${
          tokens.length > 0 ? 'py-[3px]' : 'py-[5px]'
        }`}
        onClick={onClick}
      >
        <div
          key={[uniqueKey, 'TextTokenInput-tokens'].join('_')}
          className="flex flex-wrap gap-0.5 mr-1"
        >
          {tokens.map((token, idx) => {
            return (
              <TextToken
                title={token}
                key={idx}
                onDelete={() => onDelete(idx)}
                disabled={disabled ?? false}
              />
            );
          })}
        </div>
        {Boolean(!disabled) && (
          <input
            key={[uniqueKey, 'TextTokenInput-input'].join('_')}
            className="border-none min-w-[250px] placeholder:text-[#bfbfbf] focus:outline-none focus:ring-transparent p-0"
            type="text"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && tokenBuilder.length > 0) {
                addToken();
              } else if (
                event.key === 'Backspace' &&
                tokenBuilder.length === 0 &&
                tokens.length > 0
              ) {
                onDelete(tokens.length - 1);
              }
            }}
            onChange={(event) => setTokenBuiler(event.target.value)}
            placeholder={
              tokens.length > 0 || placeholder == null ? '' : placeholder
            }
            ref={inputEl}
            value={tokenBuilder}
          />
        )}
      </div>
    </div>
  );
}
