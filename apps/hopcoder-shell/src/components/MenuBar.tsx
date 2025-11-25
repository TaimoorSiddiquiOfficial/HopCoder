import React, { useState, useEffect, useRef } from 'react';

export interface MenuItem {
  label: string;
  action?: () => void;
  shortcut?: string;
  children?: MenuItem[];
}

interface MenuBarProps {
  menus: MenuItem[];
}

export function MenuBar({ menus }: MenuBarProps) {
  const [activeMenu, setActiveMenu] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="h-8 bg-[#3c3c3c] flex items-center px-2 text-xs select-none" ref={menuRef}>
      {menus.map((menu, index) => (
        <div key={index} className="relative">
          <div
            className={`px-3 py-1 rounded cursor-pointer hover:bg-[#505050] ${
              activeMenu === index ? 'bg-[#505050] text-white' : 'text-[#cccccc]'
            }`}
            onClick={() => setActiveMenu(activeMenu === index ? null : index)}
            onMouseEnter={() => activeMenu !== null && setActiveMenu(index)}
          >
            {menu.label}
          </div>
          {activeMenu === index && menu.children && (
            <div className="absolute top-full left-0 bg-[#252526] border border-[#454545] shadow-lg min-w-[200px] z-50 py-1">
              {menu.children.map((item, itemIndex) => (
                <div
                  key={itemIndex}
                  className="px-4 py-1.5 hover:bg-[#094771] hover:text-white cursor-pointer flex justify-between items-center text-[#cccccc]"
                  onClick={() => {
                    item.action?.();
                    setActiveMenu(null);
                  }}
                >
                  <span>{item.label}</span>
                  {item.shortcut && <span className="text-xs opacity-60 ml-4">{item.shortcut}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
