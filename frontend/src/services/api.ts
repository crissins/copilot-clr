/** API client for the Container Apps backend */

// Base URL: empty for SWA proxied API, or full URL for direct Container App access
const API_BASE = import.meta.env.VITE_API_BASE || "";

interface ChatResponse {
  sessionId: string;
  message: {
    id: string;
    role: "assistant";
    content: string;
    createdAt: string;
  };
}

interface Session {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  starred?: boolean;
}

interface Message {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface SessionDetail {
  session: Session;
  messages: Message[];
}

class ApiClient {
  private getHeaders(token: string | null): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }

  async sendMessage(
    message: string,
    sessionId: string | null,
    token: string | null,
  ): Promise<ChatResponse> {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: this.getHeaders(token),
      body: JSON.stringify({
        message,
        sessionId,
      }),
    });
    if (!res.ok) throw new Error(`Chat failed: ${res.status}`);
    return res.json();
  }

  async listSessions(token: string | null): Promise<Session[]> {
    const res = await fetch(`${API_BASE}/api/sessions`, {
      headers: this.getHeaders(token),
    });
    if (!res.ok) throw new Error(`List sessions failed: ${res.status}`);
    const data = await res.json();
    return data.sessions;
  }

  async createSession(
    title: string,
    token: string | null
  ): Promise<Session> {
    const res = await fetch(`${API_BASE}/api/sessions`, {
      method: "POST",
      headers: this.getHeaders(token),
      body: JSON.stringify({ title }),
    });
    if (!res.ok) throw new Error(`Create session failed: ${res.status}`);
    return res.json();
  }

  async getSession(
    sessionId: string,
    token: string | null
  ): Promise<SessionDetail> {
    const res = await fetch(`${API_BASE}/api/sessions/${encodeURIComponent(sessionId)}`, {
      headers: this.getHeaders(token),
    });
    if (!res.ok) throw new Error(`Get session failed: ${res.status}`);
    return res.json();
  }

  async deleteSession(
    sessionId: string,
    token: string | null
  ): Promise<void> {
    const res = await fetch(`${API_BASE}/api/sessions/${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
      headers: this.getHeaders(token),
    });
    if (!res.ok) throw new Error(`Delete session failed: ${res.status}`);
  }

  async toggleStarSession(
    sessionId: string,
    token: string | null
  ): Promise<Session> {
    const res = await fetch(`${API_BASE}/api/sessions/${encodeURIComponent(sessionId)}/star`, {
      method: "PATCH",
      headers: this.getHeaders(token),
    });
    if (!res.ok) throw new Error(`Toggle star failed: ${res.status}`);
    return res.json();
  }

  async getPreferences(token: string | null): Promise<UserPreferences> {
    const res = await fetch(`${API_BASE}/api/prefs`, {
      headers: this.getHeaders(token),
    });
    if (!res.ok) throw new Error(`Get prefs failed: ${res.status}`);
    return res.json();
  }

  async updatePreferences(
    prefs: Partial<UserPreferences>,
    token: string | null
  ): Promise<UserPreferences> {
    const res = await fetch(`${API_BASE}/api/prefs`, {
      method: "PUT",
      headers: this.getHeaders(token),
      body: JSON.stringify(prefs),
    });
    if (!res.ok) throw new Error(`Update prefs failed: ${res.status}`);
    return res.json();
  }

  async uploadDocument(file: File, token: string | null): Promise<UploadResult> {
    const formData = new FormData();
    formData.append("file", file);
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/api/content/upload`, {
      method: "POST",
      headers,
      body: formData,
    });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    return res.json();
  }

  async textToSpeech(text: string, token: string | null, lang?: string): Promise<Blob> {
    const res = await fetch(`${API_BASE}/api/speech/synthesize`, {
      method: "POST",
      headers: this.getHeaders(token),
      body: JSON.stringify({ text, lang }),
    });
    if (!res.ok) throw new Error(`TTS failed: ${res.status}`);
    return res.blob();
  }

  async getSpeechToken(
    token: string | null
  ): Promise<{ authToken: string; region: string }> {
    const res = await fetch(`${API_BASE}/api/speech/token`, {
      method: "POST",
      headers: this.getHeaders(token),
    });
    if (!res.ok) throw new Error(`Speech token failed: ${res.status}`);
    return res.json();
  }

  async speechChat(
    message: string,
    sessionId: string | null,
    token: string | null
  ): Promise<{ sessionId: string; message: { role: string; content: string }; audio_base64: string }> {
    const res = await fetch(`${API_BASE}/api/speech/chat`, {
      method: "POST",
      headers: this.getHeaders(token),
      body: JSON.stringify({ message, sessionId }),
    });
    if (!res.ok) throw new Error(`Speech chat failed: ${res.status}`);
    return res.json();
  }

  async speechSynthesize(
    text: string,
    token: string | null,
    voice?: string,
    rate?: string,
    lang?: string,
  ): Promise<Blob> {
    const res = await fetch(`${API_BASE}/api/speech/synthesize`, {
      method: "POST",
      headers: this.getHeaders(token),
      body: JSON.stringify({ text, voice, rate, lang }),
    });
    if (!res.ok) throw new Error(`Speech synthesis failed: ${res.status}`);
    return res.blob();
  }

  /** Get a Web PubSub WebSocket URL for real-time voice sessions. */
  async negotiateVoice(
    token: string | null
  ): Promise<{ url: string }> {
    const res = await fetch(`${API_BASE}/api/voice/negotiate`, {
      method: "POST",
      headers: this.getHeaders(token),
    });
    if (!res.ok) throw new Error(`Voice negotiate failed: ${res.status}`);
    return res.json();
  }

  async getIRToken(token: string | null): Promise<{ token: string; subdomain: string }> {
    const res = await fetch(`${API_BASE}/api/ir-token`, {
      method: "POST",
      headers: this.getHeaders(token),
    });
    if (!res.ok) throw new Error(`IR token failed: ${res.status}`);
    return res.json();
  }

  async reportMessage(
    messageId: string,
    sessionId: string,
    reason: string,
    token: string | null
  ): Promise<void> {
    const res = await fetch(`${API_BASE}/api/report`, {
      method: "POST",
      headers: this.getHeaders(token),
      body: JSON.stringify({ messageId, sessionId, reason }),
    });
    if (!res.ok) throw new Error(`Report failed: ${res.status}`);
  }

  // ── Task Decomposer ─────────────────────────────────────────────────────

  async decomposeTask(
    goal: string,
    readingLevel: string,
    token: string | null
  ): Promise<DecomposeResponse> {
    const res = await fetch(`${API_BASE}/api/tasks/decompose`, {
      method: "POST",
      headers: this.getHeaders(token),
      body: JSON.stringify({ goal, readingLevel }),
    });
    if (!res.ok) throw new Error(`Decompose failed: ${res.status}`);
    return res.json();
  }

  async listTaskPlans(token: string | null): Promise<TaskPlan[]> {
    const res = await fetch(`${API_BASE}/api/tasks/plans`, {
      headers: this.getHeaders(token),
    });
    if (!res.ok) throw new Error(`List tasks failed: ${res.status}`);
    const data = await res.json();
    return data.tasks;
  }

  async getTaskPlan(
    taskId: string,
    token: string | null
  ): Promise<TaskPlan> {
    const res = await fetch(`${API_BASE}/api/tasks/plans/${encodeURIComponent(taskId)}`, {
      headers: this.getHeaders(token),
    });
    if (!res.ok) throw new Error(`Get task failed: ${res.status}`);
    const data = await res.json();
    return data.task;
  }

  async toggleStep(
    taskId: string,
    stepId: string,
    completed: boolean,
    token: string | null
  ): Promise<TaskPlan> {
    const res = await fetch(
      `${API_BASE}/api/tasks/plans/${encodeURIComponent(taskId)}/steps/${encodeURIComponent(stepId)}`,
      {
        method: "PATCH",
        headers: this.getHeaders(token),
        body: JSON.stringify({ completed }),
      }
    );
    if (!res.ok) throw new Error(`Toggle step failed: ${res.status}`);
    const data = await res.json();
    return data.task;
  }

  async deleteTaskPlan(
    taskId: string,
    token: string | null
  ): Promise<void> {
    const res = await fetch(`${API_BASE}/api/tasks/plans/${encodeURIComponent(taskId)}`, {
      method: "DELETE",
      headers: this.getHeaders(token),
    });
    if (!res.ok) throw new Error(`Delete task failed: ${res.status}`);
  }

  async sendReminder(
    taskId: string,
    stepId: string,
    email: string,
    token: string | null
  ): Promise<{ status: string; message: string }> {
    const res = await fetch(
      `${API_BASE}/api/tasks/plans/${encodeURIComponent(taskId)}/remind`,
      {
        method: "POST",
        headers: this.getHeaders(token),
        body: JSON.stringify({ stepId, email }),
      }
    );
    if (!res.ok) throw new Error(`Reminder failed: ${res.status}`);
    return res.json();
  }

  async getSettings(token: string | null, signal?: AbortSignal): Promise<NeurodiverseSettings> {
    const res = await fetch(`${API_BASE}/api/settings`, {
      headers: this.getHeaders(token),
      signal,
    });
    if (!res.ok) throw new Error(`Get settings failed: ${res.status}`);
    return res.json();
  }

  async updateSettings(
    settings: Partial<NeurodiverseSettings>,
    token: string | null
  ): Promise<NeurodiverseSettings> {
    const res = await fetch(`${API_BASE}/api/settings`, {
      method: "PUT",
      headers: this.getHeaders(token),
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error(`Update settings failed: ${res.status}`);
    return res.json();
  }

  // ── Tasks API ──

  async getTasks(token: string | null): Promise<{ tasks: Task[] }> {
    const res = await fetch(`${API_BASE}/api/tasks`, {
      headers: this.getHeaders(token),
    });
    if (!res.ok) throw new Error(`Get tasks failed: ${res.status}`);
    return res.json();
  }

  async createTask(
    task: { title: string; description?: string; priority?: string; dueDate?: string },
    token: string | null
  ): Promise<Task> {
    const res = await fetch(`${API_BASE}/api/tasks`, {
      method: "POST",
      headers: this.getHeaders(token),
      body: JSON.stringify(task),
    });
    if (!res.ok) throw new Error(`Create task failed: ${res.status}`);
    return res.json();
  }

  async updateTask(
    taskId: string,
    updates: Partial<Task>,
    token: string | null
  ): Promise<Task> {
    const res = await fetch(`${API_BASE}/api/tasks/${taskId}`, {
      method: "PUT",
      headers: this.getHeaders(token),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error(`Update task failed: ${res.status}`);
    return res.json();
  }

  async deleteTask(taskId: string, token: string | null): Promise<void> {
    const res = await fetch(`${API_BASE}/api/tasks/${taskId}`, {
      method: "DELETE",
      headers: this.getHeaders(token),
    });
    if (!res.ok) throw new Error(`Delete task failed: ${res.status}`);
  }

  async synthesizeOnboardingSsml(ssml: string, token: string | null): Promise<Blob> {
    const res = await fetch(`${API_BASE}/api/speech/onboarding`, {
      method: "POST",
      headers: this.getHeaders(token),
      body: JSON.stringify({ ssml }),
    });
    if (!res.ok) throw new Error(`Onboarding TTS failed: ${res.status}`);
    return res.blob();
  }

  // ── Content Library ────────────────────────────────────────────────────

  async listContent(token: string | null): Promise<ContentItem[]> {
    const res = await fetch(`${API_BASE}/api/content`, {
      headers: this.getHeaders(token),
    });
    if (!res.ok) throw new Error(`List content failed: ${res.status}`);
    const data = await res.json();
    return data.content;
  }

  async getContent(contentId: string, token: string | null): Promise<ContentDetail> {
    const res = await fetch(`${API_BASE}/api/content/${encodeURIComponent(contentId)}`, {
      headers: this.getHeaders(token),
    });
    if (!res.ok) throw new Error(`Get content failed: ${res.status}`);
    return res.json();
  }

  // ── Feedback ────────────────────────────────────────────────────────

  async submitFeedback(
    feedback: { comment: string; rating: number; category: string },
    token: string | null,
  ): Promise<FeedbackItem> {
    const res = await fetch(`${API_BASE}/api/feedback`, {
      method: "POST",
      headers: this.getHeaders(token),
      body: JSON.stringify(feedback),
    });
    if (!res.ok) throw new Error(`Submit feedback failed: ${res.status}`);
    return res.json();
  }

  async listFeedback(token: string | null): Promise<FeedbackItem[]> {
    const res = await fetch(`${API_BASE}/api/feedback`, {
      headers: this.getHeaders(token),
    });
    if (!res.ok) throw new Error(`List feedback failed: ${res.status}`);
    const data = await res.json();
    return data.feedback;
  }

  // ── Content Adaptation ──────────────────────────────────────────────

  async adaptContent(
    contentId: string,
    profile: string,
    token: string | null,
  ): Promise<AdaptationResult> {
    const res = await fetch(`${API_BASE}/api/content/${encodeURIComponent(contentId)}/adapt`, {
      method: "POST",
      headers: this.getHeaders(token),
      body: JSON.stringify({ profile }),
    });
    if (!res.ok) throw new Error(`Adapt content failed: ${res.status}`);
    return res.json();
  }

  async deleteContent(contentId: string, token: string | null): Promise<void> {
    const res = await fetch(`${API_BASE}/api/content/${encodeURIComponent(contentId)}`, {
      method: "DELETE",
      headers: this.getHeaders(token),
    });
    if (!res.ok) throw new Error(`Delete content failed: ${res.status}`);
  }

  // ── Reminders ───────────────────────────────────────────────────────

  async createReminder(
    reminder: { title: string; description?: string; scheduledTime: string; channel?: string; recurring?: string; intervalMinutes?: number },
    token: string | null,
  ): Promise<Reminder> {
    const res = await fetch(`${API_BASE}/api/reminders`, {
      method: "POST",
      headers: this.getHeaders(token),
      body: JSON.stringify(reminder),
    });
    if (!res.ok) throw new Error(`Create reminder failed: ${res.status}`);
    return res.json();
  }

  async listReminders(token: string | null, status?: string): Promise<Reminder[]> {
    const params = status ? `?status=${status}` : "";
    const res = await fetch(`${API_BASE}/api/reminders${params}`, {
      headers: this.getHeaders(token),
    });
    if (!res.ok) throw new Error(`List reminders failed: ${res.status}`);
    return res.json();
  }

  async updateReminder(
    id: string,
    updates: Partial<Reminder>,
    token: string | null,
  ): Promise<Reminder> {
    const res = await fetch(`${API_BASE}/api/reminders/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: this.getHeaders(token),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error(`Update reminder failed: ${res.status}`);
    return res.json();
  }

  async deleteReminder(id: string, token: string | null): Promise<void> {
    const res = await fetch(`${API_BASE}/api/reminders/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: this.getHeaders(token),
    });
    if (!res.ok) throw new Error(`Delete reminder failed: ${res.status}`);
  }

  // ── Adaptive Insights ──────────────────────────────────────────────

  async getInsights(token: string | null): Promise<UserInsights> {
    const res = await fetch(`${API_BASE}/api/insights`, {
      headers: this.getHeaders(token),
    });
    if (!res.ok) throw new Error(`Get insights failed: ${res.status}`);
    return res.json();
  }

  // ── Avatar ──────────────────────────────────────────────────────────

  async createAvatarSession(token: string | null): Promise<AvatarSessionResult> {
    const res = await fetch(`${API_BASE}/api/avatar/session`, {
      method: "POST",
      headers: this.getHeaders(token),
    });
    if (!res.ok) throw new Error(`Avatar session failed: ${res.status}`);
    return res.json();
  }

  async avatarSpeak(
    text: string,
    token: string | null,
    voice?: string,
    style?: string,
  ): Promise<AvatarSpeakResult> {
    const res = await fetch(`${API_BASE}/api/avatar/speak`, {
      method: "POST",
      headers: this.getHeaders(token),
      body: JSON.stringify({ text, voice, style }),
    });
    if (!res.ok) throw new Error(`Avatar speak failed: ${res.status}`);
    return res.json();
  }

  // ── Video Indexer ───────────────────────────────────────────────────

  async analyzeVideo(
    contentId: string,
    token: string | null,
  ): Promise<VideoAnalysisResult> {
    const res = await fetch(`${API_BASE}/api/content/${encodeURIComponent(contentId)}/analyze-video`, {
      method: "POST",
      headers: this.getHeaders(token),
    });
    if (!res.ok) throw new Error(`Video analysis failed: ${res.status}`);
    return res.json();
  }
}

interface UserPreferences {
  id: string;
  userId: string;
  readingLevel: string;
  preferredFormat: string;
  voiceSpeed: string;
  fontSize: string;
  highContrast: boolean;
  theme: string;
  language: string;
}

interface UploadResult {
  contentId: string;
  filename: string;
  fileType: string;
  chunks: number;
  processingMs: number;
  status: string;
}

interface NeurodiverseSettings {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  readingLevel: string;
  preferredFormat: string;
  voiceSpeed: string;
  fontSize: string;
  highContrast: boolean;
  theme: string;
  language: string;
  fontFamily: string;
  lineSpacing: string;
  reducedMotion: boolean;
  focusTimerMinutes: number;
  breakReminderMinutes: number;
  notificationStyle: string;
  responseLengthPreference: string;
  dyslexiaFont: boolean;
  colorOverlay: string;
  autoReadResponses: boolean;
  preferredVoice: string;
  textAlignment: string;
  updatedAt?: string;
}

interface Task {
  id: string;
  userId: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
}

interface TaskStep {
  id: string;
  title: string;
  estimatedMinutes: number;
  priority: "high" | "medium" | "low";
  focusTip: string;
  completed: boolean;
  completedAt: string | null;
}

interface TaskPlan {
  id: string;
  userId: string;
  goal: string;
  steps: TaskStep[];
  explanation: string;
  readingLevel: string;
  createdAt: string;
  updatedAt: string;
}

interface DecomposeResponse {
  task: TaskPlan;
  meta: { latencyMs: number };
}

interface ContentItem {
  id: string;
  filename: string;
  fileType: string;
  status: string;
  chunkCount: number;
  createdAt: string;
}

interface ContentDetail {
  content: ContentItem & { extractedText?: string; blobUrl?: string; extraction?: Record<string, unknown> };
  adaptations: Array<{
    id: string;
    profile: string;
    summary: string;
    changeSummary?: string;
    originalWordCount?: number;
    adaptedWordCount?: number;
    reductionPercent?: number;
    adaptedText: string;
    createdAt: string;
  }>;
}

interface FeedbackItem {
  id: string;
  userId: string;
  comment: string;
  rating: number;
  category: string;
  createdAt: string;
}

interface AdaptationResult {
  adaptedContentId: string;
  profile: string;
  summary: string;
  audioChunks: number;
  tasks: number;
  adaptationMs: number;
}

interface Reminder {
  id: string;
  userId: string;
  title: string;
  description: string;
  scheduledTime: string;
  channel: string;
  recurring: string | null;
  intervalMinutes: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface UserInsights {
  totalSessions: number;
  totalMessages: number;
  totalTokensUsed: number;
  totalTaskPlans: number;
  totalSteps: number;
  completedSteps: number;
  completionRate: number;
  totalUploads: number;
  totalAdaptations: number;
  wordsSaved: number;
  preferredReadingLevel: string;
  readingLevelsUsed: Record<string, number>;
  suggestions: string[];
}

interface AvatarSessionResult {
  status: string;
  message?: string;
  authToken?: string;
  region?: string;
  endpoint?: string;
  avatarConfig?: {
    character: string;
    style: string;
    isPhotoAvatar: boolean;
    voice: string;
    transparentBackground: boolean;
    videoFormat: { width: number; height: number };
  };
  supported_regions?: string[];
}

interface AvatarSpeakResult {
  ssml: string;
  voice: string;
  text_length: number;
  estimated_duration_s: number;
}

interface VideoAnalysisResult {
  transcript: string;
  topics: string[];
  scenes: Array<{ start: string; end: string }>;
  keywords: string[];
  source: string;
}

export const apiClient = new ApiClient();
export type {
  ChatResponse,
  Session,
  Message,
  SessionDetail,
  UserPreferences,
  UploadResult,
  NeurodiverseSettings,
  Task,
  TaskStep,
  TaskPlan,
  DecomposeResponse,
  ContentItem,
  ContentDetail,
  FeedbackItem,
  AdaptationResult,
  Reminder,
  UserInsights,
  AvatarSessionResult,
  AvatarSpeakResult,
  VideoAnalysisResult,
};
