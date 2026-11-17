// Credenciais e IDs do cliente, salvos no servidor (Vercel Blob) pela página de Configurações.
export type Credentials = {
  metaToken: string;
  adAccountId: string;
  instagramAccountId: string;
  wooStoreUrl: string;
  wooConsumerKey: string;
  wooConsumerSecret: string;
  googleAdsWebhookSecret: string;
};

export const emptyCredentials: Credentials = {
  metaToken: "",
  adAccountId: "",
  instagramAccountId: "",
  wooStoreUrl: "",
  wooConsumerKey: "",
  wooConsumerSecret: "",
  googleAdsWebhookSecret: "",
};

// Aceita só os campos conhecidos, como texto, sem espaços nas pontas
export function sanitizeCredentials(input: unknown): Credentials {
  const source = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const result = { ...emptyCredentials };
  for (const key of Object.keys(emptyCredentials) as (keyof Credentials)[]) {
    const value = source[key];
    if (typeof value === "string") result[key] = value.trim().slice(0, 4096);
  }
  return result;
}

// "act_123", "123" ou "https://...act=123" → "act_123"
export function normalizeAdAccountId(value: string): string {
  const digits = value.match(/\d{5,}/)?.[0];
  return digits ? `act_${digits}` : "";
}
