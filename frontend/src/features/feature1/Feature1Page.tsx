/**
 * Feature 1 — Document Library
 *
 * Browse previously uploaded documents, view details, and upload new ones.
 * Documents are stored in Azure Blob Storage and indexed in Azure AI Search.
 */

import { useState, useCallback, useEffect } from "react";
import {
  Button,
  Card,
  Text,
  Badge,
  Spinner,
  makeStyles,
  tokens,
  shorthands,
} from "@fluentui/react-components";
import {
  ArrowClockwise24Regular,
  DocumentBulletList24Regular,
  Document24Regular,
  Video24Regular,
  Play24Regular,
} from "@fluentui/react-icons";
import { apiClient } from "../../services/api";
import type { ContentItem } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import { useI18n } from "../../I18nContext";
import { FileUpload } from "../../components/FileUpload";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    maxWidth: "800px",
    marginLeft: "auto",
    marginRight: "auto",
    ...shorthands.padding("24px"),
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  card: {
    ...shorthands.padding("16px"),
    cursor: "default",
  },
  cardRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    justifyContent: "space-between",
  },
  cardLeft: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flex: 1,
    minWidth: 0,
  },
  filename: {
    fontWeight: tokens.fontWeightSemibold,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  meta: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    flexShrink: 0,
  },
  empty: {
    textAlign: "center" as const,
    ...shorthands.padding("40px"),
    color: tokens.colorNeutralForeground3,
  },
});

export function Feature1Page() {
  const styles = useStyles();
  const { getAccessToken } = useAuth();
  const { t } = useI18n();
  const [documents, setDocuments] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      const items = await apiClient.listContent(token);
      setDocuments(items);
    } catch (err) {
      console.error("Failed to load documents:", err);
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleAnalyzeVideo = useCallback(async (docId: string) => {
    setAnalyzingId(docId);
    try {
      const token = await getAccessToken();
      await apiClient.analyzeVideo(docId, token);
      loadDocuments(); // Refresh to show updated status
    } catch (err) {
      console.error("Video analysis failed:", err);
    } finally {
      setAnalyzingId(null);
    }
  }, [getAccessToken, loadDocuments]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <DocumentBulletList24Regular />
          <Text size={600} weight="bold">{t.docs.title}</Text>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <FileUpload onUploadComplete={() => loadDocuments()} />
          <Button
            appearance="subtle"
            icon={<ArrowClockwise24Regular />}
            onClick={loadDocuments}
            aria-label={t.docs.refresh}
          />
        </div>
      </div>
      <Text size={300} style={{ color: tokens.colorNeutralForeground3 }}>
        Upload documents here to make them available across all your conversations. Supported formats: PDF, DOCX, and video files. Documents are indexed so the AI can search and answer questions about them.
      </Text>

      {loading ? (
        <Spinner label={t.docs.loading} />
      ) : documents.length === 0 ? (
        <div className={styles.empty}>
          <Text size={400}>{t.docs.empty}</Text>
        </div>
      ) : (
        <div className={styles.list}>
          {documents.map((doc) => (
            <Card key={doc.id} className={styles.card}>
              <div className={styles.cardRow}>
                <div className={styles.cardLeft}>
                  {doc.fileType === "video" ? <Video24Regular /> : <Document24Regular />}
                  <span className={styles.filename}>{doc.filename}</span>
                </div>
                <div className={styles.meta}>
                  {doc.fileType === "video" && (
                    <Button
                      size="small"
                      appearance="subtle"
                      icon={analyzingId === doc.id ? <Spinner size="tiny" /> : <Play24Regular />}
                      onClick={() => handleAnalyzeVideo(doc.id)}
                      disabled={!!analyzingId}
                    >
                      {analyzingId === doc.id ? "Processing…" : "Process Video"}
                    </Button>
                  )}
                  <Badge appearance="outline">{doc.chunkCount} {t.docs.chunks}</Badge>
                  <Badge appearance="tint" color="brand">{doc.status}</Badge>
                  <Text size={200} style={{ opacity: 0.6 }}>
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </Text>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
