import { type ReactNode } from "react";

export interface SidebarItem {
  id: string;
  label: string;
  icon: string;
}

const items: SidebarItem[] = [
  { id: "chat",     label: "Chat",       icon: "💬" },
  { id: "feature1", label: "Feature 1",  icon: "1️⃣" },
  { id: "feature2", label: "Feature 2",  icon: "2️⃣" },
  { id: "feature3", label: "Feature 3",  icon: "3️⃣" },
  { id: "feature4", label: "Feature 4",  icon: "4️⃣" },
  { id: "feature5", label: "Feature 5",  icon: "5️⃣" },
  { id: "feature6", label: "Feature 6",  icon: "6️⃣" },
];

interface SidebarProps {
  activeView: string;
  onNavigate: (viewId: string) => void;
  collapsed?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ activeView, onNavigate, collapsed = false, onToggle }: SidebarProps): ReactNode {
  const navClass = "sidebar" + (collapsed ? " sidebar--collapsed" : "");
  return (
    <nav className={navClass} aria-label="Main navigation">
      <button
        className="sidebar-toggle"
        onClick={onToggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? "▶" : "◀"}
      </button>

      <ul className="sidebar-nav" role="list">
        {items.map((item) => {
          const btnClass = "sidebar-item" + (activeView === item.id ? " sidebar-item--active" : "");
          return (
            <li key={item.id}>
              <button
                className={btnClass}
                onClick={() => onNavigate(item.id)}
                aria-current={activeView === item.id ? "page" : undefined}
                title={item.label}
              >
                <span className="sidebar-icon" aria-hidden="true">{item.icon}</span>
                {!collapsed && <span className="sidebar-label">{item.label}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
