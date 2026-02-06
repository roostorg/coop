import React from 'react';

function UserIcon(props) {
  const fill = props.fill || 'currentColor';
  const width = props.width || '100%';
  const height = props.height || '100%';
  const title = props.title || 'user alt 5';

  return (
    <svg
      height={height}
      width={width}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <g fill={fill}>
        <path d="M49.2 34c-3-3.6-6.8-6.1-11-7.4 4.2-2.2 7-6.6 7-11.7 0-7.3-5.9-13.3-13.3-13.3S18.7 7.7 18.7 15c0 5 2.8 9.4 7 11.7-4.2 1.3-7.9 3.8-11 7.4-4.4 5.2-6.9 12.4-7 20.3 0 .9.5 1.7 1.2 2 2.7 1.4 12.5 5.8 23 5.8 11.4 0 20.5-4.5 23.1-5.9.7-.4 1.2-1.2 1.2-2-.1-7.8-2.6-15-7-20.3zM32 6.3c4.8 0 8.8 3.9 8.8 8.8s-3.9 8.8-8.8 8.8-8.8-3.9-8.8-8.8 4-8.8 8.8-8.8zm0 51.5c-8.3 0-16.4-3.2-19.7-4.8.4-6.3 2.4-11.9 5.9-16.1 3.6-4.3 8.5-6.7 13.8-6.7s10.2 2.4 13.8 6.7c3.5 4.1 5.6 9.8 5.9 16.1-3.1 1.6-10.7 4.8-19.7 4.8z" />
      </g>
    </svg>
  );
}

export default UserIcon;
