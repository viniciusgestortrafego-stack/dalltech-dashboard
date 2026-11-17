// Armazenamento JSON privado no Vercel Blob. Só importe daqui em route.ts (servidor): usa o token de leitura/escrita.
// Sem BLOB_READ_WRITE_TOKEN (desenvolvimento local), guarda em memória para dar para testar.
import { get, put } from "@vercel/blob";

// compartilhado entre as rotas (cada rota pode ter seu próprio bundle); só usado sem Blob
const globalStore = globalThis as unknown as { __dashboardMemory?: Map<string, string> };
const memory = (globalStore.__dashboardMemory ??= new Map<string, string>());
const hasBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export async function readJson<T extends object>(pathname: string, fallback: T): Promise<T> {
  try {
    if (!hasBlob()) {
      const text = memory.get(pathname);
      return text ? { ...fallback, ...JSON.parse(text) } : fallback;
    }
    const result = await get(pathname, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200) return fallback;
    const text = await new Response(result.stream).text();
    return { ...fallback, ...JSON.parse(text) };
  } catch (error) {
    console.error(`Falha ao ler ${pathname}:`, error);
    return fallback;
  }
}

export async function writeJson(pathname: string, data: object): Promise<void> {
  const text = JSON.stringify(data);
  if (!hasBlob()) {
    memory.set(pathname, text);
    return;
  }
  await put(pathname, text, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}
