import React, { ReactNode } from 'react';

interface LayoutProps {
  sidebar: ReactNode;
  editor: ReactNode;
  bottomPanel: ReactNode;
  rightPanel?: ReactNode;
}

export function Layout({ sidebar, editor, bottomPanel, rightPanel }: LayoutProps) {
  return (
    <div className="h-full w-full flex flex-col bg-matte-black text-gray-300 overflow-hidden">
      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0 bg-surface-light border-r border-surface">
          {sidebar}
        </div>

        {/* Editor Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 relative">
            {editor}
          </div>
          
          {/* Bottom Panel (Terminal) */}
          <div className="h-48 flex-shrink-0 border-t border-surface">
            {bottomPanel}
          </div>
        </div>

        {/* Right Panel (Chat) */}
        {rightPanel && (
          <div className="flex-shrink-0 border-l border-surface">
            {rightPanel}
          </div>
        )}
      </div>
      
      {/* Status Bar */}
      <div className="h-6 bg-[#007acc] flex items-center px-2 text-xs text-white justify-between">
        <div className="flex gap-4">
          <span>main*</span>
          <span>0 errors</span>
        </div>
        <div className="flex gap-4">
          <span>Ln 1, Col 1</span>
          <span>UTF-8</span>
          <span>TypeScript React</span>
        </div>
      </div>
    </div>
  );
}
