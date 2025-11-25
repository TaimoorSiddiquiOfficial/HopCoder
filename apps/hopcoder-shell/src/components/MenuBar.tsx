import React, { useState, useEffect, useRef } from 'react';

export interface MenuItem {
  label: string;
  action?: () => void;
  shortcut?: string;
  children?: MenuItem[];
}

interface MenuBarProps {
  menus: MenuItem[];
  logo?: string;
}

export function MenuBar({ menus, logo }: MenuBarProps) {
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
    <div className="h-8 bg-surface-light flex items-center px-2 text-xs select-none border-b border-surface" ref={menuRef}>
      {logo && <img src={logo} alt="Logo" className="h-5 w-5 mr-3 ml-1 opacity-80" />}
      {menus.map((menu, index) => (
        <div key={index} className="relative">
          <div
            className={`px-3 py-1 rounded cursor-pointer hover:bg-surface transition-colors ${
              activeMenu === index ? 'bg-surface text-gold' : 'text-gold-dim'
            }`}
            onClick={() => setActiveMenu(activeMenu === index ? null : index)}
            onMouseEnter={() => activeMenu !== null && setActiveMenu(index)}
          >
            {menu.label}
          </div>
          {activeMenu === index && menu.children && (
            <div className="absolute top-full left-0 bg-surface-light border border-gold-dim/20 shadow-xl min-w-[200px] z-50 py-1 rounded-b-md">
              {menu.children.map((item, itemIndex) => (
                <div
                  key={itemIndex}
                  className="px-4 py-1.5 hover:bg-surface hover:text-gold cursor-pointer flex justify-between items-center text-gold-dim transition-colors"
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
