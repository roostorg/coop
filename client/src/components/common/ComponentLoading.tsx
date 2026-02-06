/**
 * Single component loading indicator (centered using component height & width)
 */
export default function ComponentLoading(props: {
  size?: 'small' | 'default' | 'large';
}) {
  const { size = 'default' } = props;
  const sizeStyle = (() => {
    switch (size) {
      case 'small':
        return 'size-4';
      case 'default':
        return 'size-6';
      case 'large':
        return 'size-8';
    }
  })();
  return (
    <div className="flex flex-col items-center justify-center w-full my-6">
      <div
        className={`animate-spin inline-block border-solid border-2 border-current border-t-transparent text-blue-600 rounded-full dark:text-blue-500 ${sizeStyle}`}
        role="status"
        aria-label="loading"
      >
        <span className="sr-only">Loading...</span>
      </div>
    </div>
  );
}
