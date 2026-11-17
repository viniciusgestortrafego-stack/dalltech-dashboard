// Só importe isto de handlers route.ts (servidor): nunca de um componente "use client".
import { readJson, writeJson } from "./blobJson";
import { Credentials, emptyCredentials } from "./credentials";

const PATHNAME = "dashboard/credentials.json";

export async function getStoredCredentials(): Promise<Credentials> {
  return readJson<Credentials>(PATHNAME, emptyCredentials);
}

export async function saveStoredCredentials(data: Credentials): Promise<void> {
  await writeJson(PATHNAME, data);
}

export async function clearStoredCredentials(): Promise<void> {
  await saveStoredCredentials(emptyCredentials);
}
