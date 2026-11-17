"use client";

import { Suspense, useEffect, useState } from "react";
import { CircleUser, Eye, Heart, Radar, UserPlus } from "lucide-react";
import { MetricCard } from "@/components/ui/MetricCard";
import { DataStatus } from "@/components/ui/DataStatus";
import { MediaGrid } from "@/components/ui/MediaGrid";
import { formatNumber } from "@/lib/format";
import { useDateRange } from "@/lib/dateRange";
import { useConfigStatus } from "@/lib/useConfigStatus";
import {
  InstagramFetchError,
  fetchInstagramMedia,
  fetchInstagramSummary,
  type InstagramMediaItem,
  type InstagramSummary,
} from "@/lib/instagram";

function InstagramContent() {
  const { status, loaded } = useConfigStatus();
  const { from, to } = useDateRange();
  const [summary, setSummary] = useState<InstagramSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [media, setMedia] = useState<InstagramMediaItem[]>([]);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);

  useEffect(() => {
    if (!loaded || !status.hasInstagram) return;
    setSummaryLoading(true);
    setSummaryError(null);
    fetchInstagramSummary({ instagramAccountId: status.instagramAccountId, since: from, until: to })
      .then(setSummary)
      .catch((e) => setSummaryError(e instanceof InstagramFetchError ? e.message : "Erro ao buscar dados do Instagram"))
      .finally(() => setSummaryLoading(false));
  }, [loaded, status.hasInstagram, status.instagramAccountId, from, to]);

  useEffect(() => {
    if (!loaded || !status.hasInstagram) return;
    setMediaLoading(true);
    setMediaError(null);
    fetchInstagramMedia({ instagramAccountId: status.instagramAccountId })
      .then(setMedia)
      .catch((e) => setMediaError(e instanceof InstagramFetchError ? e.message : "Erro ao buscar conteúdos do Instagram"))
      .finally(() => setMediaLoading(false));
  }, [loaded, status.hasInstagram, status.instagramAccountId]);

  const summaryStatus = DataStatus({
    configured: status.hasInstagram,
    loading: summaryLoading,
    error: summaryError,
    configureMessage: "Configure o ID da conta do Instagram em Configurações para ver os números do perfil.",
  });
  const mediaStatus = DataStatus({
    configured: status.hasInstagram,
    loading: mediaLoading,
    error: mediaError,
    configureMessage: "Configure o ID da conta do Instagram em Configurações para ver os conteúdos.",
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary">Instagram</h1>
        <p className="text-gray-400">Números da conta no período selecionado</p>
      </div>

      {summaryStatus ?? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard title="Visualizações" value={formatNumber(summary?.views ?? 0)} subtitle="conteúdo visualizado" icon={<Eye size={18} />} />
          <MetricCard title="Seguidores" value={formatNumber(summary?.followerChange ?? 0)} subtitle="variação líquida no período" icon={<UserPlus size={18} />} />
          <MetricCard title="Interações" value={formatNumber(summary?.interactions ?? 0)} subtitle="curtidas, comentários, envios e salvamentos" icon={<Heart size={18} />} />
          <MetricCard title="Contas Alcançadas" value={formatNumber(summary?.reach ?? 0)} subtitle="perfis únicos que viram o conteúdo" icon={<Radar size={18} />} />
          <MetricCard title="Visitas ao Perfil" value={formatNumber(summary?.profileViews ?? 0)} subtitle="visitas diretas no perfil" icon={<CircleUser size={18} />} />
        </div>
      )}

      <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
        <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider mb-6">Últimos Conteúdos</h2>
        {mediaStatus ?? <MediaGrid items={media} />}
      </div>
    </div>
  );
}

export default function InstagramPage() {
  return (
    <Suspense fallback={<div className="text-gray-400">Carregando...</div>}>
      <InstagramContent />
    </Suspense>
  );
}
