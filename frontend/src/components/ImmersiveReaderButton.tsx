import { useCallback } from "react";
import { Button, Tooltip } from "@fluentui/react-components";
import { ImmersiveReader24Regular } from "@fluentui/react-icons";
import { useImmersiveReader } from "../hooks/useImmersiveReader";

interface Props {
  title: string;
  text: string;
  mimeType?: string;
  size?: "small" | "medium" | "large";
  onClose?: () => void;
}

/**
 * ImmersiveReaderButton — launches Immersive Reader for a piece of content
 * using the shared hook (which applies all user-configured settings).
 */
export function ImmersiveReaderButton({ title, text, mimeType, size = "small", onClose }: Props) {
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

    await launch(title, text, mimeType);
  }, [title, text, mimeType, launch, isOpen, onClose]);

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
