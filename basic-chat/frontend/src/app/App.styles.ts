import { makeStyles, shorthands, tokens } from "@fluentui/react-components";

export const useAppStyles = makeStyles({
  page: {
    minHeight: "100vh",
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground1,
  },
  shell: {
    display: "grid",
    gridTemplateColumns: "320px 1fr",
    gap: "16px",
    maxWidth: "1400px",
    margin: "0 auto",
    padding: "16px",
    boxSizing: "border-box",
  },
  sidebar: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  main: {
    display: "grid",
    gridTemplateRows: "auto 1fr auto",
    gap: "16px",
    minHeight: "calc(100vh - 32px)",
  },
  card: {
    ...shorthands.padding("16px"),
    ...shorthands.borderRadius(tokens.borderRadiusXLarge),
    boxShadow: tokens.shadow8,
  },
  hero: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
  },
  heroText: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  quickGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "12px",
  },
  quickCard: {
    cursor: "pointer",
    height: "100%",
  },
  chatCard: {
    display: "grid",
    gridTemplateRows: "1fr",
    minHeight: "420px",
    overflow: "hidden",
  },
  messages: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    overflowY: "auto",
    ...shorthands.padding("8px", "4px"),
  },
  messageRow: {
    display: "flex",
  },
  assistantRow: {
    justifyContent: "flex-start",
  },
  userRow: {
    justifyContent: "flex-end",
  },
  bubble: {
    maxWidth: "78%",
    ...shorthands.padding("12px", "14px"),
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    whiteSpace: "pre-wrap",
    lineHeight: "1.5",
  },
  assistantBubble: {
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  userBubble: {
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorNeutralForeground1,
  },
  composerCard: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: "12px",
    alignItems: "end",
  },
  textarea: {
    width: "100%",
  },
  prefsGrid: {
    display: "grid",
    gap: "14px",
  },
  rowBetween: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
  },
  muted: {
    color: tokens.colorNeutralForeground3,
  },
  badgeRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
});