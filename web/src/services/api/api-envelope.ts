export type ApiEnvelope<T> = {
    code: number;
    data: T;
    msg: string;
};

export async function requestApiData<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(path, {
        ...init,
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...(init.headers as Record<string, string> | undefined),
        },
    });
    const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
    if (!response.ok || !payload || payload.code !== 0) {
        throw new Error(payload?.msg || `Request failed: ${response.status}`);
    }
    return payload.data;
}
