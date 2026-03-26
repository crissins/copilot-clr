import { type ReactNode } from "react";
import {
  Button,
  Tooltip,
  makeStyles,
  tokens,
  shorthands,
  mergeClasses,
} from "@fluentui/react-components";
import {
  Chat24Regular,
  DocumentBulletList24Regular,
  TextGrammarSettings24Regular,
  Mic24Regular,
  VideoClip24Regular,
  CalendarClock24Regular,
  PersonVoice24Regular,
  Record24Regular,
  ChevronLeft24Regular,
  ChevronRight24Regular,
  Settings24Regular,
} from "@fluentui/react-icons";

export interface NavItem {
  id: string;
  label: string;
  icon: JSX.Element;
}

const NAV_ITEMS: NavItem[] = [
  { id: "chat",     label: "Chat",              icon: <Chat24Regular /> },
  { id: "feature1", label: "Document Upload",   icon: <DocumentBulletList24Regular /> },
  { id: "feature2", label: "Simplify Content",  icon: <TextGrammarSettings24Regular /> },
  { id: "feature3", label: "Voice Chat",        icon: <Mic24Regular /> },
  { id: "feature4", label: "Media Processing",  icon: <VideoClip24Regular /> },
  { id: "feature5", label: "Task Decomposer",   icon: <CalendarClock24Regular /> },
  { id: "feature6", label: "Accessibility Hub", icon: <PersonVoice24Regular /> },
  { id: "feature7", label: "Speech Assistant", icon: <Record24Regular /> },
];

const BOTTOM_ITEMS: NavItem[] = [
  { id: "settings", label: "Settings", icon: <Settings24Regular /> },
];

interface SidebarProps {
  activeView: string;
  onNavigate: (viewId: string) => void;
  collapsed?: boolean;
  onToggle?: () => void;
}

const useStyles = makeStyles({
  nav: {
    display: "flex",
    flexDirection: "column",
    width: "220px",
    minHeight: "100%",
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRight("1px", "solid", tokens.colorNeutralStroke1),
    transition: "width 200ms ease",
    flexShrink: 0,
  },
  navCollapsed: {
    width: "52px",
  },
  toggleRow: {
    display: "flex",
    justifyContent: "flex-end",
    ...shorthands.padding("8px", "8px", "4px"),
  },
  itemList: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    ...shorthands.padding("4px", "8px"),
    flex: 1,
  },
  navBtn: {
    justifyContent: "flex-start",
    width: "100%",
    height: "40px",
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    fontWeight: tokens.fontWeightRegular,
    color: tokens.colorNeutralForeground2,
    backgroundColor: "transparent",
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground3,
      color: tokens.colorNeutralForeground1,
    },
  },
  navBtnActive: {
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    fontWeight: tokens.fontWeightSemibold,
    ":hover": {
      backgroundColor: tokens.colorBrandBackground2Hover,
      color: tokens.colorBrandForeground1,
    },
  },
  navBtnCollapsed: {
    justifyContent: "center",
    minWidth: "36px",
    width: "36px",
    ...shorthands.padding("0"),
  },
  bottomSection: {
    ...shorthands.borderTop("1px", "solid", tokens.colorNeutralStroke1),
    ...shorthands.padding("8px"),
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  label: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

export function Sidebar({ activeView, onNavigate, collapsed = false, onToggle }: SidebarProps): ReactNode {
  const styles = useStyles();

  return (
    <nav
      className={mergeClasses(styles.nav, collapsed && styles.navCollapsed)}
      aria-label="Main navigation"
    >
      {/* Collapse toggle */}
      <div className={styles.toggleRow}>
        <Tooltip
          content={collapsed ? "Expand navigation" : "Collapse navigation"}
          relationship="label"
          positioning="after"
        >
          <Button
            appearance="subtle"
            icon={collapsed ? <ChevronRight24Regular /> : <ChevronLeft24Regular />}
            onClick={onToggle}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            size="small"
          />
        </Tooltip>
      </div>

      {/* Nav items */}
      <ul className={styles.itemList} role="list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.id;
          const btn = (
            <Button
              className={mergeClasses(
                styles.navBtn,
                isActive && styles.navBtnActive,
                collapsed && styles.navBtnCollapsed,
              )}
              appearance="subtle"
              icon={item.icon}
              onClick={() => onNavigate(item.id)}
              aria-current={isActive ? "page" : undefined}
              aria-label={collapsed ? item.label : undefined}
            >
              {!collapsed && <span className={styles.label}>{item.label}</span>}
            </Button>
          );

          return (
            <li key={item.id} role="listitem">
              {collapsed ? (
                <Tooltip content={item.label} relationship="label" positioning="after">
                  {btn}
                </Tooltip>
              ) : (
                btn
              )}
            </li>
          );
        })}
      </ul>

      {/* Settings at the bottom */}
      <div className={styles.bottomSection}>
        {BOTTOM_ITEMS.map((item) => {
          const isActive = activeView === item.id;
          const btn = (
            <Button
              className={mergeClasses(
                styles.navBtn,
                isActive && styles.navBtnActive,
                collapsed && styles.navBtnCollapsed,
              )}
              appearance="subtle"
              icon={item.icon}
              onClick={() => onNavigate(item.id)}
              aria-current={isActive ? "page" : undefined}
              aria-label={collapsed ? item.label : undefined}
            >
              {!collapsed && <span className={styles.label}>{item.label}</span>}
            </Button>
          );

          return collapsed ? (
            <Tooltip key={item.id} content={item.label} relationship="label" positioning="after">
              {btn}
            </Tooltip>
          ) : (
            <div key={item.id}>{btn}</div>
          );
        })}
      </div>
    </nav>
  );
}
