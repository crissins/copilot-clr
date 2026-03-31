import { makeStyles, shorthands, tokens } from "@fluentui/react-components";

export const useAppStyles = makeStyles({
  page: {
    minHeight: "100vh",
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground1,
    overflowX: "hidden",
  },

  shell: {
    display: "grid",
    gridTemplateColumns: "320px 1fr",
    gap: "16px",
    maxWidth: "1400px",
    margin: "0 auto",
    padding: "16px",
    boxSizing: "border-box",
    minWidth: 0,

    "@media (max-width: 768px)": {
      gridTemplateColumns: "1fr",
      gap: "12px",
      padding: "12px",
      width: "100%",
    },
  },

  sidebar: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    minWidth: 0,
  },

  main: {
    display: "grid",
    gridTemplateRows: "auto 1fr auto",
    gap: "16px",
    minHeight: "calc(100vh - 32px)",
    minWidth: 0,

    "@media (max-width: 768px)": {
      gap: "12px",
      minHeight: "auto",
    },
  },

  card: {
    ...shorthands.padding("16px"),
    ...shorthands.borderRadius(tokens.borderRadiusXLarge),
    boxShadow: tokens.shadow8,
    boxSizing: "border-box",
    width: "100%",
    minWidth: 0,
    overflow: "hidden",

    "@media (max-width: 768px)": {
      padding: "12px",
    },
  },

  hero: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    minWidth: 0,

    "@media (max-width: 768px)": {
      flexDirection: "column",
      alignItems: "stretch",
    },
  },

  heroText: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    minWidth: 0,
  },

  quickGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "12px",
    minWidth: 0,

    "@media (max-width: 768px)": {
      gridTemplateColumns: "1fr",
    },
  },

  quickCard: {
    cursor: "pointer",
    height: "100%",
    minWidth: 0,
  },

  chatCard: {
    display: "grid",
    gridTemplateRows: "1fr",
    minHeight: "420px",
    overflow: "hidden",
    minWidth: 0,

    "@media (max-width: 768px)": {
      minHeight: "360px",
    },
  },

  messages: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    overflowY: "auto",
    overflowX: "hidden",
    ...shorthands.padding("8px", "4px"),
    minWidth: 0,
  },

  messageRow: {
    display: "flex",
    minWidth: 0,
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
    wordBreak: "break-word",
    overflowWrap: "anywhere",
    lineHeight: "1.5",
    minWidth: 0,

    "@media (max-width: 768px)": {
      maxWidth: "100%",
      padding: "10px 12px",
    },
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
    minWidth: 0,

    "@media (max-width: 768px)": {
      gridTemplateColumns: "1fr",
    },
  },

  textarea: {
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
  },

  prefsGrid: {
    display: "grid",
    gap: "14px",
    minWidth: 0,
  },

  rowBetween: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    minWidth: 0,

    "@media (max-width: 768px)": {
      flexDirection: "column",
      alignItems: "stretch",
    },
  },

  muted: {
    color: tokens.colorNeutralForeground3,
  },

  badgeRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    minWidth: 0,
  },

  markdownContent: {
    minWidth: 0,

    "& h1": {
      marginTop: "0",
      marginBottom: "8px",
      fontSize: "1.5rem",
    },
    "& h2": {
      marginTop: "0",
      marginBottom: "8px",
      fontSize: "1.3rem",
    },
    "& h3": {
      marginTop: "0",
      marginBottom: "8px",
      fontSize: "1.1rem",
    },
    "& p": {
      marginTop: "0",
      marginBottom: "8px",
      lineHeight: "1.4",
      wordBreak: "break-word",
      overflowWrap: "anywhere",
    },
    "& ul, & ol": {
      marginTop: "0",
      marginBottom: "8px",
      paddingLeft: "20px",
    },
    "& li": {
      marginBottom: "6px",
      lineHeight: "1.4",
    },
    "& li p": {
      marginTop: "0",
      marginBottom: "4px",
    },
    "& li > p:first-child": {
      marginTop: "0",
    },
    "& li > p:last-child": {
      marginBottom: "0",
    },
    "& strong": {
      fontWeight: 700,
    },

    "@media (max-width: 768px)": {
      "& h1": {
        fontSize: "1.25rem",
      },
      "& h2": {
        fontSize: "1.15rem",
      },
      "& h3": {
        fontSize: "1rem",
      },
    },
  },
});