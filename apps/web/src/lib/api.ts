export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: init.method ?? "GET",
      headers: init.body === undefined ? undefined : { "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError(0, "Tidak bisa terhubung ke server. Periksa koneksi internet Anda.");
  }

  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as { error?: string; fields?: Record<string, string> };
  if (!res.ok) {
    throw new ApiError(res.status, data.error ?? `Request gagal (${res.status})`, data.fields);
  }
  return data as T;
}
