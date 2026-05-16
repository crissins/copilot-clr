const API_BASE_URL = "http://localhost:8000";

export type SimplifyRequest = {
  text: string;
  title?: string;
  language?: string;
};

export type SimplifyResponse = {
  original_text: string;
  simplified_text: string;
  summary?: string;
  steps?: string[];
  reading_level?: string;
  accessibility_preset?: string;
};

export type ReaderTokenResponse = {
  token: string;
  subdomain: string;
  expires_in: number;
};

export async function simplifyDocument(payload: SimplifyRequest): Promise<SimplifyResponse> {
  const response = await fetch(`${API_BASE_URL}/api/simplify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al simplificar: ${errorText}`);
  }

  return response.json();
}

export async function getImmersiveReaderToken(): Promise<ReaderTokenResponse> {
  const response = await fetch(`${API_BASE_URL}/api/immersive-reader/token`, {
    method: "GET",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al obtener token: ${errorText}`);
  }

  return response.json();
}