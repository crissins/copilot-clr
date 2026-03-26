/**
 * Feature 4 — Video Indexer
 *
 * Displays uploaded videos from the content library. Users can trigger
 * Azure Video Indexer analysis to extract transcripts, topics, scenes,
 * and keywords. Results are displayed inline.
 */

import { useState, useEffect, useCallback } from "react";
import {
  Button,
  Card,
  CardHeader,
  Text,
  Spinner,
  Badge,
  MessageBar,
  MessageBarBody,
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionPanel,
  DataGrid,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridBody,
  DataGridRow,
  DataGridCell,
  createTableColumn,
  makeStyles,
  tokens,
  shorthands,
} from "@fluentui/react-components";
import {
  VideoClip24Regular,
  Play24Regular,
  ArrowSync24Regular,
} from "@fluentui/react-icons";
import { apiClient } from "../../services/api";
import type { VideoAnalysisResult } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";

interface VideoItem {
  id: string;
  filename: string;
  fileType: string;
  status: string;
  createdAt: string;
}

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    maxWidth: "960px",
    marginLeft: "auto",
    marginRight: "auto",
    ...shorthands.padding("24px"),
    overflowY: "auto",
    height: "100%",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  videoList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  videoCard: {
    cursor: "pointer",
    ...shorthands.padding("12px", "16px"),
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground3,
    },
  },
  videoCardSelected: {
    ...shorthands.borderColor(tokens.colorBrandStroke1),
    backgroundColor: tokens.colorBrandBackground2,
    ":hover": {
      backgroundColor: tokens.colorBrandBackground2Hover,
    },
  },
  cardRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
  },
  resultsCard: {
    ...shorthands.padding("20px"),
  },
  transcriptBox: {
    whiteSpace: "pre-wrap",
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.padding("16px"),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    maxHeight: "300px",
    overflowY: "auto",
    fontSize: tokens.fontSizeBase300,
    lineHeight: tokens.lineHeightBase300,
  },
  tagList: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "16px",
    ...shorthands.padding("48px"),
    color: tokens.colorNeutralForeground3,
  },
});

export function Feature4Page() {
  const styles = useStyles();
  const { getAccessToken } = useAuth();

  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<VideoAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadVideos = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      const all = await apiClient.listContent(token);
      setVideos(all.filter((c) => c.fileType === "video"));
    } catch (err: any) {
      setError(err.message || "Failed to load videos");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  const runAnalysis = useCallback(async () => {
    if (!selectedId) return;
    setAnalyzing(true);
    setError(null);
    setAnalysisResult(null);
    try {
      const token = await getAccessToken();
      const result = await apiClient.analyzeVideo(selectedId, token);
      setAnalysisResult(result);
    } catch (err: any) {
      setError(err.message || "Video analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }, [selectedId, getAccessToken]);

  const sceneColumns = [
    createTableColumn<{ start: string; end: string }>({
      columnId: "start",
      renderHeaderCell: () => "Start",
      renderCell: (item) => item.start,
    }),
    createTableColumn<{ start: string; end: string }>({
      columnId: "end",
      renderHeaderCell: () => "End",
      renderCell: (item) => item.end,
    }),
  ];

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <VideoClip24Regular />
        <Text size={600} weight="semibold">
          Video Indexer
        </Text>
        <Button
          appearance="subtle"
          icon={<ArrowSync24Regular />}
          onClick={loadVideos}
          disabled={loading}
          size="small"
        >
          Refresh
        </Button>
      </div>

      {error && (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}

      {/* Video list */}
      {loading ? (
        <Spinner label="Loading videos..." />
      ) : videos.length === 0 ? (
        <div className={styles.emptyState}>
          <VideoClip24Regular style={{ fontSize: 48 }} />
          <Text size={400} weight="semibold">No videos uploaded yet</Text>
          <Text size={300}>Upload a video from the Document Upload page to analyze it here.</Text>
        </div>
      ) : (
        <div className={styles.videoList}>
          {videos.map((v) => (
            <Card
              key={v.id}
              className={`${styles.videoCard} ${selectedId === v.id ? styles.videoCardSelected : ""}`}
              onClick={() => {
                setSelectedId(v.id);
                setAnalysisResult(null);
              }}
            >
              <div className={styles.cardRow}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <VideoClip24Regular />
                  <div>
                    <Text weight="semibold">{v.filename}</Text>
                    <br />
                    <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                      Uploaded {new Date(v.createdAt).toLocaleDateString()}
                    </Text>
                  </div>
                </div>
                <Badge color={v.status === "indexed" ? "success" : "informative"} size="small">
                  {v.status}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Analyze button */}
      {selectedId && (
        <Button
          appearance="primary"
          icon={analyzing ? <Spinner size="tiny" /> : <Play24Regular />}
          onClick={runAnalysis}
          disabled={analyzing}
        >
          {analyzing ? "Analyzing..." : "Analyze Selected Video"}
        </Button>
      )}

      {/* Results */}
      {analysisResult && (
        <Card className={styles.resultsCard}>
          <CardHeader
            header={<Text weight="semibold" size={400}>Analysis Results</Text>}
            description={
              <Badge color="informative" size="small">
                Source: {analysisResult.source}
              </Badge>
            }
          />

          <Accordion multiple defaultOpenItems={["transcript", "topics", "keywords"]}>
            {/* Transcript */}
            <AccordionItem value="transcript">
              <AccordionHeader>
                Transcript ({analysisResult.transcript.length} chars)
              </AccordionHeader>
              <AccordionPanel>
                {analysisResult.transcript ? (
                  <div className={styles.transcriptBox}>
                    {analysisResult.transcript}
                  </div>
                ) : (
                  <Text italic>No transcript available.</Text>
                )}
              </AccordionPanel>
            </AccordionItem>

            {/* Topics */}
            <AccordionItem value="topics">
              <AccordionHeader>
                Topics ({analysisResult.topics.length})
              </AccordionHeader>
              <AccordionPanel>
                {analysisResult.topics.length > 0 ? (
                  <div className={styles.tagList}>
                    {analysisResult.topics.map((t, i) => (
                      <Badge key={i} appearance="outline">{t}</Badge>
                    ))}
                  </div>
                ) : (
                  <Text italic>No topics detected.</Text>
                )}
              </AccordionPanel>
            </AccordionItem>

            {/* Keywords */}
            <AccordionItem value="keywords">
              <AccordionHeader>
                Keywords ({analysisResult.keywords.length})
              </AccordionHeader>
              <AccordionPanel>
                {analysisResult.keywords.length > 0 ? (
                  <div className={styles.tagList}>
                    {analysisResult.keywords.map((k, i) => (
                      <Badge key={i} appearance="tint" color="brand">{k}</Badge>
                    ))}
                  </div>
                ) : (
                  <Text italic>No keywords detected.</Text>
                )}
              </AccordionPanel>
            </AccordionItem>

            {/* Scenes */}
            <AccordionItem value="scenes">
              <AccordionHeader>
                Scenes ({analysisResult.scenes.length})
              </AccordionHeader>
              <AccordionPanel>
                {analysisResult.scenes.length > 0 ? (
                  <DataGrid
                    items={analysisResult.scenes}
                    columns={sceneColumns}
                    getRowId={(item) => `${item.start}-${item.end}`}
                  >
                    <DataGridHeader>
                      <DataGridRow>
                        {({ renderHeaderCell }) => (
                          <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>
                        )}
                      </DataGridRow>
                    </DataGridHeader>
                    <DataGridBody<{ start: string; end: string }>>
                      {({ item, rowId }) => (
                        <DataGridRow<{ start: string; end: string }> key={rowId}>
                          {({ renderCell }) => (
                            <DataGridCell>{renderCell(item)}</DataGridCell>
                          )}
                        </DataGridRow>
                      )}
                    </DataGridBody>
                  </DataGrid>
                ) : (
                  <Text italic>No scenes detected.</Text>
                )}
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
        </Card>
      )}
    </div>
  );
}
