import { useState, useCallback, useRef } from "react";
import { apiClient } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { useI18n } from "../I18nContext";

interface Props {
  onUploadComplete?: (filename: string) => void;
}

export function FileUpload({ onUploadComplete }: Props) {
  const { getAccessToken } = useAuth();
  const { t } = useI18n();
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
      setStatus(t.upload.uploadedStatus(result.filename, result.chunks));
      onUploadComplete?.(result.filename);
    } catch (err) {
      setStatus(t.upload.errorGeneric);
      console.error(err);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [getAccessToken, onUploadComplete]);

  return (
    <div className="file-upload">
      <label className="btn-secondary file-upload-label">
        {uploading ? t.upload.uploading : t.upload.label}
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.mp4,.mov,.avi,.mkv,.webm"
          onChange={handleUpload}
          disabled={uploading}
          hidden
        />
      </label>
      {status && <span className="file-upload-status">{status}</span>}
    </div>
  );
}
