/**
 * About Page — How to use the app, feature descriptions, and icon legend.
 */

import { Text, Card, Badge, Button, makeStyles, tokens, shorthands } from "@fluentui/react-components";
import {
  Chat24Regular,
  TextBulletListSquare24Regular,
  Clock24Regular,
  TasksApp24Regular,
  Accessibility24Regular,
  Record24Regular,
  Person24Regular,
  Headset24Regular,
  ChatBubblesQuestion24Regular,
  Settings24Regular,
  Speaker224Regular,
  ImmersiveReader24Regular,
  Save24Regular,
  Delete24Regular,
  Sparkle24Regular,
  ArrowUp16Regular,
  ArrowRight16Regular,
  ArrowDown16Regular,
  Info24Regular,
  Open24Regular,
} from "@fluentui/react-icons";
import type { ReactNode } from "react";

// ── Styles ──────────────────────────────────────────────────────────────────

const useStyles = makeStyles({
  page: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
  },
  scrollArea: {
    flex: 1,
    overflowY: "auto",
    overflowX: "hidden",
  },
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "28px",
    maxWidth: "820px",
    marginLeft: "auto",
    marginRight: "auto",
    ...shorthands.padding("32px", "24px", "80px"),
    width: "100%",
  },
  hero: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
    textAlign: "center",
    ...shorthands.padding("12px", "0", "4px"),
  },
  heroIcon: {
    width: "56px",
    height: "56px",
    ...shorthands.borderRadius("50%"),
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    fontSize: "24px",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  sectionTitle: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightBold,
    color: tokens.colorNeutralForeground1,
  },
  featureCard: {
    ...shorthands.padding("16px", "20px"),
    display: "flex",
    alignItems: "flex-start",
    gap: "16px",
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
  },
  featureIcon: {
    width: "44px",
    height: "44px",
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    flexShrink: 0,
  },
  featureBody: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    flex: 1,
    minWidth: 0,
  },
  iconGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: "16px",
  },
  iconItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    ...shorthands.padding("8px", "12px"),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    backgroundColor: tokens.colorNeutralBackground3,
    minWidth: "180px",
  },
  tip: {
    ...shorthands.padding("14px", "18px"),
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
  },
});

// ── Data ────────────────────────────────────────────────────────────────────

interface FeatureInfo {
  icon: ReactNode;
  title: string;
  description: string;
  howToUse: string;
  route: string;
}

const FEATURES: FeatureInfo[] = [
  {
    icon: <Chat24Regular />,
    title: "Chat",
    route: "chat",
    description:
      "Your AI assistant for answering questions, searching uploaded documents, and getting help with anything. Conversations are saved automatically.",
    howToUse:
      "Type a message and press Enter. The assistant can search your uploaded documents, break down tasks, and more. Previous conversations load automatically.",
  },
  {
    icon: <TextBulletListSquare24Regular />,
    title: "Simplify Content",
    route: "feature2",
    description:
      "Adapts complex text, documents, or web content into a simpler format suited to your accessibility profile (e.g. low-literacy, ADHD, dyslexia).",
    howToUse:
      "Upload a document or paste text. Select your reading profile and click Adapt. The AI rewrites it using shorter sentences and clearer language.",
  },
  {
    icon: <Clock24Regular />,
    title: "Reminders & Focus",
    route: "feature3",
    description:
      "Set timed reminders and focus sessions. The app will notify you when it's time to take a break or move to the next task.",
    howToUse:
      "Create a reminder with a title and time. Use Focus Mode to start a timed work session with built-in break alerts.",
  },
  {
    icon: <TasksApp24Regular />,
    title: "Task Decomposer",
    route: "feature5",
    description:
      "Breaks a complex goal into numbered, time-boxed steps with priority, estimated duration, and focus tips — designed for neurodiverse users.",
    howToUse:
      "Type a goal (e.g. 'Write a research essay') and press Break it down. Check off steps as you complete them. Use the Save button to keep plans for later.",
  },
  {
    icon: <Accessibility24Regular />,
    title: "Accessibility Hub",
    route: "feature6",
    description:
      "Customize the app's visual settings — font size, font family, line spacing, color overlays, high contrast, and more.",
    howToUse:
      "Open the hub to adjust fonts, colors, and spacing. Changes apply across the entire app instantly. Run the onboarding wizard from Settings to set up preferences.",
  },
  {
    icon: <Record24Regular />,
    title: "Speech Assistant",
    route: "feature7",
    description:
      "An AI assistant you can talk to. Ask questions by voice and receive spoken responses with optional text transcripts.",
    howToUse:
      "Click the microphone to start recording. Speak your question. The assistant responds with both text and audio playback.",
  },
  {
    icon: <Person24Regular />,
    title: "Talking Avatar",
    route: "avatar",
    description:
      "A video avatar that reads content aloud. Useful for document or task summaries delivered as a short video clip.",
    howToUse:
      "Enter text or select content, then click Generate Avatar. The AI creates a short video of an avatar speaking the content.",
  },
  {
    icon: <Headset24Regular />,
    title: "Voice Live",
    route: "voicelive",
    description:
      "Real-time speech-to-text and text-to-speech with live transcription. Great for live note-taking or following along with audio.",
    howToUse:
      "Start a live session. Speak or play audio — the app transcribes in real time. You can pause, resume, and export the transcript.",
  },
  {
    icon: <ChatBubblesQuestion24Regular />,
    title: "Feedback",
    route: "feedback",
    description:
      "Share your experience, rate the app, and suggest improvements. Your feedback helps make the app better for everyone.",
    howToUse:
      "Rate with stars, choose a category, and write your thoughts. Submit to send. You can view and delete past feedback from the history panel.",
  },
];

interface IconLegendItem {
  icon: ReactNode;
  label: string;
}

const ICON_LEGEND: IconLegendItem[] = [
  { icon: <Speaker224Regular />, label: "Read Aloud — Listen to the text" },
  { icon: <ImmersiveReader24Regular />, label: "Immersive Reader — Focused reading view" },
  { icon: <Save24Regular />, label: "Save — Keep for later" },
  { icon: <Delete24Regular />, label: "Delete — Remove item" },
  { icon: <Sparkle24Regular />, label: "AI Action — Powered by AI" },
  { icon: <ArrowUp16Regular />, label: "High priority" },
  { icon: <ArrowRight16Regular />, label: "Medium priority" },
  { icon: <ArrowDown16Regular />, label: "Low priority" },
  { icon: <Settings24Regular />, label: "Settings — Customize the app" },
];

// ── Component ───────────────────────────────────────────────────────────────

export function AboutPage({ onNavigate }: { onNavigate?: (viewId: string) => void }) {
  const styles = useStyles();

  return (
    <div className={styles.page}>
      <div className={styles.scrollArea}>
        <div className={styles.container}>
          {/* Hero */}
          <div className={styles.hero}>
            <div className={styles.heroIcon}>
              <Info24Regular />
            </div>
            <Text size={700} weight="bold">
              About Copilot CLR
            </Text>
            <Text size={400} style={{ color: tokens.colorNeutralForeground3, maxWidth: "520px" }}>
              Copilot CLR (Cognitive Load Reducer) helps neurodiverse users
              navigate complex tasks, documents, and learning by adapting
              content, decomposing goals, and providing accessible tools — all
              powered by AI.
            </Text>
          </div>

          {/* Getting Started */}
          <div className={styles.section}>
            <Text className={styles.sectionTitle}>Getting Started</Text>
            <div className={styles.tip}>
              <Sparkle24Regular style={{ color: tokens.colorBrandForeground1, flexShrink: 0 }} />
              <Text size={300} style={{ lineHeight: tokens.lineHeightBase400 }}>
                Start by chatting with the AI assistant — just type a question in the
                <strong> Chat</strong> page. You can also upload documents and the AI will
                search them for answers. Use the sidebar on the left to navigate between
                features. Each feature is designed with accessibility in mind — take
                your time and explore at your own pace.
              </Text>
            </div>
          </div>

          {/* Features */}
          <div className={styles.section}>
            <Text className={styles.sectionTitle}>Features</Text>
            {FEATURES.map((f) => (
              <Card key={f.title} className={styles.featureCard}>
                <div className={styles.featureIcon}>{f.icon}</div>
                <div className={styles.featureBody}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Text size={400} weight="semibold" style={{ flex: 1 }}>{f.title}</Text>
                    {onNavigate && (
                      <Button
                        appearance="subtle"
                        size="small"
                        icon={<Open24Regular />}
                        onClick={() => onNavigate(f.route)}
                      >
                        Try it
                      </Button>
                    )}
                  </div>
                  <Text size={300} style={{ color: tokens.colorNeutralForeground2 }}>
                    {f.description}
                  </Text>
                  <Badge appearance="outline" size="small" style={{ alignSelf: "flex-start", marginTop: "4px" }}>
                    How to use
                  </Badge>
                  <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                    {f.howToUse}
                  </Text>
                </div>
              </Card>
            ))}
          </div>

          {/* Icon Legend */}
          <div className={styles.section}>
            <Text className={styles.sectionTitle}>Icon Legend</Text>
            <Text size={300} style={{ color: tokens.colorNeutralForeground3 }}>
              These icons appear throughout the app. Here's what they mean:
            </Text>
            <div className={styles.iconGrid}>
              {ICON_LEGEND.map((item) => (
                <div key={item.label} className={styles.iconItem}>
                  <span style={{ color: tokens.colorBrandForeground1, display: "flex" }}>{item.icon}</span>
                  <Text size={200}>{item.label}</Text>
                </div>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div className={styles.section}>
            <Text className={styles.sectionTitle}>Tips</Text>
            <div className={styles.tip}>
              <Info24Regular style={{ color: tokens.colorPaletteYellowForeground1, flexShrink: 0 }} />
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <Text size={300}><strong>Keyboard shortcut:</strong> Press Enter to send a chat message. Use Shift+Enter for a new line.</Text>
                <Text size={300}><strong>Accessibility:</strong> Open the Accessibility Hub or Settings to change font, spacing, colors, and reading preferences at any time.</Text>
                <Text size={300}><strong>Task plans:</strong> After decomposing a task, click the checkmark on each step to track your progress. Use Save to keep the plan for later.</Text>
                <Text size={300}><strong>Documents:</strong> Upload PDFs, Word files, or images. The AI can read and answer questions about them in Chat.</Text>
              </div>
            </div>
          </div>

          {/* Built With */}
          <div className={styles.section}>
            <Text className={styles.sectionTitle}>Built With</Text>
            <Card className={styles.featureCard} style={{ flexDirection: "column", gap: "8px" }}>
              <Text size={300} style={{ color: tokens.colorNeutralForeground2, lineHeight: tokens.lineHeightBase400 }}>
                Copilot CLR is built on Microsoft Azure and designed with accessibility-first principles.
              </Text>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" }}>
                {[
                  "Azure AI Foundry", "Azure OpenAI", "Azure AI Search", "Azure Cosmos DB",
                  "Azure Container Apps", "Azure Static Web Apps", "Azure AI Speech",
                  "Azure Document Intelligence", "Azure Communication Services",
                  "React", "Fluent UI", "Python / FastAPI",
                ].map((tech) => (
                  <Badge key={tech} appearance="tint" size="medium" color="brand">{tech}</Badge>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
