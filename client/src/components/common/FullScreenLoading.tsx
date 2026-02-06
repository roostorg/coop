import ComponentLoading from './ComponentLoading';

/**
 * Full screen centered loading indicator with a delay of 500ms
 */
export default function FullScreenLoading(props: {
  size?: 'small' | 'default' | 'large';
}) {
  const { size = 'large' } = props;

  return (
    <div className="flex flex-col self-center justify-center h-full">
      <ComponentLoading size={size} />
    </div>
  );
}
