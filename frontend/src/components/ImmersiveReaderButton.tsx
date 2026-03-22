import { useCallback } from "react";
import { useImmersiveReader } from "../hooks/useImmersiveReader";

interface Props {
  title: string;
  text: string;
  mimeType?: string;
}

/**
 * ImmersiveReaderButton — launches Immersive Reader for a piece of content
 * using the shared hook (which applies all user-configured settings).
 */
export function ImmersiveReaderButton({ title, text, mimeType }: Props) {
  const { launch, isOpen } = useImmersiveReader();

  const handleClick = useCallback(async () => {
    if (isOpen) return;
    await launch(title, text, mimeType);
  }, [title, text, mimeType, launch, isOpen]);

  return (
    <button
      onClick={handleClick}
      disabled={isOpen}
      className="btn-icon"
      aria-label="Open in Immersive Reader"
      title="Immersive Reader (line focus, syllables, picture dictionary, translation)"
    >
      &#x1F4D6;
    </button>
  );
}
