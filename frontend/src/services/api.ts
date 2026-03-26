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
    token: string | null
  ): Promise<ChatResponse> {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: this.getHeaders(token),
      body: JSON.stringify({ message, sessionId }),
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
    const res = await fetch(`${API_BASE}/api/upload`, {
      method: "POST",
      headers,
      body: formData,
    });
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    return res.json();
  }

  async textToSpeech(text: string, token: string | null): Promise<Blob> {
    const res = await fetch(`${API_BASE}/api/speech/synthesize`, {
      method: "POST",
      headers: this.getHeaders(token),
      body: JSON.stringify({ text }),
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
  ): Promise<Blob> {
    const res = await fetch(`${API_BASE}/api/speech/synthesize`, {
      method: "POST",
      headers: this.getHeaders(token),
      body: JSON.stringify({ text, voice, rate }),
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
    const res = await fetch(`${API_BASE}/api/tasks`, {
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
    const res = await fetch(`${API_BASE}/api/tasks/${encodeURIComponent(taskId)}`, {
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
      `${API_BASE}/api/tasks/${encodeURIComponent(taskId)}/steps/${encodeURIComponent(stepId)}`,
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
    const res = await fetch(`${API_BASE}/api/tasks/${encodeURIComponent(taskId)}`, {
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
      `${API_BASE}/api/tasks/${encodeURIComponent(taskId)}/remind`,
      {
        method: "POST",
        headers: this.getHeaders(token),
        body: JSON.stringify({ stepId, email }),
      }
    );
    if (!res.ok) throw new Error(`Reminder failed: ${res.status}`);
    return res.json();
  }
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
  documentId: string;
  filename: string;
  chunks: number;
  totalChars: number;
  message: string;
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
};
