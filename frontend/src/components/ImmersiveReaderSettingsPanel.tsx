/**
 * ImmersiveReaderSettings — Inline settings panel for configuring the
 * Immersive Reader experience (read-aloud, display, translation, grammar).
 * Mirrors the Voice Settings pattern already used in Feature7Page.
 */

import {
  Select,
  Label,
  Switch,
  makeStyles,
  tokens,
  shorthands,
} from "@fluentui/react-components";
import type {
  ImmersiveReaderSettings as IRSettings,
  IRVoice,
  IRSpeed,
  IRTheme,
  IRFont,
  IRTextSize,
} from "../hooks/useImmersiveReader";

interface Props {
  settings: IRSettings;
  onChange: (patch: Partial<IRSettings>) => void;
}

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    ...shorthands.padding("12px", "16px"),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    backgroundColor: tokens.colorNeutralBackground3,
    animationDuration: "200ms",
    animationTimingFunction: "ease-out",
    animationName: {
      from: { opacity: 0, maxHeight: "0px" },
      to: { opacity: 1, maxHeight: "600px" },
    },
  },
  sectionTitle: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground3,
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap",
  },
  field: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
});

// ── Translation language options (subset of popular languages) ────────────
const TRANSLATION_LANGUAGES = [
  { value: "", label: "Off" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "zh-Hans", label: "Chinese (Simplified)" },
  { value: "zh-Hant", label: "Chinese (Traditional)" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "ar", label: "Arabic" },
  { value: "hi", label: "Hindi" },
  { value: "it", label: "Italian" },
  { value: "ru", label: "Russian" },
  { value: "vi", label: "Vietnamese" },
  { value: "uk", label: "Ukrainian" },
];

const UI_LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "pt", label: "Português" },
  { value: "zh-Hans", label: "中文 (简)" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
  { value: "ar", label: "العربية" },
];

export function ImmersiveReaderSettingsPanel({ settings, onChange }: Props) {
  const styles = useStyles();

  return (
    <div className={styles.root} role="region" aria-label="Immersive Reader settings">
      {/* ── Read Aloud ────────────────────────────────────── */}
      <span className={styles.sectionTitle}>Read Aloud</span>
      <div className={styles.row}>
        <div className={styles.field}>
          <Label size="small" htmlFor="ir-voice">Voice</Label>
          <Select
            id="ir-voice"
            size="small"
            value={settings.readAloudVoice}
            onChange={(_, d) => onChange({ readAloudVoice: d.value as IRVoice })}
          >
            <option value="Female">Female</option>
            <option value="Male">Male</option>
          </Select>
        </div>

        <div className={styles.field}>
          <Label size="small" htmlFor="ir-speed">Speed</Label>
          <Select
            id="ir-speed"
            size="small"
            value={String(settings.readAloudSpeed)}
            onChange={(_, d) => onChange({ readAloudSpeed: Number(d.value) as IRSpeed })}
          >
            <option value="0.5">0.5× (Very Slow)</option>
            <option value="0.75">0.75×</option>
            <option value="1">1× (Normal)</option>
            <option value="1.25">1.25×</option>
            <option value="1.5">1.5×</option>
            <option value="1.75">1.75×</option>
            <option value="2">2×</option>
            <option value="2.25">2.25×</option>
            <option value="2.5">2.5× (Fast)</option>
          </Select>
        </div>

        <div className={styles.field}>
          <Switch
            checked={settings.readAloudAutoPlay}
            onChange={(_, d) => onChange({ readAloudAutoPlay: d.checked })}
            label="Auto-play"
          />
        </div>
      </div>

      {/* ── Display ───────────────────────────────────────── */}
      <span className={styles.sectionTitle}>Display</span>
      <div className={styles.row}>
        <div className={styles.field}>
          <Label size="small" htmlFor="ir-textsize">Text Size</Label>
          <Select
            id="ir-textsize"
            size="small"
            value={String(settings.textSize)}
            onChange={(_, d) => onChange({ textSize: Number(d.value) as IRTextSize })}
          >
            <option value="14">14</option>
            <option value="20">20</option>
            <option value="28">28</option>
            <option value="36">36 (Default)</option>
            <option value="42">42</option>
            <option value="48">48</option>
            <option value="56">56</option>
            <option value="64">64</option>
            <option value="72">72</option>
            <option value="84">84</option>
            <option value="96">96</option>
          </Select>
        </div>

        <div className={styles.field}>
          <Label size="small" htmlFor="ir-font">Font</Label>
          <Select
            id="ir-font"
            size="small"
            value={settings.fontFamily}
            onChange={(_, d) => onChange({ fontFamily: d.value as IRFont })}
          >
            <option value="Calibri">Calibri</option>
            <option value="ComicSans">Comic Sans</option>
            <option value="Sitka">Sitka</option>
          </Select>
        </div>

        <div className={styles.field}>
          <Label size="small" htmlFor="ir-theme">Theme</Label>
          <Select
            id="ir-theme"
            size="small"
            value={settings.themeOption}
            onChange={(_, d) => onChange({ themeOption: d.value as IRTheme })}
          >
            <option value="Light">Light</option>
            <option value="Dark">Dark</option>
          </Select>
        </div>

        <div className={styles.field}>
          <Switch
            checked={settings.increaseSpacing}
            onChange={(_, d) => onChange({ increaseSpacing: d.checked })}
            label="Increase spacing"
          />
        </div>
      </div>

      {/* ── Translation ───────────────────────────────────── */}
      <span className={styles.sectionTitle}>Translation</span>
      <div className={styles.row}>
        <div className={styles.field}>
          <Label size="small" htmlFor="ir-translate-lang">Language</Label>
          <Select
            id="ir-translate-lang"
            size="small"
            value={settings.translationLanguage}
            onChange={(_, d) => onChange({
              translationLanguage: d.value,
              // Auto-enable word translation when a language is selected
              autoEnableWordTranslation: d.value !== "",
            })}
          >
            {TRANSLATION_LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </Select>
        </div>

        {settings.translationLanguage && (
          <>
            <div className={styles.field}>
              <Switch
                checked={settings.autoEnableWordTranslation}
                onChange={(_, d) => onChange({ autoEnableWordTranslation: d.checked })}
                label="Word translation"
              />
            </div>
            <div className={styles.field}>
              <Switch
                checked={settings.autoEnableDocumentTranslation}
                onChange={(_, d) => onChange({ autoEnableDocumentTranslation: d.checked })}
                label="Document translation"
              />
            </div>
          </>
        )}

        <div className={styles.field}>
          <Switch
            checked={settings.disableTranslation}
            onChange={(_, d) => onChange({ disableTranslation: d.checked })}
            label="Disable all translation"
          />
        </div>
      </div>

      {/* ── Grammar & Accessibility ───────────────────────── */}
      <span className={styles.sectionTitle}>Grammar & Accessibility</span>
      <div className={styles.row}>
        <div className={styles.field}>
          <Switch
            checked={settings.disableGrammar}
            onChange={(_, d) => onChange({ disableGrammar: d.checked })}
            label="Disable grammar tools"
          />
        </div>
        <div className={styles.field}>
          <Switch
            checked={settings.disableLanguageDetection}
            onChange={(_, d) => onChange({ disableLanguageDetection: d.checked })}
            label="Disable language detection"
          />
        </div>
        <div className={styles.field}>
          <Switch
            checked={settings.disableFirstRun}
            onChange={(_, d) => onChange({ disableFirstRun: d.checked })}
            label="Skip first-run experience"
          />
        </div>
        <div className={styles.field}>
          <Switch
            checked={settings.enableCookies}
            onChange={(_, d) => onChange({ enableCookies: d.checked })}
            label="Remember preferences (cookies)"
          />
        </div>
      </div>

      {/* ── UI Language ───────────────────────────────────── */}
      <span className={styles.sectionTitle}>Reader UI Language</span>
      <div className={styles.row}>
        <div className={styles.field}>
          <Label size="small" htmlFor="ir-uilang">Language</Label>
          <Select
            id="ir-uilang"
            size="small"
            value={settings.uiLang}
            onChange={(_, d) => onChange({ uiLang: d.value })}
          >
            {UI_LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </Select>
        </div>
      </div>
    </div>
  );
}
