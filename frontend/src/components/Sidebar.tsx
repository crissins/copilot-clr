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
  CalendarClock24Regular,
  VideoClip24Regular,
  TaskListSquareLtr24Regular,
  PersonVoice24Regular,
  Record24Regular,
  ChevronLeft24Regular,
  ChevronRight24Regular,
  Settings24Regular,
  ChatBubblesQuestion24Regular,
} from "@fluentui/react-icons";
import { useI18n } from "../I18nContext";

export interface NavItem {
  id: string;
  label: string;
  icon: JSX.Element;
}

const NAV_ITEM_ICONS: Record<string, JSX.Element> = {
  chat: <Chat24Regular />,
  feature1: <DocumentBulletList24Regular />,
  feature2: <TextGrammarSettings24Regular />,
  feature3: <CalendarClock24Regular />,  // Reminders & Focus
  feature4: <VideoClip24Regular />,
  feature5: <TaskListSquareLtr24Regular />,  // Task Decomposer
  feature6: <PersonVoice24Regular />,
  feature7: <Record24Regular />,
  feedback: <ChatBubblesQuestion24Regular />,
};

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
  const { t } = useI18n();

  const NAV_ITEMS: NavItem[] = [
    { id: "chat",     label: t.nav.chat,              icon: NAV_ITEM_ICONS.chat },
    { id: "feature1", label: t.nav.documentUpload,    icon: NAV_ITEM_ICONS.feature1 },
    { id: "feature2", label: t.nav.simplifyContent,   icon: NAV_ITEM_ICONS.feature2 },
    { id: "feature3", label: t.nav.remindersFocus,    icon: NAV_ITEM_ICONS.feature3 },
    { id: "feature4", label: t.nav.mediaProcessing,   icon: NAV_ITEM_ICONS.feature4 },
    { id: "feature5", label: t.nav.taskDecomposer,    icon: NAV_ITEM_ICONS.feature5 },
    { id: "feature6", label: t.nav.accessibilityHub,  icon: NAV_ITEM_ICONS.feature6 },
    { id: "feature7", label: t.nav.speechAssistant,   icon: NAV_ITEM_ICONS.feature7 },
    { id: "feedback",  label: t.nav.feedback,           icon: NAV_ITEM_ICONS.feedback },
  ];

  const BOTTOM_ITEMS: NavItem[] = [
    { id: "settings", label: t.nav.settings, icon: <Settings24Regular /> },
  ];

  return (
    <nav
      className={mergeClasses(styles.nav, collapsed && styles.navCollapsed)}
      aria-label="Main navigation"
    >
      {/* Collapse toggle */}
      <div className={styles.toggleRow}>
        <Tooltip
          content={collapsed ? t.nav.expandNav : t.nav.collapseNav}
          relationship="label"
          positioning="after"
        >
          <Button
            appearance="subtle"
            icon={collapsed ? <ChevronRight24Regular /> : <ChevronLeft24Regular />}
            onClick={onToggle}
            aria-label={collapsed ? t.nav.expandNav : t.nav.collapseNav}
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
