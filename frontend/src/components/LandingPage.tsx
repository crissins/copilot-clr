import {
  makeStyles,
  tokens,
  shorthands,
  Text,
  Button,
  Card,
  CardHeader,
} from "@fluentui/react-components";
import {
  BrainCircuit24Regular,
  DocumentTextExtract24Regular,
  Speaker224Regular,
  Accessibility24Regular,
  CalendarClock24Regular,
  ShieldCheckmark24Regular,
  ArrowRight16Regular,
} from "@fluentui/react-icons";
import { useAuth } from "../hooks/useAuth";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    ...shorthands.padding("40px", "24px"),
    overflowY: "auto",
    textAlign: "center",
  },
  hero: {
    maxWidth: "640px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "16px",
    marginBottom: "40px",
  },
  logo: {
    width: "72px",
    height: "72px",
    ...shorthands.borderRadius("16px"),
    backgroundColor: tokens.colorBrandBackground,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: tokens.colorNeutralForegroundOnBrand,
    fontSize: "36px",
    marginBottom: "8px",
  },
  title: {
    fontSize: tokens.fontSizeHero800,
    fontWeight: tokens.fontWeightBold,
    lineHeight: tokens.lineHeightHero800,
    color: tokens.colorNeutralForeground1,
  },
  subtitle: {
    fontSize: tokens.fontSizeBase400,
    color: tokens.colorNeutralForeground2,
    lineHeight: tokens.lineHeightBase400,
    maxWidth: "520px",
  },
  signInBtn: {
    marginTop: "8px",
    minWidth: "220px",
    height: "44px",
    fontSize: tokens.fontSizeBase400,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "16px",
    maxWidth: "720px",
    width: "100%",
    marginBottom: "32px",
  },
  featureCard: {
    textAlign: "left",
    ...shorthands.padding("16px"),
  },
  featureIcon: {
    color: tokens.colorBrandForeground1,
    fontSize: "20px",
  },
  featureTitle: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
  },
  featureDesc: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
    marginTop: "4px",
  },
  footer: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    marginTop: "12px",
  },
});

const features = [
  {
    icon: <BrainCircuit24Regular />,
    title: "AI Task Breakdown",
    desc: "Complex instructions become clear, numbered steps.",
  },
  {
    icon: <DocumentTextExtract24Regular />,
    title: "Document Simplifier",
    desc: "Dense text adapted to your reading level.",
  },
  {
    icon: <Speaker224Regular />,
    title: "Voice In & Out",
    desc: "Speak naturally; listen to responses aloud.",
  },
  {
    icon: <Accessibility24Regular />,
    title: "Immersive Reader",
    desc: "Built-in reading tools for dyslexia and focus.",
  },
  {
    icon: <CalendarClock24Regular />,
    title: "Smart Reminders",
    desc: "Gentle nudges so nothing falls through the cracks.",
  },
  {
    icon: <ShieldCheckmark24Regular />,
    title: "Safe & Calm",
    desc: "Content-filtered, anxiety-aware responses.",
  },
];

export function LandingPage() {
  const styles = useStyles();
  const { login, isLoading } = useAuth();

  return (
    <div className={styles.root}>
      <div className={styles.hero}>
        <div className={styles.logo} aria-hidden>
          <BrainCircuit24Regular style={{ fontSize: 36, width: 36, height: 36 }} />
        </div>
        <Text as="h1" className={styles.title}>
          Copilot CLR
        </Text>
        <Text className={styles.subtitle}>
          An AI-powered accessibility assistant designed for neurodiverse minds.
          Sign in with your Microsoft account to get started.
        </Text>
        <Button
          appearance="primary"
          size="large"
          className={styles.signInBtn}
          icon={<ArrowRight16Regular />}
          iconPosition="after"
          onClick={login}
          disabled={isLoading}
        >
          {isLoading ? "Signing in…" : "Sign in with Microsoft"}
        </Button>
      </div>

      <div className={styles.grid}>
        {features.map((f) => (
          <Card key={f.title} className={styles.featureCard} size="small">
            <CardHeader
              image={<span className={styles.featureIcon}>{f.icon}</span>}
              header={<Text className={styles.featureTitle}>{f.title}</Text>}
              description={<Text className={styles.featureDesc}>{f.desc}</Text>}
            />
          </Card>
        ))}
      </div>

      <Text className={styles.footer}>
        Works with any Microsoft account — Outlook, Hotmail, or organization.
      </Text>
    </div>
  );
}
