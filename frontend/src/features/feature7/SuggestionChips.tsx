import {
  makeStyles,
  tokens,
  shorthands,
  Text,
} from "@fluentui/react-components";
import {
  Lightbulb24Regular,
  DocumentText24Regular,
  TaskListSquareLtr24Regular,
  BrainCircuit24Regular,
} from "@fluentui/react-icons";

interface SuggestionChip {
  label: string;
  prompt: string;
  icon: JSX.Element;
}

const SUGGESTIONS: SuggestionChip[] = [
  {
    label: "Break down a task",
    prompt:
      "Help me break down this task into small, manageable steps with time estimates",
    icon: <TaskListSquareLtr24Regular />,
  },
  {
    label: "Simplify a document",
    prompt: "Simplify and summarize the following in easy-to-read bullet points",
    icon: <DocumentText24Regular />,
  },
  {
    label: "Focus support",
    prompt:
      "I'm feeling overwhelmed. Help me prioritize what to do next and set a focus timer",
    icon: <BrainCircuit24Regular />,
  },
  {
    label: "Explain something simply",
    prompt: "Explain this to me in the simplest way possible, step by step",
    icon: <Lightbulb24Regular />,
  },
];

interface Props {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    justifyContent: "center",
    ...shorthands.padding("8px", "0"),
  },
  chip: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    ...shorthands.padding("10px", "16px"),
    ...shorthands.borderRadius(tokens.borderRadiusXLarge),
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke1),
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground2,
    cursor: "pointer",
    transition: "all 150ms ease",
    maxWidth: "220px",
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
      ...shorthands.border("1px", "solid", tokens.colorBrandStroke1),
      color: tokens.colorBrandForeground1,
      transform: "translateY(-1px)",
      boxShadow: tokens.shadow4,
    },
    ":focus-visible": {
      outlineWidth: "2px",
      outlineStyle: "solid",
      outlineColor: tokens.colorBrandStroke1,
      outlineOffset: "2px",
    },
  },
  chipLabel: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: tokens.lineHeightBase200,
  },
  chipIcon: {
    flexShrink: 0,
    color: tokens.colorBrandForeground2,
    fontSize: "18px",
  },
});

export function SuggestionChips({ onSelect, disabled }: Props) {
  const styles = useStyles();

  return (
    <div className={styles.root} role="group" aria-label="Suggested prompts">
      {SUGGESTIONS.map((s) => (
        <button
          key={s.label}
          className={styles.chip}
          onClick={() => onSelect(s.prompt)}
          disabled={disabled}
          aria-label={`Suggestion: ${s.label}`}
        >
          <span className={styles.chipIcon}>{s.icon}</span>
          <Text className={styles.chipLabel}>{s.label}</Text>
        </button>
      ))}
    </div>
  );
}
