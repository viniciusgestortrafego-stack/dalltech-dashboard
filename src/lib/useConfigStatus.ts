"use client";

import { useEffect, useState } from "react";

export type ConfigStatus = {
  adAccountId: string;
  instagramAccountId: string;
  wooStoreUrl: string;
  hasMeta: boolean;
  hasInstagram: boolean;
  hasWoo: boolean;
  hasGoogleAds: boolean;
};

const EMPTY: ConfigStatus = {
  adAccountId: "",
  instagramAccountId: "",
  wooStoreUrl: "",
  hasMeta: false,
  hasInstagram: false,
  hasWoo: false,
  hasGoogleAds: false,
};

// Diz às páginas o que já está configurado (sem expor nenhum segredo)
export function useConfigStatus() {
  const [status, setStatus] = useState<ConfigStatus>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/config-status")
      .then((res) => res.json())
      .then((data) => setStatus({ ...EMPTY, ...data }))
      .catch(() => setStatus(EMPTY))
      .finally(() => setLoaded(true));
  }, []);

  return { status, loaded };
}
