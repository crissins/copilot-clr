import { useCallback } from "react";
import { Button, Tooltip } from "@fluentui/react-components";
import { ImmersiveReader24Regular } from "@fluentui/react-icons";
import { useImmersiveReader } from "../hooks/useImmersiveReader";
import type { Message } from "../services/api";

interface Props {
  title: string;
  text: string;
  mimeType?: string;
  size?: "small" | "medium" | "large";
  onClose?: () => void;
  chatHistory?: { messages: Message[]; sessionId: string | null };
}

/**
 * ImmersiveReaderButton — launches Immersive Reader for a piece of content
 * using the shared hook (which applies all user-configured settings).
 */
export function ImmersiveReaderButton({ title, text, mimeType, size = "small", onClose, chatHistory }: Props) {
  const { launch, isOpen } = useImmersiveReader();

  const handleClick = useCallback(async () => {
    if (isOpen) return;

    // Listen for close event to trigger callback
    if (onClose) {
      const handler = () => {
        onClose();
        window.removeEventListener("immersive-reader-closed", handler);
      };
      window.addEventListener("immersive-reader-closed", handler);
    }

    await launch(title, text, mimeType, chatHistory);
  }, [title, text, mimeType, launch, isOpen, onClose, chatHistory]);

  return (
    <Tooltip content="Immersive Reader" relationship="label">
      <Button
        appearance="subtle"
        size={size}
        icon={<ImmersiveReader24Regular />}
        onClick={handleClick}
        disabled={isOpen}
        aria-label="Open in Immersive Reader"
      />
    </Tooltip>
  );
}
