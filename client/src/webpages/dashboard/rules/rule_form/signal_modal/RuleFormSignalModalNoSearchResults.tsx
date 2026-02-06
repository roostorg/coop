import { SearchOutlined } from '@ant-design/icons';

export default function RuleFormSignalModalNoSearchResults() {
  return (
    <div className="flex flex-col items-center justify-center p-4 mt-4 font-medium bg-gray-100 border border-gray-200 border-solid rounded-lg shadow-inner">
      <SearchOutlined className="flex items-center justify-center w-10 h-10 text-lg bg-gray-300 border border-none rounded-full" />
      <div className="mt-2 text-center">
        We couldn't find the signal you're searching for.
      </div>
    </div>
  );
}
