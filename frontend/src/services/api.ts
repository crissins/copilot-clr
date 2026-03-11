/** API client for the Azure Functions backend */

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
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: this.getHeaders(token),
      body: JSON.stringify({ message, sessionId }),
    });
    if (!res.ok) throw new Error(`Chat failed: ${res.status}`);
    return res.json();
  }

  async listSessions(token: string | null): Promise<Session[]> {
    const res = await fetch("/api/sessions", {
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
    const res = await fetch("/api/sessions", {
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
    const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
      headers: this.getHeaders(token),
    });
    if (!res.ok) throw new Error(`Get session failed: ${res.status}`);
    return res.json();
  }

  async deleteSession(
    sessionId: string,
    token: string | null
  ): Promise<void> {
    const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
      headers: this.getHeaders(token),
    });
    if (!res.ok) throw new Error(`Delete session failed: ${res.status}`);
  }
}

export const apiClient = new ApiClient();
export type { ChatResponse, Session, Message, SessionDetail };
