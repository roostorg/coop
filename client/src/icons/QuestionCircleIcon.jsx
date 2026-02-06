import React from 'react';

function QuestionCircleIcon(props) {
  const fill = props.fill || 'currentColor';
  const width = props.width || '100%';
  const height = props.height || '100%';
  const title = props.title || 'question circle';

  return (
    <svg
      height={height}
      width={width}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <g fill={fill}>
        <path d="M32 1.8C15.3 1.8 1.8 15.3 1.8 32S15.3 62.3 32 62.3 62.3 48.7 62.3 32 48.7 1.8 32 1.8zm0 56C17.8 57.8 6.3 46.2 6.3 32 6.3 17.8 17.8 6.3 32 6.3s25.8 11.6 25.8 25.8c0 14.1-11.6 25.7-25.8 25.7z" />
        <path d="M33.8 12.1c-2.9-.5-5.9.3-8.1 2.2-2.2 1.9-3.5 4.6-3.5 7.6 0 1.1.2 2.2.6 3.3.4 1.2 1.7 1.8 2.9 1.4 1.2-.4 1.8-1.7 1.4-2.9-.2-.6-.3-1.2-.3-1.8 0-1.6.7-3.1 1.9-4.1 1.2-1 2.8-1.5 4.5-1.2 2.1.4 3.9 2.2 4.3 4.3.4 2.5-.9 5-3.2 6-2.6 1.1-4.3 3.7-4.3 6.7v6.2c0 1.2 1 2.3 2.3 2.3 1.2 0 2.3-1 2.3-2.3v-6.2c0-1.1.6-2.1 1.5-2.5 4.3-1.8 6.8-6.3 6-10.9-1.1-4.1-4.3-7.4-8.3-8.1z" />
        <path d="M32.1 45.8h-.3c-1.2 0-2.3 1-2.3 2.3s1 2.3 2.3 2.3h.3c1.2 0 2.2-1 2.2-2.3s-.9-2.3-2.2-2.3z" />
      </g>
    </svg>
  );
}

export default QuestionCircleIcon;
