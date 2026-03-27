/**
 * Feature 2 — Simplify Content
 *
 * Select a previously uploaded document, choose a reading-level / neurodiverse
 * profile, and view the AI-adapted version with explanation of what changed.
 *
 * Backend: POST /api/content/{id}/adapt, GET /api/content/{id}
 */

import { useState, useCallback, useEffect } from "react";
import {
  Button,
  Card,
  CardHeader,
  Text,
  Badge,
  Spinner,
  Select,
  Divider,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  makeStyles,
  tokens,
  shorthands,
} from "@fluentui/react-components";
import {
  TextGrammarSettings24Regular,
  Document24Regular,
  ArrowClockwise24Regular,
  Checkmark24Regular,
  ArrowDownload24Regular,
} from "@fluentui/react-icons";
import ReactMarkdown from "react-markdown";
import { apiClient } from "../../services/api";
import type { ContentItem, ContentDetail } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import { TTSButton } from "../../components/TTSButton";
import { ImmersiveReaderButton } from "../../components/ImmersiveReaderButton";
import { FileUpload } from "../../components/FileUpload";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    maxWidth: "900px",
    marginLeft: "auto",
    marginRight: "auto",
    ...shorthands.padding("24px"),
    overflowY: "auto",
    height: "100%",
  },
  header: { display: "flex", flexDirection: "column", gap: "8px" },
  headerRow: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  headerLeft: { display: "flex", alignItems: "center", gap: "12px" },
  docList: { display: "flex", flexDirection: "column", gap: "8px" },
  docCard: {
    ...shorthands.padding("12px", "16px"),
    cursor: "pointer",
    transition: "background 150ms ease",
    ":hover": { backgroundColor: tokens.colorNeutralBackground1Hover },
  },
  selectedCard: { ...shorthands.border("2px", "solid", tokens.colorBrandStroke1) },
  docRow: {
    display: "flex", alignItems: "center", gap: "12px", justifyContent: "space-between",
  },
  docLeft: {
    display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0,
  },
  docName: {
    fontWeight: tokens.fontWeightSemibold,
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  adaptSection: {
    display: "flex", flexDirection: "column", gap: "12px",
    ...shorthands.padding("20px"),
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRadius(tokens.borderRadiusXLarge),
  },
  profileRow: { display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap" },
  resultArea: { display: "flex", flexDirection: "column", gap: "16px" },
  summaryCard: {
    ...shorthands.padding("16px"),
    backgroundColor: tokens.colorBrandBackground2,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
  },
  adaptedText: {
    ...shorthands.padding("20px"),
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke1),
    lineHeight: tokens.lineHeightBase400,
  },
  explanationBar: {
    ...shorthands.padding("12px", "16px"),
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderRadius("8px"),
    fontStyle: "italic",
  },
  metaBadges: { display: "flex", gap: "8px", flexWrap: "wrap" },
  empty: {
    textAlign: "center" as const,
    ...shorthands.padding("40px"),
    color: tokens.colorNeutralForeground3,
  },
});

const PROFILES = [
  { value: "low", label: "Very Easy (Grade 2)", description: "Short sentences, common words" },
  { value: "medium", label: "Easy (Grade 5)", description: "Clear language, structured sections" },
  { value: "high", label: "Standard (Grade 8)", description: "Full detail with clear structure" },
  { value: "adhd", label: "ADHD-optimized", description: "Ultra-short chunks, bold actions, time estimates" },
  { value: "dyslexia", label: "Dyslexia-friendly", description: "Simple vocabulary, clear spacing" },
];

export function Feature2Page() {
  const styles = useStyles();
  const { getAccessToken } = useAuth();

  const [documents, setDocuments] = useState<ContentItem[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [contentDetail, setContentDetail] = useState<ContentDetail | null>(null);
  const [profile, setProfile] = useState("medium");
  const [adapting, setAdapting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      const items = await apiClient.listContent(token);
      setDocuments(items);
    } catch {
      setError("Could not load documents. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  const loadDetail = useCallback(async (docId: string) => {
    setLoadingDetail(true);
    setContentDetail(null);
    setSuccessMsg(null);
    try {
      const token = await getAccessToken();
      const detail = await apiClient.getContent(docId, token);
      setContentDetail(detail);
    } catch {
      setError("Could not load document details.");
    } finally {
      setLoadingDetail(false);
    }
  }, [getAccessToken]);

  const handleSelectDoc = useCallback((docId: string) => {
    setSelectedDocId(docId);
    setError(null);
    loadDetail(docId);
  }, [loadDetail]);

  const handleAdapt = useCallback(async () => {
    if (!selectedDocId) return;
    setAdapting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const token = await getAccessToken();
      const result = await apiClient.adaptContent(selectedDocId, profile, token);
      setSuccessMsg(
        `Content adapted to "${PROFILES.find(p => p.value === profile)?.label}" level in ${result.adaptationMs}ms.`
      );
      await loadDetail(selectedDocId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Adaptation failed. Please try again.");
    } finally {
      setAdapting(false);
    }
  }, [selectedDocId, profile, getAccessToken, loadDetail]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerRow}>
          <div className={styles.headerLeft}>
            <TextGrammarSettings24Regular />
            <Text size={600} weight="bold">Simplify Content</Text>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <FileUpload onUploadComplete={() => loadDocuments()} />
            <Button appearance="subtle" icon={<ArrowClockwise24Regular />} onClick={loadDocuments} aria-label="Refresh" />
          </div>
        </div>
        <Text size={300} style={{ color: tokens.colorNeutralForeground3 }}>
          Select a document and choose a reading level. The AI will rewrite it in simpler, clearer
          language and explain what it changed. Take your time — there is no rush.
        </Text>
      </div>

      {error && (
        <MessageBar intent="error">
          <MessageBarBody><MessageBarTitle>Oops</MessageBarTitle>{error}</MessageBarBody>
        </MessageBar>
      )}
      {successMsg && (
        <MessageBar intent="success">
          <MessageBarBody><MessageBarTitle>Adapted</MessageBarTitle>{successMsg}</MessageBarBody>
        </MessageBar>
      )}

      {/* Document list */}
      <div>
        <Text size={400} weight="semibold">Your Documents</Text>
        {loading ? (
          <Spinner label="Loading documents..." style={{ marginTop: 16 }} />
        ) : documents.length === 0 ? (
          <div className={styles.empty}>
            <Text>No documents yet. Upload a PDF or video to get started.</Text>
          </div>
        ) : (
          <div className={styles.docList} style={{ marginTop: 8 }}>
            {documents.map((doc) => (
              <Card
                key={doc.id}
                className={`${styles.docCard} ${selectedDocId === doc.id ? styles.selectedCard : ""}`}
                onClick={() => handleSelectDoc(doc.id)}
              >
                <div className={styles.docRow}>
                  <div className={styles.docLeft}>
                    {selectedDocId === doc.id ? <Checkmark24Regular /> : <Document24Regular />}
                    <span className={styles.docName}>{doc.filename}</span>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <Badge appearance="outline">{doc.chunkCount} chunks</Badge>
                    <Badge appearance="tint" color="brand">{doc.status}</Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Adaptation controls */}
      {selectedDocId && (
        <>
          <Divider />
          <div className={styles.adaptSection}>
            <Text size={500} weight="semibold">Adapt for Accessibility</Text>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              Choose a reading profile. The AI will simplify vocabulary, shorten sentences,
              and restructure the content to match the selected level.
            </Text>
            <div className={styles.profileRow}>
              <Select value={profile} onChange={(_, d) => setProfile(d.value)} style={{ minWidth: 220 }}>
                {PROFILES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label} — {p.description}</option>
                ))}
              </Select>
              <Button
                appearance="primary"
                onClick={handleAdapt}
                disabled={adapting}
                icon={adapting ? <Spinner size="tiny" /> : undefined}
              >
                {adapting ? "Simplifying..." : "Simplify"}
              </Button>
            </div>
          </div>
        </>
      )}

      {loadingDetail && <Spinner label="Loading document details..." />}

      {/* Adapted versions */}
      {contentDetail && contentDetail.adaptations.length > 0 && (
        <div className={styles.resultArea}>
          <Text size={500} weight="semibold">Adapted Versions</Text>
          {contentDetail.adaptations.map((adaptation) => {
            const profileInfo = PROFILES.find(p => p.value === adaptation.profile);
            const originalWordCount = adaptation.originalWordCount ?? contentDetail.content.extractedText?.split(/\s+/).length ?? 0;
            const adaptedWordCount = adaptation.adaptedWordCount ?? adaptation.adaptedText.split(/\s+/).length;
            const reductionPercent = adaptation.reductionPercent ?? Math.round((1 - adaptedWordCount / Math.max(1, originalWordCount)) * 100);
            const fallbackChangeSummary = `Original: ${originalWordCount} words -> Adapted: ${adaptedWordCount} words (${reductionPercent}% reduction). Content rewritten for ${profileInfo?.description || adaptation.profile} readers - vocabulary simplified, sentences shortened, and structure improved for clarity.`;
            return (
              <Card key={adaptation.id} style={{ padding: "16px" }}>
                <CardHeader
                  header={
                    <div className={styles.metaBadges}>
                      <Badge appearance="filled" color="brand">{profileInfo?.label || adaptation.profile}</Badge>
                      <Badge appearance="outline">{new Date(adaptation.createdAt).toLocaleDateString()}</Badge>
                    </div>
                  }
                />
                {adaptation.summary && (
                  <div className={styles.summaryCard} style={{ marginTop: 12 }}>
                    <Text size={200} weight="semibold">Summary</Text>
                    <Text block size={300} style={{ marginTop: 4 }}>{adaptation.summary}</Text>
                  </div>
                )}
                <div className={styles.adaptedText} style={{ marginTop: 12 }}>
                  <ReactMarkdown>{adaptation.adaptedText}</ReactMarkdown>
                </div>
                <div style={{ display: "flex", gap: "4px", marginTop: 8 }}>
                  <TTSButton text={adaptation.adaptedText} />
                  <ImmersiveReaderButton title={`Adapted: ${profileInfo?.label || adaptation.profile}`} text={adaptation.adaptedText} />
                  <Button
                    appearance="subtle"
                    icon={<ArrowDownload24Regular />}
                    onClick={() => {
                      const blob = new Blob([adaptation.adaptedText], { type: "text/markdown;charset=utf-8" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `adapted-${adaptation.profile}-${new Date(adaptation.createdAt).toISOString().slice(0, 10)}.md`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    Download
                  </Button>
                </div>
                {contentDetail?.content?.extractedText && (
                  <div className={styles.explanationBar} style={{ marginTop: 12 }}>
                    <Text size={200}>
                      <strong>What changed:</strong>{" "}
                      {adaptation.changeSummary || fallbackChangeSummary}
                    </Text>
                  </div>
                )}
                {!contentDetail?.content?.extractedText && (
                  <div className={styles.explanationBar} style={{ marginTop: 12 }}>
                    <Text size={200}>
                      <strong>Why this version:</strong> Rewritten for{" "}
                      {profileInfo?.description || adaptation.profile} readers. Vocabulary was simplified,
                      sentences were shortened, and the content was restructured into clear sections
                      to reduce cognitive load.
                    </Text>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Original text preview */}
      {contentDetail?.content?.extractedText && (
        <div>
          <Divider />
          <Text size={400} weight="semibold" style={{ marginTop: 12 }}>Original Text Preview</Text>
          <div className={styles.adaptedText} style={{ marginTop: 8, opacity: 0.7 }}>
            <Text>{contentDetail.content.extractedText}</Text>
          </div>
        </div>
      )}
    </div>
  );
}
