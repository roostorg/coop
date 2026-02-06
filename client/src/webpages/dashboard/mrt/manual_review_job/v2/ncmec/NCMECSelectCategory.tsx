import { NCMECCategory } from './NCMECReviewUser';

export default function NCMECSelectCategory(props: {
  selectedCategory: NCMECCategory | undefined;
  onUpdateCategory: (category: NCMECCategory | undefined) => void;
}) {
  const { selectedCategory, onUpdateCategory } = props;
  const onClick = (category: NCMECCategory) => {
    onUpdateCategory(category === selectedCategory ? undefined : category);
  };
  const style =
    'flex justify-center items-center text-center font-bold border-solid border border-neutral-300 py-1 cursor-pointer border-r-0 first:rounded-tl-full first:rounded-bl-full last:rounded-tr-full last:rounded-br-full last:border-r flex-grow';
  return (
    <div className="flex items-stretch w-full mt-2">
      <div
        key={'A1'}
        onClick={() => onClick('A1')}
        className={`${style} ${
          selectedCategory === 'A1'
            ? `text-white bg-red-400`
            : `text-neutral-300 bg-white hover:text-white hover:bg-red-300`
        }`}
      >
        A1
      </div>
      <div
        key={'A2'}
        onClick={() => onClick('A2')}
        className={`${style} ${
          selectedCategory === 'A2'
            ? `text-white bg-orange-400`
            : `text-neutral-300 bg-white hover:text-white hover:bg-orange-300`
        }`}
      >
        A2
      </div>
      <div
        key={'B1'}
        onClick={() => onClick('B1')}
        className={`${style} ${
          selectedCategory === 'B1'
            ? `text-slate-500 bg-amber-400`
            : `text-neutral-300 bg-white hover:text-white hover:bg-amber-300`
        }`}
      >
        B1
      </div>
      <div
        key={'B2'}
        onClick={() => onClick('B2')}
        className={`${style} ${
          selectedCategory === 'B2'
            ? `text-white bg-blue-400`
            : `text-neutral-300 bg-white hover:text-white hover:bg-blue-300`
        }`}
      >
        B2
      </div>
      <div
        key={'None'}
        onClick={() => onClick('None')}
        className={`${style} ${
          selectedCategory === 'None'
            ? `text-white bg-slate-500`
            : `text-neutral-300 bg-white hover:text-white hover:bg-indigo-300`
        }`}
      >
        None
      </div>
    </div>
  );
}
