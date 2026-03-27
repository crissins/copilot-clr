import { useState, useCallback, useRef } from "react";
import { apiClient } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { 
  Button, 
  Spinner, 
  Toaster, 
  Tooltip,
  useId, 
  useToastController, 
  Toast, 
  ToastTitle 
} from "@fluentui/react-components";
import { Attach24Regular } from "@fluentui/react-icons";

interface Props {
  onUploadComplete?: (filename: string) => void;
}

export function FileUpload({ onUploadComplete }: Props) {
  const { getAccessToken } = useAuth();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const toasterId = useId("upload-toaster");
  const { dispatchToast } = useToastController(toasterId);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const token = await getAccessToken();
      const result = await apiClient.uploadDocument(file, token);
      
      dispatchToast(
        <Toast appearance="inverted" style={{ backgroundColor: "#107C10", color: "white" }}>
          <ToastTitle>📎 {file.name} uploaded — ask me anything about it!</ToastTitle>
        </Toast>,
        { intent: "success" }
      );
      onUploadComplete?.(result.filename || file.name);
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [getAccessToken, onUploadComplete, dispatchToast]);

  return (
    <>
      <Toaster toasterId={toasterId} position="top-end" />
      <Tooltip content="Upload a document so we can chat about it" relationship="label" positioning="above">
        <Button
          appearance="subtle"
          icon={uploading ? <Spinner size="tiny" /> : <Attach24Regular />}
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          aria-label="Upload file"
          shape="circular"
          style={{ flexShrink: 0, minWidth: "44px", height: "44px" }}
        />
      </Tooltip>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.docx,.mp4,.mov,.avi,.mkv,.webm"
        onChange={handleUpload}
        disabled={uploading}
        hidden
      />
    </>
  );
}
