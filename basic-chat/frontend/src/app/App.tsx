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
} from "@fluentui/react-components";
import {
  BrainCircuit24Regular,
  ClipboardTask24Regular,
  Lightbulb24Regular,
  Send24Regular,
} from "@fluentui/react-icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
    text: "Hi. I’m your Cognitive Load Reduction Assistant.\n\nI can simplify dense information, break work into smaller steps, and help you focus on the next action.",
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
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const normalizeMarkdown = (text: string) =>
    text
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

  const quickActions = useMemo(
    () =>
      showOnlyNextStep
        ? [
          "I feel overwhelmed. Give me only the next step.",
          "I am stuck on a task. Tell me the next action only.",
          "Help me start this without giving me too much information.",
        ]
        : [
          "Summarize this in simple language",
          "Break this task into small steps",
          "Help me prioritize what to do first",
        ],
    [showOnlyNextStep]
  );

  const sendMessage = async (text?: string) => {
    const content = (text ?? draft).trim();
    if (!content || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      text: content,
    };

    setMessages((prev) => [...prev, userMessage]);
    setDraft("");
    setIsLoading(true);

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

    try {
      const response = await fetch(API_BASE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: content,
          preferences: {
            readingLevel,
            responseFormat,
            maxSteps,
            calmTone,
            showOnlyNextStep,
          },
          conversationId,
        }),
      });

      if (!response.ok) {
        throw new Error("Backend request failed");
      }

      const data = await response.json();

      setConversationId(data.conversationId);

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: data.reply,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error(error);

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: "Sorry, I’m having trouble responding right now. Please try again.",
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <aside className={styles.sidebar}>
          <Card className={styles.card}>
            <CardHeader
              header={<Title3>Accessibility Preferences</Title3>}
              description={
                <Body1 className={styles.muted}>
                  Configure how the assistant responds.
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
                  {showOnlyNextStep && (
                    <Badge appearance="filled">Next-step mode active</Badge>
                  )}
                </div>
              </div>

              <Input
                appearance="filled-lighter"
                placeholder="Search future conversations"
                style={{ width: "100%", maxWidth: 260 }}
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
                    <div className={`${bubbleClass} ${styles.markdownContent}`}>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          h1: ({ children }) => <h1>{children}</h1>,
                          h2: ({ children }) => <h2>{children}</h2>,
                          h3: ({ children }) => <h3>{children}</h3>,
                          p: ({ children }) => <p>{children}</p>,
                          ul: ({ children }) => <ul>{children}</ul>,
                          ol: ({ children }) => <ol>{children}</ol>,
                          li: ({ children }) => <li>{children}</li>,
                          strong: ({ children }) => <strong>{children}</strong>,
                        }}
                      >
                        {normalizeMarkdown(message.text)}
                      </ReactMarkdown>
                    </div>
                  </div>
                );
              })}

              {isLoading && (
                <div className={`${styles.messageRow} ${styles.assistantRow}`}>
                  <div className={`${styles.bubble} ${styles.assistantBubble}`}>
                    Thinking...
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card className={`${styles.card} ${styles.composerCard}`}>
            <Field
              label="Ask for help"
              hint={
                showOnlyNextStep
                  ? "Describe where you're stuck and the assistant will return only the next action."
                  : "Describe a task, paste dense text, or ask for a simpler explanation."
              }
            >
              <Textarea
                className={styles.textarea}
                resize="vertical"
                rows={4}
                value={draft}
                onChange={(_, data) => setDraft(data.value)}
                placeholder={
                  showOnlyNextStep
                    ? "Example: I feel stuck starting my homework. Tell me only the next step."
                    : "Example: I have 3 tasks due today and I feel overwhelmed. Help me prioritize them."
                }
              />
            </Field>

            <Button
              appearance="primary"
              icon={<Send24Regular />}
              onClick={() => sendMessage()}
              disabled={isLoading}
            >
              {isLoading ? "Sending..." : showOnlyNextStep ? "Get next step" : "Send"}
            </Button>
          </Card>
        </main>
      </div>
    </div>
  );
}