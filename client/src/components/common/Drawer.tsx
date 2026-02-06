import type React from 'react';

import CloseButton from './CloseButton';

export default function Drawer(props: {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  const { isOpen, onClose, children, title } = props;
  return (
    <>
      {isOpen && <div className="fixed inset-0 z-40" onClick={onClose} />}
      <div
        className={`fixed top-0 right-0 p-8 h-full w-auto border border-solid border-r-0 border-slate-200 rounded-l-lg bg-slate-100 shadow-xl transform transition-transform scrollbar-hide z-50 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6 gap-8">
          {title ? <div className="text-xl font-semibold">{title}</div> : null}
          <CloseButton onClose={onClose} />
        </div>
        <div className="w-full h-full pb-8 overflow-y-scroll">{children}</div>
      </div>
    </>
  );
}
