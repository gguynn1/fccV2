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
  const response = await fetch(`/api/admin${path}`, {
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as TResponse;
}
