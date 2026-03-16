import { useState, useCallback, useRef } from "react";
import { apiClient } from "../services/api";
import { useAuth } from "../hooks/useAuth";

interface Props {
  onUploadComplete?: (filename: string) => void;
}

export function FileUpload({ onUploadComplete }: Props) {
  const { getAccessToken } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setStatus("Uploading...");
    try {
      const token = await getAccessToken();
      const result = await apiClient.uploadDocument(file, token);
      setStatus(`Uploaded: ${result.filename} (${result.chunks} chunks)`);
      onUploadComplete?.(result.filename);
    } catch (err) {
      setStatus("Upload failed. Only PDF files under 10 MB are supported.");
      console.error(err);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [getAccessToken, onUploadComplete]);

  return (
    <div className="file-upload">
      <label className="btn-secondary file-upload-label">
        {uploading ? "Uploading..." : "\uD83D\uDCC4 Upload PDF"}
        <input
          ref={fileRef}
          type="file"
          accept=".pdf"
          onChange={handleUpload}
          disabled={uploading}
          hidden
        />
      </label>
      {status && <span className="file-upload-status">{status}</span>}
    </div>
  );
}
