import { useState } from "react";
import { getImmersiveReaderToken, simplifyDocument } from "../services/api";

type SimplifyApiResponse = {
  original_text?: string;
  simplified_text?: string;
  summary?: string;
  steps?: string[];
  reading_level?: string;
  accessibility_preset?: string;
};

declare global {
  interface Window {
    ImmersiveReader?: {
      launchAsync: (
        token: string,
        subdomain: string,
        data: {
          title?: string;
          chunks: Array<{
            content: string;
            lang?: string;
          }>;
        },
        options?: Record<string, unknown>
      ) => Promise<void>;
    };
  }
}

export default function SimplifierPanel() {
  const [inputText, setInputText] = useState("");
  const [title, setTitle] = useState("Documento simplificado");
  const [result, setResult] = useState<SimplifyApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [readerLoading, setReaderLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSimplify = async () => {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const data = await simplifyDocument({
        text: inputText,
        title,
        language: "es",
      });

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error al simplificar.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenImmersiveReader = async () => {
    if (!result?.simplified_text) {
      setError("Primero simplifica el contenido.");
      return;
    }

    if (!window.ImmersiveReader) {
      setError("El SDK de Immersive Reader no está cargado.");
      return;
    }

    setReaderLoading(true);
    setError("");

    try {
      const tokenData = await getImmersiveReaderToken();

      await window.ImmersiveReader.launchAsync(
        tokenData.token,
        tokenData.subdomain,
        {
          title,
          chunks: [
            {
              content: result.simplified_text,
              lang: "es",
            },
          ],
        },
        {
          uiLang: "es",
          timeout: 15000,
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible abrir Immersive Reader.");
    } finally {
      setReaderLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>Cognitive Load Reduction Assistant</h1>
      <p style={styles.subheading}>
        Simplifica documentos densos y ábrelos en Immersive Reader.
      </p>

      <div style={styles.card}>
        <label style={styles.label}>Título</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={styles.input}
          placeholder="Ej. Instrucciones del proyecto"
        />

        <label style={styles.label}>Texto de entrada</label>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          style={styles.textarea}
          placeholder="Pega aquí el texto complejo que quieres simplificar..."
        />

        <div style={styles.buttonRow}>
          <button
            onClick={handleSimplify}
            disabled={loading || !inputText.trim()}
            style={styles.primaryButton}
          >
            {loading ? "Simplificando..." : "Simplificar"}
          </button>

          <button
            onClick={handleOpenImmersiveReader}
            disabled={readerLoading || !result?.simplified_text}
            style={styles.secondaryButton}
          >
            {readerLoading ? "Abriendo..." : "Abrir en Immersive Reader"}
          </button>
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}
      </div>

      {result && (
        <div style={styles.resultCard}>
          <h2 style={styles.sectionTitle}>Resultado</h2>

          {result.summary && (
            <>
              <h3 style={styles.miniTitle}>Resumen</h3>
              <p style={styles.paragraph}>{result.summary}</p>
            </>
          )}

          {result.steps && result.steps.length > 0 && (
            <>
              <h3 style={styles.miniTitle}>Pasos</h3>
              <ol style={styles.list}>
                {result.steps.map((step, index) => (
                  <li key={index} style={styles.listItem}>
                    {step}
                  </li>
                ))}
              </ol>
            </>
          )}

          {result.simplified_text && (
            <>
              <h3 style={styles.miniTitle}>Texto simplificado</h3>
              <div style={styles.outputBox}>{result.simplified_text}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: "1000px",
    margin: "0 auto",
    padding: "32px 16px",
    fontFamily: "Arial, sans-serif",
  },
  heading: {
    fontSize: "2rem",
    marginBottom: "8px",
  },
  subheading: {
    color: "#555",
    marginBottom: "24px",
  },
  card: {
    background: "#fff",
    border: "1px solid #ddd",
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "24px",
  },
  resultCard: {
    background: "#fff",
    border: "1px solid #ddd",
    borderRadius: "12px",
    padding: "20px",
  },
  label: {
    display: "block",
    fontWeight: 600,
    marginBottom: "8px",
    marginTop: "12px",
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #ccc",
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    minHeight: "220px",
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid #ccc",
    resize: "vertical",
    boxSizing: "border-box",
  },
  buttonRow: {
    display: "flex",
    gap: "12px",
    marginTop: "20px",
    flexWrap: "wrap",
  },
  primaryButton: {
    padding: "12px 18px",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    background: "#2563eb",
    color: "#fff",
    fontWeight: 600,
  },
  secondaryButton: {
    padding: "12px 18px",
    borderRadius: "8px",
    border: "1px solid #2563eb",
    cursor: "pointer",
    background: "#fff",
    color: "#2563eb",
    fontWeight: 600,
  },
  errorBox: {
    marginTop: "16px",
    padding: "12px",
    background: "#fee2e2",
    color: "#991b1b",
    borderRadius: "8px",
  },
  sectionTitle: {
    marginTop: 0,
  },
  miniTitle: {
    marginBottom: "8px",
    marginTop: "20px",
  },
  paragraph: {
    lineHeight: 1.6,
  },
  list: {
    paddingLeft: "20px",
  },
  listItem: {
    marginBottom: "8px",
    lineHeight: 1.5,
  },
  outputBox: {
    whiteSpace: "pre-wrap",
    lineHeight: 1.7,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "16px",
  },
};