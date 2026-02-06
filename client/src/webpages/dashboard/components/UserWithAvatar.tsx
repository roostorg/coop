import capitalize from 'lodash/capitalize';

export default function UserWithAvatar(props: { name: string }) {
  const { name } = props;
  const nameComponents = name.split(' ');
  const firstName = nameComponents[0];
  const lastName =
    nameComponents.length > 1
      ? nameComponents[nameComponents.length - 1]
      : undefined;

  return (
    <div className="flex items-center justify-center gap-2">
      <div className="flex items-center justify-center w-8 h-8 p-2 text-sm border border-solid rounded-full border-primary text-primary">
        {`${firstName[0].toUpperCase()}${
          lastName ? lastName[0].toUpperCase() : ''
        }`}
      </div>
      <div className="whitespace-nowrap">{`${capitalize(firstName)} ${
        lastName ? capitalize(lastName) : ''
      }`}</div>
    </div>
  );
}
