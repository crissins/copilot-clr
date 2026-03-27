/**
 * Avatar Page — TTS Avatar with WebRTC
 *
 * Creates a real-time talking avatar session using Azure Speech Service.
 * Users can type text and have a visual avatar speak it back with calm SSML.
 * Supports character selection and speaking style.
 *
 * Backend: POST /api/avatar/session, POST /api/avatar/speak
 */

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Button,
  Card,
  Text,
  Textarea,
  Select,
  Spinner,
  Badge,
  Divider,
  MessageBar,
  MessageBarBody,
  makeStyles,
  tokens,
  shorthands,
} from "@fluentui/react-components";
import {
  PersonVoice24Regular,
  Play24Regular,
  PlugConnected24Regular,
  PlugDisconnected24Regular,
} from "@fluentui/react-icons";
import * as speechSdk from "microsoft-cognitiveservices-speech-sdk";
import { apiClient } from "../../services/api";
import type { AvatarSessionResult } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";

const AVATAR_CHARACTERS = [
  { value: "lisa", label: "Lisa (Casual)" },
  { value: "harry", label: "Harry (Business)" },
  { value: "max", label: "Max (Casual)" },
];

const SPEAKING_STYLES = [
  { value: "calm", label: "Calm" },
  { value: "cheerful", label: "Cheerful" },
  { value: "friendly", label: "Friendly" },
  { value: "empathetic", label: "Empathetic" },
  { value: "hopeful", label: "Hopeful" },
];

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    maxWidth: "960px",
    marginLeft: "auto",
    marginRight: "auto",
    ...shorthands.padding("24px"),
    overflowY: "auto",
    height: "100%",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  videoArea: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "400px",
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderRadius(tokens.borderRadiusXLarge),
    ...shorthands.padding("24px"),
    position: "relative" as const,
  },
  videoElement: {
    width: "100%",
    maxWidth: "640px",
    height: "auto",
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
  },
  placeholder: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "16px",
    color: tokens.colorNeutralForeground3,
  },
  placeholderIcon: {
    width: "80px",
    height: "80px",
    ...shorthands.borderRadius("50%"),
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    fontSize: "36px",
  },
  controlsCard: {
    ...shorthands.padding("20px"),
  },
  controlsRow: {
    display: "flex",
    gap: "12px",
    alignItems: "flex-end",
    flexWrap: "wrap",
  },
  textInput: {
    flex: 1,
    minWidth: "200px",
  },
  settingsRow: {
    display: "flex",
    gap: "16px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  settingsField: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  statusRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    justifyContent: "center",
  },
});

export function AvatarPage() {
  const styles = useStyles();
  const { getAccessToken } = useAuth();

  const [, setSessionData] = useState<AvatarSessionResult | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [text, setText] = useState("");
  const [character, setCharacter] = useState("lisa");
  const [style, setStyle] = useState("calm");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Click Connect to start an avatar session");

  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const synthesizerRef = useRef<speechSdk.AvatarSynthesizer | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (synthesizerRef.current) {
        try { synthesizerRef.current.close(); } catch { /* ignore */ }
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, []);

  const connectAvatar = useCallback(async () => {
    setConnecting(true);
    setError(null);
    setStatus("Requesting avatar session...");
    try {
      const token = await getAccessToken();
      const result = await apiClient.createAvatarSession(token);
      setSessionData(result);

      if (result.status !== "ready") {
        setError(result.message || "Avatar session not available.");
        setStatus("Avatar session unavailable");
        setConnecting(false);
        return;
      }

      // Set up WebRTC peer connection
      setStatus("Setting up WebRTC connection...");
      const speechConfig = speechSdk.SpeechConfig.fromAuthorizationToken(
        result.authToken!,
        result.region!,
      );

      const videoFormat = new speechSdk.AvatarVideoFormat();
      const avatarConfig = new speechSdk.AvatarConfig(
        result.avatarConfig?.character || character,
        result.avatarConfig?.style || "casual-sitting",
        videoFormat,
      );
      avatarConfig.customized = result.avatarConfig?.isPhotoAvatar || false;

      const synthesizer = new speechSdk.AvatarSynthesizer(speechConfig, avatarConfig);
      synthesizerRef.current = synthesizer;

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      peerConnectionRef.current = pc;

      pc.ontrack = (event) => {
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
          setConnected(false);
          setStatus("Connection lost. Try reconnecting.");
        }
      };

      await synthesizer.startAvatarAsync(pc);
      setConnected(true);
      setStatus("Avatar connected! Type something to make the avatar speak.");
    } catch (err: any) {
      console.error("Avatar connection failed:", err);
      const msg = err.message || "Failed to connect avatar";
      if (msg.includes("Avatar session not available") || msg.includes("unavailable") || msg.includes("unsupported_region")) {
        setError("Avatar requires Azure Speech Service in a supported region (e.g., westus2, westeurope). Check your deployment configuration.");
      } else {
        setError(msg);
      }
      setStatus("Connection failed — see error above for details");
    } finally {
      setConnecting(false);
    }
  }, [getAccessToken, character]);

  const disconnectAvatar = useCallback(() => {
    if (synthesizerRef.current) {
      try { synthesizerRef.current.close(); } catch { /* ignore */ }
      synthesizerRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setConnected(false);
    setSessionData(null);
    setStatus("Disconnected. Click Connect to start again.");
  }, []);

  const speak = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || !synthesizerRef.current) return;

    setSpeaking(true);
    setStatus("Avatar is speaking...");
    try {
      const token = await getAccessToken();
      const result = await apiClient.avatarSpeak(trimmed, token, undefined, style);

      // Use the SSML from the backend for consistent calm delivery
      await synthesizerRef.current.speakSsmlAsync(result.ssml);
      setStatus("Done speaking. Type more text or disconnect.");
      setText("");
    } catch (err: any) {
      console.error("Avatar speak failed:", err);
      setError(err.message || "Failed to speak");
      setStatus("Speak failed");
    } finally {
      setSpeaking(false);
    }
  }, [text, style, getAccessToken]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <PersonVoice24Regular />
          <Text size={600} weight="semibold">
            Talking Avatar
          </Text>
          <Badge
            color={connected ? "success" : "informative"}
            appearance="filled"
            size="small"
          >
            {connected ? "Connected" : "Offline"}
          </Badge>
        </div>
        <Button
          appearance={connected ? "secondary" : "primary"}
          icon={connected ? <PlugDisconnected24Regular /> : <PlugConnected24Regular />}
          onClick={connected ? disconnectAvatar : connectAvatar}
          disabled={connecting}
        >
          {connecting ? "Connecting..." : connected ? "Disconnect" : "Connect Avatar"}
        </Button>
      </div>
      <Text size={300} style={{ color: tokens.colorNeutralForeground3 }}>
        Connect to a visual avatar that reads text aloud for you. Type or paste text, choose a speaking style, and the avatar will explain it in a calm, friendly way.
      </Text>

      {error && (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}

      {/* Video area */}
      <div className={styles.videoArea}>
        {connected ? (
          <video
            ref={videoRef}
            className={styles.videoElement}
            autoPlay
            playsInline
          />
        ) : (
          <div className={styles.placeholder}>
            <div className={styles.placeholderIcon}>
              <PersonVoice24Regular />
            </div>
            <Text size={400} weight="semibold">
              {connecting ? "Connecting to avatar..." : "Avatar Preview"}
            </Text>
            <Text size={300}>
              Connect to see your talking avatar. It will speak with calm, clear delivery.
            </Text>
            {connecting && <Spinner size="small" />}
          </div>
        )}
        <div className={styles.statusRow}>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            {status}
          </Text>
        </div>
      </div>

      {/* Settings */}
      <Card className={styles.controlsCard}>
        <div className={styles.settingsRow}>
          <div className={styles.settingsField}>
            <Text size={200} weight="semibold">Character</Text>
            <Select
              value={character}
              onChange={(_, d) => setCharacter(d.value)}
              disabled={connected}
            >
              {AVATAR_CHARACTERS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </Select>
          </div>
          <div className={styles.settingsField}>
            <Text size={200} weight="semibold">Speaking Style</Text>
            <Select value={style} onChange={(_, d) => setStyle(d.value)}>
              {SPEAKING_STYLES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </Select>
          </div>
        </div>

        <Divider style={{ margin: "12px 0" }} />

        {/* Text input + speak button */}
        <div className={styles.controlsRow}>
          <Textarea
            className={styles.textInput}
            value={text}
            onChange={(_, d) => setText(d.value)}
            placeholder="Type something for the avatar to say..."
            disabled={!connected || speaking}
            resize="none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                speak();
              }
            }}
          />
          <Button
            appearance="primary"
            icon={speaking ? <Spinner size="tiny" /> : <Play24Regular />}
            onClick={speak}
            disabled={!connected || !text.trim() || speaking}
          >
            {speaking ? "Speaking..." : "Speak"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
