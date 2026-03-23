import { useState, useCallback } from "react";
import {
  makeStyles,
  tokens,
  shorthands,
  Text,
  Button,
  Select,
  Switch,
  Slider,
  Divider,
  Spinner,
  MessageBar,
  MessageBarBody,
  Card,
  CardHeader,
} from "@fluentui/react-components";
import {
  TextFont24Regular,
  Eye24Regular,
  Speaker224Regular,
  BrainCircuit24Regular,
  Accessibility24Regular,
  Save24Regular,
  ArrowReset24Regular,
  Person24Regular,
} from "@fluentui/react-icons";
import { useSettings } from "../hooks/useSettings";
import type { NeurodiverseSettings } from "../services/api";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflowY: "auto",
    backgroundColor: tokens.colorNeutralBackground1,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    ...shorthands.padding("24px", "32px", "16px"),
    flexShrink: 0,
  },
  headerTitle: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  headerActions: {
    display: "flex",
    gap: "8px",
  },
  content: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    ...shorthands.padding("0", "32px", "32px"),
    maxWidth: "800px",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    ...shorthands.padding("8px", "0"),
  },
  fieldGroup: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
    ...shorthands.padding("8px", "16px", "16px"),
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  fieldLabel: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  },
  switchField: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    ...shorthands.padding("4px", "0"),
  },
  sliderField: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  loadingCenter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  savedBar: {
    position: "fixed" as const,
    bottom: "24px",
    right: "24px",
    zIndex: 1000,
  },
  profileInfo: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    ...shorthands.padding("12px", "16px"),
  },
  profileDetails: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
});

export function SettingsPage() {
  const styles = useStyles();
  const { settings, loading, saving, error, updateSettings } = useSettings();
  const [draft, setDraft] = useState<Partial<NeurodiverseSettings>>({});
  const [saved, setSaved] = useState(false);

  const current = { ...settings, ...draft } as NeurodiverseSettings;

  const updateDraft = useCallback(
    <K extends keyof NeurodiverseSettings>(key: K, value: NeurodiverseSettings[K]) => {
      setDraft((prev) => ({ ...prev, [key]: value }));
      setSaved(false);
    },
    [],
  );

  const handleSave = async () => {
    try {
      await updateSettings(draft);
      setDraft({});
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // error is surfaced via the hook
    }
  };

  const handleReset = () => {
    setDraft({});
    setSaved(false);
  };

  if (loading) {
    return (
      <div className={styles.loadingCenter}>
        <Spinner label="Loading your settings…" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className={styles.loadingCenter}>
        <MessageBar intent="error">
          <MessageBarBody>Unable to load settings. Please try again later.</MessageBarBody>
        </MessageBar>
      </div>
    );
  }

  const hasDraftChanges = Object.keys(draft).length > 0;

  return (
    <div className={styles.root}>
      {/* Page Header */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <Accessibility24Regular />
          <Text size={700} weight="bold">
            Accessibility Settings
          </Text>
        </div>
        <div className={styles.headerActions}>
          {hasDraftChanges && (
            <Button
              appearance="subtle"
              icon={<ArrowReset24Regular />}
              onClick={handleReset}
            >
              Discard
            </Button>
          )}
          <Button
            appearance="primary"
            icon={<Save24Regular />}
            onClick={handleSave}
            disabled={!hasDraftChanges || saving}
          >
            {saving ? "Saving…" : "Save Settings"}
          </Button>
        </div>
      </div>

      {error && (
        <div style={{ padding: "0 32px" }}>
          <MessageBar intent="error">
            <MessageBarBody>{error}</MessageBarBody>
          </MessageBar>
        </div>
      )}

      <div className={styles.content}>        {/* ── Profile Info ─────────────────────────────────────── */}
        <Card>
          <div className={styles.profileInfo}>
            <Person24Regular />
            <div className={styles.profileDetails}>
              <Text weight="semibold" size={400}>
                {current.displayName || "User"}
              </Text>
              <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                {current.email || current.userId}
              </Text>
            </div>
          </div>
        </Card>

        <Divider />
        {/* ── Reading & Comprehension ────────────────────────── */}
        <Card>
          <CardHeader
            image={<TextFont24Regular />}
            header={<Text weight="semibold" size={500}>Reading &amp; Comprehension</Text>}
            description="Adjust how content is presented to match your reading preferences"
          />
          <div className={styles.fieldGroup}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Reading Level</label>
              <Select
                value={current.readingLevel}
                onChange={(_e, data) => updateDraft("readingLevel", data.value)}
              >
                <option value="Grade 2">Grade 2 (Very Easy)</option>
                <option value="Grade 5">Grade 5 (Easy)</option>
                <option value="Grade 8">Grade 8 (Standard)</option>
                <option value="Grade 12">Grade 12 (Advanced)</option>
              </Select>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Preferred Format</label>
              <Select
                value={current.preferredFormat}
                onChange={(_e, data) => updateDraft("preferredFormat", data.value)}
              >
                <option value="bullet points">Bullet Points</option>
                <option value="numbered steps">Numbered Steps</option>
                <option value="paragraphs">Paragraphs</option>
                <option value="table">Table</option>
              </Select>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Response Length</label>
              <Select
                value={current.responseLengthPreference}
                onChange={(_e, data) => updateDraft("responseLengthPreference", data.value)}
              >
                <option value="short">Short &amp; Concise</option>
                <option value="medium">Medium</option>
                <option value="detailed">Detailed</option>
              </Select>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Language</label>
              <Select
                value={current.language}
                onChange={(_e, data) => updateDraft("language", data.value)}
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="pt">Portuguese</option>
                <option value="zh">Chinese</option>
                <option value="ja">Japanese</option>
                <option value="ar">Arabic</option>
              </Select>
            </div>
          </div>
        </Card>

        <Divider />

        {/* ── Visual & Display ───────────────────────────────── */}
        <Card>
          <CardHeader
            image={<Eye24Regular />}
            header={<Text weight="semibold" size={500}>Visual &amp; Display</Text>}
            description="Customize the visual presentation for comfortable reading"
          />
          <div className={styles.fieldGroup}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Font Size</label>
              <Select
                value={current.fontSize}
                onChange={(_e, data) => updateDraft("fontSize", data.value)}
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
                <option value="x-large">Extra Large</option>
              </Select>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Font Family</label>
              <Select
                value={current.fontFamily}
                onChange={(_e, data) => updateDraft("fontFamily", data.value)}
              >
                <option value="default">System Default</option>
                <option value="OpenDyslexic">OpenDyslexic</option>
                <option value="Comic Sans MS">Comic Sans MS</option>
                <option value="Arial">Arial</option>
                <option value="Verdana">Verdana</option>
              </Select>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Line Spacing</label>
              <Select
                value={current.lineSpacing}
                onChange={(_e, data) => updateDraft("lineSpacing", data.value)}
              >
                <option value="compact">Compact (1.2)</option>
                <option value="normal">Normal (1.5)</option>
                <option value="relaxed">Relaxed (1.8)</option>
                <option value="spacious">Spacious (2.0)</option>
              </Select>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Text Alignment</label>
              <Select
                value={current.textAlignment}
                onChange={(_e, data) => updateDraft("textAlignment", data.value)}
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="justify">Justified</option>
              </Select>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Color Overlay</label>
              <Select
                value={current.colorOverlay}
                onChange={(_e, data) => updateDraft("colorOverlay", data.value)}
              >
                <option value="none">None</option>
                <option value="yellow">Yellow (warm)</option>
                <option value="blue">Blue (cool)</option>
                <option value="green">Green (calming)</option>
                <option value="pink">Pink (soft)</option>
                <option value="peach">Peach</option>
              </Select>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Theme</label>
              <Select
                value={current.theme}
                onChange={(_e, data) => updateDraft("theme", data.value)}
              >
                <option value="system">System Default</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </Select>
            </div>
          </div>

          <div style={{ padding: "0 16px 16px" }}>
            <div className={styles.switchField}>
              <Text>High Contrast Mode</Text>
              <Switch
                checked={current.highContrast}
                onChange={(_e, data) => updateDraft("highContrast", data.checked)}
              />
            </div>
            <div className={styles.switchField}>
              <Text>Dyslexia-Friendly Font</Text>
              <Switch
                checked={current.dyslexiaFont}
                onChange={(_e, data) => updateDraft("dyslexiaFont", data.checked)}
              />
            </div>
            <div className={styles.switchField}>
              <Text>Reduced Motion</Text>
              <Switch
                checked={current.reducedMotion}
                onChange={(_e, data) => updateDraft("reducedMotion", data.checked)}
              />
            </div>
          </div>
        </Card>

        <Divider />

        {/* ── Audio & Speech ─────────────────────────────────── */}
        <Card>
          <CardHeader
            image={<Speaker224Regular />}
            header={<Text weight="semibold" size={500}>Audio &amp; Speech</Text>}
            description="Control voice output and text-to-speech behavior"
          />
          <div className={styles.fieldGroup}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Voice Speed</label>
              <Select
                value={current.voiceSpeed}
                onChange={(_e, data) => updateDraft("voiceSpeed", data.value)}
              >
                <option value="0.5">Very Slow (0.5x)</option>
                <option value="0.75">Slow (0.75x)</option>
                <option value="1.0">Normal (1.0x)</option>
                <option value="1.25">Slightly Fast (1.25x)</option>
                <option value="1.5">Fast (1.5x)</option>
              </Select>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Preferred Voice</label>
              <Select
                value={current.preferredVoice}
                onChange={(_e, data) => updateDraft("preferredVoice", data.value)}
              >
                <option value="default">Default</option>
                <option value="en-US-JennyNeural">Jenny (warm, calm)</option>
                <option value="en-US-GuyNeural">Guy (steady)</option>
                <option value="en-US-AriaNeural">Aria (friendly)</option>
                <option value="en-US-DavisNeural">Davis (gentle)</option>
              </Select>
            </div>
          </div>

          <div style={{ padding: "0 16px 16px" }}>
            <div className={styles.switchField}>
              <Text>Auto-Read Responses</Text>
              <Switch
                checked={current.autoReadResponses}
                onChange={(_e, data) => updateDraft("autoReadResponses", data.checked)}
              />
            </div>
          </div>
        </Card>

        <Divider />

        {/* ── Focus & Attention ──────────────────────────────── */}
        <Card>
          <CardHeader
            image={<BrainCircuit24Regular />}
            header={<Text weight="semibold" size={500}>Focus &amp; Attention</Text>}
            description="Configure focus timers and notification preferences"
          />
          <div style={{ padding: "0 16px 16px" }}>
            <div className={styles.sliderField}>
              <label className={styles.fieldLabel}>
                Focus Timer Duration: {current.focusTimerMinutes} minutes
              </label>
              <Slider
                min={5}
                max={60}
                step={5}
                value={current.focusTimerMinutes}
                onChange={(_e, data) => updateDraft("focusTimerMinutes", data.value)}
              />
            </div>

            <div className={styles.sliderField} style={{ marginTop: "16px" }}>
              <label className={styles.fieldLabel}>
                Break Reminder: every {current.breakReminderMinutes} minutes
              </label>
              <Slider
                min={1}
                max={30}
                step={1}
                value={current.breakReminderMinutes}
                onChange={(_e, data) => updateDraft("breakReminderMinutes", data.value)}
              />
            </div>

            <div className={styles.field} style={{ marginTop: "16px" }}>
              <label className={styles.fieldLabel}>Notification Style</label>
              <Select
                value={current.notificationStyle}
                onChange={(_e, data) => updateDraft("notificationStyle", data.value)}
              >
                <option value="calm">Calm (gentle, non-intrusive)</option>
                <option value="standard">Standard</option>
                <option value="prominent">Prominent (larger, more visible)</option>
              </Select>
            </div>
          </div>
        </Card>
      </div>

      {/* Saved toast */}
      {saved && (
        <div className={styles.savedBar}>
          <MessageBar intent="success">
            <MessageBarBody>Settings saved successfully!</MessageBarBody>
          </MessageBar>
        </div>
      )}
    </div>
  );
}
