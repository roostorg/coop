import React from 'react';

export default function NavHeader(props: {
  buttons: {
    title: string;
    onClick?: () => void;
  }[];
}) {
  const { buttons } = props;

  return (
    <div className="flex justify-start">
      <div className="inline-flex items-center justify-start p-4 text-sm font-medium border border-solid rounded-lg shadow mb-9 border-slate-200">
        {buttons.map((button, index) => {
          const isLastButton = index === buttons.length - 1;
          return (
            <React.Fragment key={index}>
              <div
                className={`cursor-pointer ${
                  isLastButton ? 'text-primary' : 'text-gray-700'
                }`}
                onClick={button.onClick}
              >
                {button.title}
              </div>
              {!isLastButton && <div className="mx-3">/</div>}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
