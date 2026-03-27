/**
 * Voice Live — Real-time conversational AI via Web PubSub + Voice Live SDK
 *
 * Uses Azure Web PubSub as transport layer (SWA can't proxy WebSockets).
 * Flow:
 *   1. POST /api/voice/negotiate → get Web PubSub WebSocket URL
 *   2. Connect via WebSocket
 *   3. Stream microphone audio → WebSocket → Voice Live → Foundry Agent
 *   4. Receive audio deltas + transcripts back via WebSocket events
 *
 * This is a SEPARATE feature from Feature 7 (Speech Assistant) which uses
 * standard STT → Agent → TTS round-trips. Voice Live provides full-duplex
 * real-time conversation with semantic VAD and barge-in support.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Button,
  Text,
  Badge,
  Tooltip,
  makeStyles,
  tokens,
  shorthands,
  mergeClasses,
} from "@fluentui/react-components";
import {
  Mic24Regular,
  MicOff24Regular,
  Call24Regular,
  CallEnd24Regular,
  Speaker224Regular,
  ArrowReset24Regular,
} from "@fluentui/react-icons";
import { apiClient } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";

// ── Types ──────────────────────────────────────────────────────────────────

interface TranscriptEntry {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
}

type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

// ── Audio Worklet / MediaRecorder helpers ──────────────────────────────────

const SAMPLE_RATE = 24000;

function float32ToBase64PCM(float32: Float32Array): string {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ── Styles ─────────────────────────────────────────────────────────────────

const useStyles = makeStyles({
  page: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
    backgroundColor: tokens.colorNeutralBackground1,
  },
  contentColumn: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    maxWidth: "720px",
    width: "100%",
    margin: "0 auto",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    ...shorthands.padding("16px", "24px"),
    ...shorthands.borderBottom("1px", "solid", tokens.colorNeutralStroke1),
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  transcriptArea: {
    flex: 1,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    ...shorthands.padding("16px", "24px"),
    scrollBehavior: "smooth",
  },
  entry: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    maxWidth: "85%",
    animationDuration: "250ms",
    animationTimingFunction: "ease-out",
    animationName: {
      from: { opacity: 0, transform: "translateY(6px)" },
      to: { opacity: 1, transform: "translateY(0)" },
    },
  },
  userEntry: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },
  assistantEntry: {
    alignSelf: "flex-start",
    alignItems: "flex-start",
  },
  bubble: {
    ...shorthands.padding("10px", "14px"),
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    fontSize: tokens.fontSizeBase300,
    lineHeight: tokens.lineHeightBase400,
    wordBreak: "break-word",
  },
  userBubble: {
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorNeutralForeground1,
    borderBottomRightRadius: tokens.borderRadiusSmall,
  },
  assistantBubble: {
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground1,
    borderBottomLeftRadius: tokens.borderRadiusSmall,
  },
  timestamp: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
  },
  emptyState: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "16px",
    color: tokens.colorNeutralForeground3,
    ...shorthands.padding("32px"),
    textAlign: "center",
  },
  emptyIcon: {
    width: "72px",
    height: "72px",
    ...shorthands.borderRadius("50%"),
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    fontSize: "32px",
  },
  bottomArea: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
    ...shorthands.padding("16px", "24px", "24px"),
    ...shorthands.borderTop("1px", "solid", tokens.colorNeutralStroke1),
    backgroundColor: tokens.colorNeutralBackground2,
  },
  visualizer: {
    display: "flex",
    alignItems: "center",
    gap: "3px",
    height: "32px",
  },
  bar: {
    width: "4px",
    backgroundColor: tokens.colorBrandBackground,
    ...shorthands.borderRadius("2px"),
    transition: "height 100ms ease",
  },
  barInactive: {
    backgroundColor: tokens.colorNeutralStroke1,
  },
  controlRow: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  micBtn: {
    width: "64px",
    height: "64px",
    ...shorthands.borderRadius("50%"),
  },
  micBtnActive: {
    backgroundColor: tokens.colorPaletteRedBackground3,
    color: tokens.colorNeutralForegroundOnBrand,
    ":hover": {
      backgroundColor: tokens.colorPaletteRedForeground1,
    },
  },
  statusText: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    textAlign: "center",
    minHeight: "20px",
  },
});

// ── Component ──────────────────────────────────────────────────────────────

export function VoiceLivePage() {
  const styles = useStyles();
  const { getAccessToken } = useAuth();

  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [status, setStatus] = useState("Press Connect to start a real-time voice session.");
  const [barHeights, setBarHeights] = useState<number[]>([8, 8, 8, 8, 8]);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const playbackQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const currentTranscriptRef = useRef<string>("");

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 80);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Animate visualizer bars
  useEffect(() => {
    if (!isUserSpeaking && !isSpeaking) {
      setBarHeights([8, 8, 8, 8, 8]);
      return;
    }
    const interval = setInterval(() => {
      setBarHeights(
        Array.from({ length: 5 }, () => 8 + Math.random() * 24),
      );
    }, 120);
    return () => clearInterval(interval);
  }, [isUserSpeaking, isSpeaking]);

  // ── Audio playback (PCM base64 → AudioContext) ─────────────────────────

  const playAudioDelta = useCallback(async (base64Audio: string) => {
    playbackQueueRef.current.push(base64Audio);
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;
    setIsSpeaking(true);

    const ctx = audioContextRef.current || new AudioContext({ sampleRate: SAMPLE_RATE });
    audioContextRef.current = ctx;

    while (playbackQueueRef.current.length > 0) {
      const chunk = playbackQueueRef.current.shift()!;
      try {
        const binaryStr = atob(chunk);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        // Interpret as 16-bit PCM
        const int16 = new Int16Array(bytes.buffer);
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) {
          float32[i] = int16[i] / 0x8000;
        }
        const buffer = ctx.createBuffer(1, float32.length, SAMPLE_RATE);
        buffer.getChannelData(0).set(float32);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);

        await new Promise<void>((resolve) => {
          source.onended = () => resolve();
          source.start();
        });
      } catch {
        // Skip malformed chunk
      }
    }

    isPlayingRef.current = false;
    setIsSpeaking(false);
  }, []);

  // ── WebSocket message handler ──────────────────────────────────────────

  const handleWsMessage = useCallback((event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case "ready":
          setConnectionState("connected");
          setStatus("Connected! Speak naturally — I'm listening.");
          break;

        case "input_audio_buffer.speech_started":
          setIsUserSpeaking(true);
          setStatus("Listening...");
          break;

        case "input_audio_buffer.speech_stopped":
          setIsUserSpeaking(false);
          setStatus("Processing...");
          break;

        case "conversation.item.input_audio_transcription.completed":
          if (msg.transcript) {
            setTranscript((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: "user",
                text: msg.transcript,
                timestamp: new Date().toISOString(),
              },
            ]);
            scrollToBottom();
          }
          break;

        case "response.created":
          currentTranscriptRef.current = "";
          setStatus("Generating response...");
          break;

        case "response.audio.delta":
          if (msg.delta) {
            playAudioDelta(msg.delta);
          }
          break;

        case "response.audio_transcript.done":
          if (msg.transcript) {
            setTranscript((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: "assistant",
                text: msg.transcript,
                timestamp: new Date().toISOString(),
              },
            ]);
            scrollToBottom();
          }
          setStatus("Listening...");
          break;

        case "response.audio.done":
          // Audio stream for this response is complete
          break;

        case "response.done":
          setStatus("Your turn — speak whenever you're ready.");
          break;

        case "session.updated":
          // Calm voice configured
          break;

        case "error":
          console.error("Voice Live error:", msg.error?.message);
          setStatus(`Error: ${msg.error?.message || "Unknown error"}`);
          break;
      }
    } catch {
      // Non-JSON message — ignore
    }
  }, [scrollToBottom, playAudioDelta]);

  // ── Connect to Voice Live via Web PubSub ───────────────────────────────

  const connect = useCallback(async () => {
    setConnectionState("connecting");
    setStatus("Requesting voice session...");
    setTranscript([]);

    try {
      const token = await getAccessToken();
      console.log("[VoiceLive] Negotiating Web PubSub URL...");
      const { url } = await apiClient.negotiateVoice(token);
      console.log("[VoiceLive] Got PubSub URL, connecting WebSocket...");

      const ws = new WebSocket(url, "json.webpubsub.azure.v1");
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[VoiceLive] WebSocket opened");
        setStatus("WebSocket connected. Waiting for Voice Live...");
      };

      ws.onmessage = (event) => {
        // Web PubSub wraps messages — check for system vs user messages
        try {
          const wrapper = JSON.parse(event.data);
          if (wrapper.type === "message" && wrapper.data) {
            // Nested message from server
            const inner = typeof wrapper.data === "string"
              ? JSON.parse(wrapper.data)
              : wrapper.data;
            handleWsMessage(new MessageEvent("message", { data: JSON.stringify(inner) }));
          } else if (wrapper.type === "system" && wrapper.event === "connected") {
            console.log("[VoiceLive] PubSub system connected event, connectionId:", wrapper.connectionId);
          } else {
            // Try as direct message
            handleWsMessage(event);
          }
        } catch {
          handleWsMessage(event);
        }
      };

      ws.onerror = (ev) => {
        console.error("[VoiceLive] WebSocket error:", ev);
        setConnectionState("error");
        setStatus("Connection error. Please try again.");
      };

      ws.onclose = (ev) => {
        console.warn("[VoiceLive] WebSocket closed — code:", ev.code, "reason:", ev.reason, "wasClean:", ev.wasClean);
        setConnectionState("disconnected");
        setStatus("Disconnected. Press Connect to start again.");
        stopMicStream();
      };

      // Start microphone capture
      await startMicStream(ws);
    } catch (err: any) {
      console.error("[VoiceLive] Connection failed:", err);
      console.error("[VoiceLive] Error name:", err.name, "message:", err.message, "status:", err.status);
      setConnectionState("error");
      const msg = err.message || "Failed to connect";
      if (msg.includes("503") || msg.includes("not configured") || msg.includes("Web PubSub")) {
        setStatus("Voice Live requires Azure Web PubSub to be configured. Check your deployment settings.");
      } else if (msg.includes("502") || msg.includes("unavailable")) {
        setStatus("Voice service is temporarily unavailable. Please try again in a moment.");
      } else {
        setStatus(msg);
      }
    }
  }, [getAccessToken, handleWsMessage]);

  // ── Microphone streaming ───────────────────────────────────────────────

  const startMicStream = useCallback(async (ws: WebSocket) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: SAMPLE_RATE,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    streamRef.current = stream;

    const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
    audioContextRef.current = ctx;

    const source = ctx.createMediaStreamSource(stream);
    // Use ScriptProcessorNode (widely supported) for audio capture
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    processor.onaudioprocess = (e) => {
      if (ws.readyState !== WebSocket.OPEN || isMuted) return;
      const inputData = e.inputBuffer.getChannelData(0);
      const base64Audio = float32ToBase64PCM(inputData);

      // Send audio via Web PubSub user event (triggers CloudEvent handler)
      ws.send(JSON.stringify({
        type: "event",
        event: "message",
        dataType: "json",
        data: {
          type: "input_audio_buffer.append",
          audio: base64Audio,
        },
      }));
    };

    source.connect(processor);
    processor.connect(ctx.destination);
  }, [isMuted]);

  const stopMicStream = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // ── Disconnect ─────────────────────────────────────────────────────────

  const disconnect = useCallback(() => {
    stopMicStream();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    playbackQueueRef.current = [];
    isPlayingRef.current = false;
    setConnectionState("disconnected");
    setIsSpeaking(false);
    setIsUserSpeaking(false);
    setStatus("Disconnected. Press Connect to start again.");
  }, [stopMicStream]);

  // ── Mute toggle ────────────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach((t) => {
          t.enabled = !next;
        });
      }
      return next;
    });
  }, []);

  // ── Barge-in (cancel current response) ─────────────────────────────────

  const bargeIn = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "event",
        event: "message",
        dataType: "json",
        data: { type: "response.cancel" },
      }));
    }
    playbackQueueRef.current = [];
    isPlayingRef.current = false;
    setIsSpeaking(false);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────

  const isConnected = connectionState === "connected";
  const isConnecting = connectionState === "connecting";

  return (
    <div className={styles.page}>
      <div className={styles.contentColumn}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <Call24Regular />
            <Text size={500} weight="semibold">Voice Live</Text>
            <Badge
              color={isConnected ? "success" : isConnecting ? "warning" : "informative"}
              appearance="filled"
              size="small"
            >
              {isConnected ? "Live" : isConnecting ? "Connecting" : "Offline"}
            </Badge>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {transcript.length > 0 && (
              <Tooltip content="Clear transcript" relationship="label">
                <Button
                  appearance="subtle"
                  icon={<ArrowReset24Regular />}
                  onClick={() => setTranscript([])}
                  size="small"
                />
              </Tooltip>
            )}
            <Button
              appearance={isConnected ? "secondary" : "primary"}
              icon={isConnected ? <CallEnd24Regular /> : <Call24Regular />}
              onClick={isConnected ? disconnect : connect}
              disabled={isConnecting}
              size="medium"
            >
              {isConnecting ? "Connecting..." : isConnected ? "End Session" : "Connect"}
            </Button>
          </div>
        </div>

        <Text size={300} style={{ color: tokens.colorNeutralForeground3 }}>
          Have a natural, real-time voice conversation with AI. Just speak naturally — the AI will respond with a calm, clear voice. You can interrupt at any time.
        </Text>

        {/* Transcript area */}
        {transcript.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <Call24Regular />
            </div>
            <Text size={500} weight="semibold">Real-Time Voice Conversation</Text>
            <Text size={300} style={{ maxWidth: 420 }}>
              Voice Live provides a natural, real-time voice conversation with AI.
              It uses semantic turn-taking — just speak naturally and the AI will
              respond with a calm, clear voice. You can interrupt at any time.
            </Text>
            {!isConnected && !isConnecting && (
              <Button appearance="primary" icon={<Call24Regular />} onClick={connect}>
                Start Voice Session
              </Button>
            )}
          </div>
        ) : (
          <div className={styles.transcriptArea}>
            {transcript.map((entry) => (
              <div
                key={entry.id}
                className={mergeClasses(
                  styles.entry,
                  entry.role === "user" ? styles.userEntry : styles.assistantEntry,
                )}
              >
                <div
                  className={mergeClasses(
                    styles.bubble,
                    entry.role === "user" ? styles.userBubble : styles.assistantBubble,
                  )}
                >
                  <Text>{entry.text}</Text>
                </div>
                <span className={styles.timestamp}>
                  {new Date(entry.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
              </div>
            ))}
            <div ref={transcriptEndRef} aria-hidden />
          </div>
        )}

        {/* Bottom controls */}
        <div className={styles.bottomArea}>
          {/* Voice visualizer */}
          <div className={styles.visualizer}>
            {barHeights.map((h, i) => (
              <div
                key={i}
                className={mergeClasses(
                  styles.bar,
                  !isUserSpeaking && !isSpeaking && styles.barInactive,
                )}
                style={{ height: `${h}px` }}
              />
            ))}
          </div>

          {/* Status */}
          <Text className={styles.statusText}>{status}</Text>

          {/* Controls */}
          {isConnected && (
            <div className={styles.controlRow}>
              <Tooltip content={isMuted ? "Unmute" : "Mute"} relationship="label">
                <Button
                  appearance="subtle"
                  icon={isMuted ? <MicOff24Regular /> : <Mic24Regular />}
                  onClick={toggleMute}
                  aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
                />
              </Tooltip>

              {isSpeaking && (
                <Tooltip content="Interrupt (barge-in)" relationship="label">
                  <Button
                    appearance="subtle"
                    icon={<Speaker224Regular />}
                    onClick={bargeIn}
                    aria-label="Interrupt AI response"
                  >
                    Interrupt
                  </Button>
                </Tooltip>
              )}

              <Tooltip content="End session" relationship="label">
                <Button
                  appearance="secondary"
                  icon={<CallEnd24Regular />}
                  onClick={disconnect}
                >
                  End
                </Button>
              </Tooltip>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
