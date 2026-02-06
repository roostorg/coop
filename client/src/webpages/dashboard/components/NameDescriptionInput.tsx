import { Input } from 'antd';
import { useState } from 'react';

export default function NameDescriptionInput(props: {
  nameInitialValue?: string;
  descriptionInitialValue?: string;
  error?: string;
  onChangeName: (name: string) => void;
  onChangeDescription: (description: string) => void;
}) {
  const {
    nameInitialValue,
    descriptionInitialValue,
    error,
    onChangeName,
    onChangeDescription,
  } = props;

  const [showError, setShowError] = useState<boolean>(error != null);

  return (
    <div className="flex flex-row items-start">
      <div className="flex flex-col w-1/4 gap-2">
        <div className="font-semibold">Name</div>
        <Input
          onChange={(event) => {
            onChangeName(event.target.value);
            setShowError(false);
          }}
          className="rounded-lg"
          value={nameInitialValue}
        />
        {showError && <div className="text-red-500">{error}</div>}
      </div>
      <div className="flex flex-col w-3/4 ml-4 gap-2">
        <div className="font-semibold">Description</div>
        <Input
          className="rounded-lg"
          value={descriptionInitialValue}
          onChange={(event) => onChangeDescription(event.target.value)}
        />
      </div>
    </div>
  );
}
