export const ADMIN_POLLING_INTERVAL_MS = 10_000;

export interface AdminApiErrorBody {
  error?: string;
  message?: string;
}

async function parseError(response: Response): Promise<string> {
  let message = `Request failed with status ${response.status}`;

  try {
    const body = (await response.json()) as AdminApiErrorBody;
    if (typeof body.message === "string" && body.message.length > 0) {
      message = body.message;
    }
  } catch {
    // Keep the status-based fallback when the response isn't JSON.
  }

  return message;
}

export async function adminFetch<TResponse>(path: string, init?: RequestInit): Promise<TResponse> {
  const headers = new Headers(init?.headers);
  const hasBody = init?.body !== undefined && init.body !== null;
  const bodyIsString = typeof init?.body === "string";

  if (hasBody && bodyIsString && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(`/api/admin${path}`, {
    headers,
    ...init,
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as TResponse;
}
