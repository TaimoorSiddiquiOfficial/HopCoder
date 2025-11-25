import React, { ReactNode } from 'react';

interface LayoutProps {
  sidebar: ReactNode;
  editor: ReactNode;
  bottomPanel: ReactNode;
  rightPanel?: ReactNode;
}

export function Layout({ sidebar, editor, bottomPanel, rightPanel }: LayoutProps) {
  return (
    <div className="h-screen w-screen flex flex-col bg-[#1e1e1e] text-white overflow-hidden">
      {/* Header / Menu Bar Placeholder */}
      <div className="h-8 bg-[#3c3c3c] flex items-center px-4 text-xs select-none">
        <span className="mr-4">File</span>
        <span className="mr-4">Edit</span>
        <span className="mr-4">View</span>
        <span className="mr-4">Go</span>
        <span className="mr-4">Run</span>
        <span className="mr-4">Terminal</span>
        <span className="mr-4">Help</span>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0">
          {sidebar}
        </div>

        {/* Editor Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 relative">
            {editor}
          </div>
          
          {/* Bottom Panel (Terminal) */}
          <div className="h-48 flex-shrink-0">
            {bottomPanel}
          </div>
        </div>

        {/* Right Panel (Chat) */}
        {rightPanel && (
          <div className="flex-shrink-0">
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
