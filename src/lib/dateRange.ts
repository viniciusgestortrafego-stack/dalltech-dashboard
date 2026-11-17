"use client";

import { useSearchParams } from "next/navigation";

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Padrão: últimos 7 dias (hoje e os 6 anteriores)
export function getDefaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 6);
  return { from: toISODate(from), to: toISODate(to) };
}

// O período vive na URL (?from=AAAA-MM-DD&to=AAAA-MM-DD), então dá para compartilhar o link
export function useDateRange(): { from: string; to: string } {
  const searchParams = useSearchParams();
  const fallback = getDefaultRange();
  return {
    from: searchParams.get("from") || fallback.from,
    to: searchParams.get("to") || fallback.to,
  };
}
