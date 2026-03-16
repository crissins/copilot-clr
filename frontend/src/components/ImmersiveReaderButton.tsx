import { useCallback } from "react";
import { apiClient } from "../services/api";
import { useAuth } from "../hooks/useAuth";

interface Props {
  title: string;
  text: string;
}

export function ImmersiveReaderButton({ title, text }: Props) {
  const { getAccessToken } = useAuth();

  const handleClick = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const { token: irToken, subdomain } = await apiClient.getIRToken(token);

      const content = {
        title,
        chunks: [{ content: text, mimeType: "text/plain" }],
      };

      // Load the Immersive Reader SDK dynamically
      if (!(window as any).ImmersiveReader) {
        const script = document.createElement("script");
        script.src = "https://ircdname.azureedge.net/immersivereadersdk/immersive-reader-sdk.1.4.0.js";
        script.async = true;
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      (window as any).ImmersiveReader.launchAsync(irToken, subdomain, content, {
        uiLang: "en",
      });
    } catch (err) {
      console.error("Immersive Reader launch failed:", err);
    }
  }, [title, text, getAccessToken]);

  return (
    <button
      onClick={handleClick}
      className="btn-icon"
      aria-label="Open in Immersive Reader"
      title="Immersive Reader (line focus, syllables, picture dictionary)"
    >
      &#x1F4D6;
    </button>
  );
}
