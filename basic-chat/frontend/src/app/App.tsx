import {
  Badge,
  Body1,
  Button,
  Card,
  CardHeader,
  Dropdown,
  Field,
  Input,
  Option,
  Slider,
  Switch,
  Text,
  Textarea,
  Title3,
  makeStyles,
  shorthands,
  tokens,
} from "@fluentui/react-components";
import {
  BrainCircuit24Regular,
  ClipboardTask24Regular,
  Lightbulb24Regular,
  Send24Regular,
} from "@fluentui/react-icons";
import { useMemo, useState } from "react";
import { useAppStyles } from "./App.styles";

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

const starterMessages: Message[] = [
  {
    id: "1",
    role: "assistant",
    text:
      // "Hi. I’m your Cognitive Load Reduction Assistant.\n\nI can simplify dense information, break work into smaller steps, and help you focus on the next action.",
      "Hola. Soy tu Asistente de Reducción de Carga Cognitiva.\n\nPuedo simplificar información densa, dividir el trabajo en pasos más pequeños y ayudarte a enfocarte en la próxima acción."
  },
];

export default function App() {
  const styles = useAppStyles();

  const [messages, setMessages] = useState<Message[]>(starterMessages);
  const [draft, setDraft] = useState("");
  const [readingLevel, setReadingLevel] = useState("simple");
  const [responseFormat, setResponseFormat] = useState("steps");
  const [maxSteps, setMaxSteps] = useState(5);
  const [calmTone, setCalmTone] = useState(true);
  const [showOnlyNextStep, setShowOnlyNextStep] = useState(false);

  const quickActions = useMemo(
    () => [
      "Resume esto en lenguaje simple",
      "Divide esta tarea en pasos pequeños",
      "Ayúdame a priorizar qué hacer primero",
    ],
    []
  );

  const sendMessage = async (text?: string) => {
    const content = (text ?? draft).trim();
    if (!content) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      text: content,
    };

    setMessages((prev) => [...prev, userMessage]);
    setDraft("");

    const mockReply =
      responseFormat === "steps"
        ? `Summary:\nYou want help with: ${content}\n\nSteps:\n1. Define the immediate goal.\n2. Focus on one action only.\n3. Ignore non-urgent details for now.\n\nNext action:\nWrite the first small task you can finish in 5 minutes.`
        : `Summary:\n${content}\n\nChecklist:\n- Identify the main goal\n- Choose one priority\n- Start with the easiest next action`;

    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      text: mockReply,
    };

    setTimeout(() => {
      setMessages((prev) => [...prev, assistantMessage]);
    }, 400);
  };

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <aside className={styles.sidebar}>
          <Card className={styles.card}>
            <CardHeader
              // header={<Title3>Accessibility Preferences</Title3>}
              header={<Title3>Preferencias de Accesibilidad</Title3>}
              description={
                <Body1 className={styles.muted}>
                  {/* Configure how the assistant responds. */}
                  Configura cómo responde el asistente.
                </Body1>
              }
            />
            <div className={styles.prefsGrid}>
              <Field label="Reading level">
                <Dropdown
                  value={readingLevel}
                  selectedOptions={[readingLevel]}
                  onOptionSelect={(_, data) =>
                    setReadingLevel(data.optionValue ?? "simple")
                  }
                >
                  <Option value="simple">Simple</Option>
                  <Option value="standard">Standard</Option>
                  <Option value="beginner">Beginner-friendly</Option>
                </Dropdown>
              </Field>

              <Field label="Response format">
                <Dropdown
                  value={responseFormat}
                  selectedOptions={[responseFormat]}
                  onOptionSelect={(_, data) =>
                    setResponseFormat(data.optionValue ?? "steps")
                  }
                >
                  <Option value="steps">Step-by-step</Option>
                  <Option value="summary">Short summary</Option>
                  <Option value="checklist">Checklist</Option>
                </Dropdown>
              </Field>

              <Field
                label={`Max steps: ${maxSteps}`}
                hint="Lower values reduce cognitive load."
              >
                <Slider
                  min={3}
                  max={8}
                  value={maxSteps}
                  onChange={(_, data) => setMaxSteps(data.value)}
                />
              </Field>

              <div className={styles.rowBetween}>
                <Text>Calm tone</Text>
                <Switch
                  checked={calmTone}
                  onChange={(_, data) => setCalmTone(data.checked)}
                />
              </div>

              <div className={styles.rowBetween}>
                <Text>Show only the next step</Text>
                <Switch
                  checked={showOnlyNextStep}
                  onChange={(_, data) => setShowOnlyNextStep(data.checked)}
                />
              </div>
            </div>
          </Card>

          <Card className={styles.card}>
            <CardHeader
              header={<Title3>User Snapshot</Title3>}
              description={
                <Body1 className={styles.muted}>
                  Active profile configuration.
                </Body1>
              }
            />
            <div className={styles.badgeRow}>
              <Badge appearance="filled">Reading: {readingLevel}</Badge>
              <Badge appearance="tint">Format: {responseFormat}</Badge>
              <Badge appearance="outline">Max steps: {maxSteps}</Badge>
              {calmTone && <Badge appearance="ghost">Calm tone</Badge>}
              {showOnlyNextStep && (
                <Badge appearance="ghost">Next step only</Badge>
              )}
            </div>
          </Card>
        </aside>

        <main className={styles.main}>
          <Card className={styles.card}>
            <div className={styles.hero}>
              <div className={styles.heroText}>
                <Title3>Cognitive Load Reduction Assistant</Title3>
                <Body1 className={styles.muted}>
                  A structured assistant that simplifies dense information,
                  breaks tasks into manageable steps, and helps users focus on
                  one action at a time.
                </Body1>
                <div className={styles.badgeRow}>
                  <Badge icon={<BrainCircuit24Regular />}>Accessible</Badge>
                  <Badge icon={<ClipboardTask24Regular />}>Step-based</Badge>
                  <Badge icon={<Lightbulb24Regular />}>Focused</Badge>
                </div>
              </div>

              <Input
                appearance="filled-lighter"
                placeholder="Search future conversations"
                style={{ width: 260 }}
              />
            </div>
          </Card>

          <div className={styles.quickGrid}>
            {quickActions.map((item) => (
              <Card
                key={item}
                className={`${styles.card} ${styles.quickCard}`}
                onClick={() => sendMessage(item)}
              >
                <CardHeader
                  header={<Text weight="semibold">{item}</Text>}
                  description={
                    <Body1 className={styles.muted}>
                      Run this prompt with the current accessibility settings.
                    </Body1>
                  }
                />
              </Card>
            ))}
          </div>

          <Card className={`${styles.card} ${styles.chatCard}`}>
            <div className={styles.messages}>
              {messages.map((message) => {
                const rowClass =
                  message.role === "assistant"
                    ? styles.assistantRow
                    : styles.userRow;

                const bubbleClass =
                  message.role === "assistant"
                    ? `${styles.bubble} ${styles.assistantBubble}`
                    : `${styles.bubble} ${styles.userBubble}`;

                return (
                  <div
                    key={message.id}
                    className={`${styles.messageRow} ${rowClass}`}
                  >
                    <div className={bubbleClass}>{message.text}</div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className={`${styles.card} ${styles.composerCard}`}>
            <Field
              label="Ask for help"
              hint="Describe a task, paste dense text, or ask for a simpler explanation."
            >
              <Textarea
                className={styles.textarea}
                resize="vertical"
                rows={4}
                value={draft}
                onChange={(_, data) => setDraft(data.value)}
                placeholder="Example: I have 3 tasks due today and I feel overwhelmed. Help me prioritize them."
              />
            </Field>

            <Button
              appearance="primary"
              icon={<Send24Regular />}
              onClick={() => sendMessage()}
            >
              Send
            </Button>
          </Card>
        </main>
      </div>
    </div>
  );
}