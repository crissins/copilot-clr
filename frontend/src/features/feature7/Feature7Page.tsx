/**
 * Feature 7 — Speech Assistant
 *
 * Voice interaction page powered by Microsoft Agent Framework:
 *  - Speech-to-Text (STT): User records audio → backend transcribes via Azure Speech
 *  - AI Agent (gpt-5.4-nano): Transcribed text processed by Speech Assistant agent
 *  - Text-to-Speech (TTS): Agent response spoken back with calm SSML style
 *
 * Backend endpoints:
 *   POST /api/speech/recognize — Transcribe uploaded audio via Azure Speech
 *   POST /api/speech/chat     — Agent Framework speech agent (returns text + audio)
 *   POST /api/speech/synthesize — Calm-SSML TTS, returns MP3 audio
 */

import { useState, useRef, useCallback } from "react";
import {
  Button,
  Text,
  Spinner,
  makeStyles,
  tokens,
  shorthands,
  Card,
  CardHeader,
  Divider,
  Tooltip,
} from "@fluentui/react-components";
import {
  Mic24Regular,
  MicOff24Regular,
  Speaker224Regular,
  Stop24Regular,
  ArrowReset24Regular,
} from "@fluentui/react-icons";
import { apiClient } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";

// ── Types ──────────────────────────────────────────────────────────────────

interface ConversationTurn {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
}

// ── Styles ─────────────────────────────────────────────────────────────────

const useStyles = makeStyles({
  page: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    ...shorthands.padding("24px"),
    gap: "16px",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  subtitle: {
    color: tokens.colorNeutralForeground3,
  },
  conversationArea: {
    flex: 1,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    ...shorthands.padding("8px", "0"),
  },
  turnCard: {
    maxWidth: "80%",
  },
  userTurn: {
    alignSelf: "flex-end",
    backgroundColor: tokens.colorBrandBackground2,
  },
  assistantTurn: {
    alignSelf: "flex-start",
    backgroundColor: tokens.colorNeutralBackground3,
  },
  turnText: {
    whiteSpace: "pre-wrap",
    lineHeight: "1.6",
  },
  controls: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "16px",
    ...shorthands.padding("16px"),
    ...shorthands.borderTop("1px", "solid", tokens.colorNeutralStroke1),
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
  },
  recordBtn: {
    width: "64px",
    height: "64px",
    ...shorthands.borderRadius("50%"),
    fontSize: "24px",
  },
  recording: {
    backgroundColor: tokens.colorPaletteRedBackground3,
    color: tokens.colorNeutralForegroundOnBrand,
    ":hover": {
      backgroundColor: tokens.colorPaletteRedForeground1,
    },
  },
  statusText: {
    textAlign: "center",
    color: tokens.colorNeutralForeground3,
    minHeight: "20px",
  },
  emptyState: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "16px",
    color: tokens.colorNeutralForeground3,
  },
  emptyIcon: {
    fontSize: "48px",
    opacity: 0.5,
  },
  playBtn: {
    minWidth: "auto",
  },
});

// ── Component ──────────────────────────────────────────────────────────────

export function Feature7Page() {
  const styles = useStyles();
  const { getAccessToken } = useAuth();

  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [status, setStatus] = useState("Tap the microphone to start speaking.");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const conversationEndRef = useRef<HTMLDivElement | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const scrollToBottom = useCallback(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // ── Record audio ───────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await processAudio(audioBlob);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setStatus("Listening... Tap again to stop.");
    } catch {
      setStatus("Microphone access denied. Please allow microphone permissions.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  // ── Process recorded audio → STT → Agent → TTS ────────────────────────

  const processAudio = useCallback(
    async (audioBlob: Blob) => {
      setIsProcessing(true);
      setStatus("Transcribing your speech...");

      try {
        const token = await getAccessToken();

        // 1. Send audio to backend for STT
        const transcription = await apiClient.speechRecognize(audioBlob, token);
        if (!transcription.text) {
          setStatus("Could not understand the audio. Please try again.");
          setIsProcessing(false);
          return;
        }

        // Add user turn
        const userTurn: ConversationTurn = {
          id: crypto.randomUUID(),
          role: "user",
          text: transcription.text,
          timestamp: new Date().toISOString(),
        };
        setConversation((prev) => [...prev, userTurn]);
        scrollToBottom();

        // 2. Send transcribed text to speech agent (Agent Framework)
        setStatus("Thinking...");
        const agentResponse = await apiClient.speechChat(transcription.text, null, token);

        // Add assistant turn
        const assistantTurn: ConversationTurn = {
          id: crypto.randomUUID(),
          role: "assistant",
          text: agentResponse.message.content,
          timestamp: new Date().toISOString(),
        };
        setConversation((prev) => [...prev, assistantTurn]);
        scrollToBottom();

        // 3. Play audio — use base64 audio from agent if available, otherwise TTS
        setStatus("Speaking...");
        if (agentResponse.audio_base64) {
          await playBase64Audio(agentResponse.audio_base64);
        } else {
          await speakText(agentResponse.message.content, token);
        }

        setStatus("Tap the microphone to continue the conversation.");
      } catch {
        setStatus("Something went wrong. Please try again.");
      } finally {
        setIsProcessing(false);
      }
    },
    [getAccessToken, scrollToBottom],
  );

  // ── Play base64-encoded audio from agent response ──────────────────────

  const playBase64Audio = useCallback(async (base64Audio: string) => {
    try {
      setIsSpeaking(true);
      const binaryStr = atob(base64Audio);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
      const blob = new Blob([bytes], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudioRef.current = audio;

      await new Promise<void>((resolve) => {
        audio.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(url);
          currentAudioRef.current = null;
          resolve();
        };
        audio.onerror = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(url);
          currentAudioRef.current = null;
          resolve();
        };
        audio.play();
      });
    } catch {
      setIsSpeaking(false);
    }
  }, []);

  // ── TTS playback with calm SSML ───────────────────────────────────────

  const speakText = useCallback(async (text: string, token: string | null) => {
    try {
      setIsSpeaking(true);
      const audioBlob = await apiClient.speechSynthesize(text, token);
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      currentAudioRef.current = audio;

      await new Promise<void>((resolve) => {
        audio.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(url);
          currentAudioRef.current = null;
          resolve();
        };
        audio.onerror = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(url);
          currentAudioRef.current = null;
          resolve();
        };
        audio.play();
      });
    } catch {
      setIsSpeaking(false);
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  // ── Replay a specific assistant turn ──────────────────────────────────

  const replayTurn = useCallback(
    async (text: string) => {
      if (isSpeaking || isProcessing) return;
      const token = await getAccessToken();
      setStatus("Speaking...");
      await speakText(text, token);
      setStatus("Tap the microphone to continue the conversation.");
    },
    [isSpeaking, isProcessing, getAccessToken, speakText],
  );

  const clearConversation = useCallback(() => {
    setConversation([]);
    setStatus("Tap the microphone to start speaking.");
    stopSpeaking();
  }, [stopSpeaking]);

  // ── Render ────────────────────────────────────────────────────────────

  const disabled = isProcessing || isSpeaking;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <Text size={600} weight="semibold">
          Speech Assistant
        </Text>
        <Text size={300} className={styles.subtitle}>
          Speak your question and hear a calm, simplified response. Take your
          time — there is no rush.
        </Text>
      </div>

      <Divider />

      {/* Conversation area */}
      <div className={styles.conversationArea}>
        {conversation.length === 0 ? (
          <div className={styles.emptyState}>
            <Mic24Regular className={styles.emptyIcon} />
            <Text size={400}>
              Tap the microphone below and ask a question.
            </Text>
            <Text size={200} className={styles.subtitle}>
              Your speech will be transcribed, sent to the assistant, and the
              response will be read aloud in a calm voice.
            </Text>
          </div>
        ) : (
          conversation.map((turn) => (
            <Card
              key={turn.id}
              className={`${styles.turnCard} ${
                turn.role === "user" ? styles.userTurn : styles.assistantTurn
              }`}
            >
              <CardHeader
                header={
                  <Text weight="semibold" size={200}>
                    {turn.role === "user" ? "You" : "Assistant"}
                  </Text>
                }
                action={
                  turn.role === "assistant" ? (
                    <Tooltip content="Replay" relationship="label">
                      <Button
                        appearance="subtle"
                        icon={<Speaker224Regular />}
                        className={styles.playBtn}
                        disabled={disabled}
                        onClick={() => replayTurn(turn.text)}
                        aria-label="Replay this response"
                      />
                    </Tooltip>
                  ) : undefined
                }
              />
              <Text className={styles.turnText}>{turn.text}</Text>
            </Card>
          ))
        )}
        <div ref={conversationEndRef} />
      </div>

      {/* Status */}
      <Text size={200} className={styles.statusText}>
        {isProcessing ? <Spinner size="tiny" label={status} /> : status}
      </Text>

      {/* Controls */}
      <div className={styles.controls}>
        <Tooltip content="Clear conversation" relationship="label">
          <Button
            appearance="subtle"
            icon={<ArrowReset24Regular />}
            disabled={conversation.length === 0 || disabled}
            onClick={clearConversation}
            aria-label="Clear conversation"
          />
        </Tooltip>

        <Button
          className={`${styles.recordBtn} ${isRecording ? styles.recording : ""}`}
          shape="circular"
          appearance={isRecording ? "primary" : "secondary"}
          icon={
            isRecording ? <Stop24Regular /> : <Mic24Regular />
          }
          disabled={isProcessing}
          onClick={isRecording ? stopRecording : startRecording}
          aria-label={isRecording ? "Stop recording" : "Start recording"}
        />

        {isSpeaking ? (
          <Tooltip content="Stop speaking" relationship="label">
            <Button
              appearance="subtle"
              icon={<MicOff24Regular />}
              onClick={stopSpeaking}
              aria-label="Stop speaking"
            />
          </Tooltip>
        ) : (
          <div style={{ width: 32 }} />
        )}
      </div>
    </div>
  );
}
