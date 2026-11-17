"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { Activity, DollarSign, ExternalLink, Link as LinkIcon, MousePointerClick, Percent, Users } from "lucide-react";
import { MetricCard } from "@/components/ui/MetricCard";
import { StepFunnel } from "@/components/ui/StepFunnel";
import { DataStatus } from "@/components/ui/DataStatus";
import { TimelineChart } from "@/components/charts/TimelineChart";
import { useConfigStatus } from "@/lib/useConfigStatus";
import { useDateRange } from "@/lib/dateRange";
import { formatBRL, formatNumber, formatPercent, formatShortDate } from "@/lib/format";
import { aggregateSalesRows, filterRowsByRange, type SalesRow } from "@/lib/sales";
import {
  EntityPerformanceRow,
  MetaFetchError,
  fetchDailyLeadRows,
  fetchLeadEntityPerformance,
} from "@/lib/metaEntities";
import { siteConfig } from "@/config/site";

type LeadListProps = {
  title: string;
  rows: EntityPerformanceRow[];
  status: ReactNode | null;
  showThumbnails?: boolean;
};

function LeadList({ title, rows, status, showThumbnails }: LeadListProps) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
      <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider mb-6">{title}</h2>
      {status ??
        (rows.length > 0 ? (
          <div className="space-y-4">
            {rows.slice(0, 5).map((row) => (
              <div
                key={row.id}
                className="flex justify-between items-center text-sm border-b border-card-border pb-2 last:border-0 gap-3"
              >
                {showThumbnails ? (
                  <a
                    href={row.permalinkUrl || row.thumbnailUrl || row.managerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 min-w-0 font-bold hover:text-primary transition-colors"
                  >
                    {row.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={row.thumbnailUrl}
                        alt={row.name}
                        className="w-8 h-8 rounded-md object-cover shrink-0 bg-black/10"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-md shrink-0 bg-black/10 dark:bg-white/10" />
                    )}
                    <span className="truncate" title={row.name}>
                      {row.name}
                    </span>
                    <ExternalLink size={12} className="text-gray-400 shrink-0" />
                  </a>
                ) : (
                  <span className="font-bold truncate" title={row.name}>
                    {row.name}
                  </span>
                )}
                <span className="text-gray-400 shrink-0">{formatNumber(row.purchases)} contatos</span>
                <span className="font-bold text-primary shrink-0">{formatBRL(row.cpa)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-32 flex items-center justify-center text-gray-500">Sem contatos no período selecionado</div>
        ))}
    </div>
  );
}

function CaptacaoLeadsContent() {
  const { status, loaded } = useConfigStatus();
  const { from, to } = useDateRange();

  const [dailyRows, setDailyRows] = useState<SalesRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [adsets, setAdsets] = useState<EntityPerformanceRow[]>([]);
  const [ads, setAds] = useState<EntityPerformanceRow[]>([]);
  const [entityError, setEntityError] = useState<string | null>(null);
  const [entityLoading, setEntityLoading] = useState(false);

  useEffect(() => {
    if (!loaded || !status.hasMeta) return;
    setLoading(true);
    setError(null);
    fetchDailyLeadRows({ adAccountId: status.adAccountId, since: from, until: to })
      .then(setDailyRows)
      .catch((err) => setError(err instanceof MetaFetchError ? err.message : "Erro ao buscar dados do Meta Ads"))
      .finally(() => setLoading(false));
  }, [loaded, status.hasMeta, status.adAccountId, from, to]);

  useEffect(() => {
    if (!loaded || !status.hasMeta) return;
    const adAccountId = status.adAccountId;
    setEntityLoading(true);
    setEntityError(null);
    Promise.all([
      fetchLeadEntityPerformance({ adAccountId, level: "adset", since: from, until: to }),
      fetchLeadEntityPerformance({ adAccountId, level: "ad", since: from, until: to }),
    ])
      .then(([adsetRows, adRows]) => {
        setAdsets(adsetRows);
        setAds(adRows);
      })
      .catch((err) => setEntityError(err instanceof MetaFetchError ? err.message : "Erro ao buscar dados do Meta Ads"))
      .finally(() => setEntityLoading(false));
  }, [loaded, status.hasMeta, status.adAccountId, from, to]);

  const dataStatus = DataStatus({
    configured: status.hasMeta,
    loading,
    error,
    configureMessage: "Configure o token e a conta do Meta Ads em Configurações para ver a captação de leads.",
  });
  const entityStatus = DataStatus({
    configured: status.hasMeta,
    loading: entityLoading,
    error: entityError,
    configureMessage: "Configure o token e a conta do Meta Ads em Configurações para ver os melhores públicos e criativos.",
  });

  const filtered = filterRowsByRange(dailyRows, from, to);
  const totals = aggregateSalesRows(filtered);

  // "compras" guarda os contatos no site (campanhas [LEAD])
  const timeline = filtered
    .filter((row): row is SalesRow & { dateObj: Date } => row.dateObj !== null)
    .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
    .map((row) => ({ date: formatShortDate(row.dateObj), contatos: row.compras }));

  const base = totals.impressoes || 1;
  const funnelSteps = [
    { label: "INVESTIMENTO", value: formatBRL(totals.investimento), percentage: 100 },
    {
      label: "IMPRESSÕES",
      value: formatNumber(totals.impressoes),
      subtext: `CPM ${formatBRL(totals.cpm)}`,
      percentage: 100,
    },
    {
      label: "CLIQUES",
      value: formatNumber(totals.cliques),
      subtext: `${formatPercent(totals.ctr)} CTR`,
      percentage: (totals.cliques / base) * 100,
    },
    {
      label: "VISITAS À PÁGINA",
      value: formatNumber(totals.visitasLP),
      subtext: `Connect Rate ${formatPercent(totals.connectRate)}`,
      percentage: (totals.visitasLP / base) * 100,
    },
    {
      label: "CONTATOS NO SITE",
      value: formatNumber(totals.compras),
      subtext: `Custo por Contato ${formatBRL(totals.custoPorCompra)}`,
      percentage: (totals.compras / base) * 100,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary">{siteConfig.clientName}</h1>
          <p className="text-gray-400">Captação de Leads</p>
        </div>
      </div>

      {dataStatus ?? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Investimento"
              value={formatBRL(totals.investimento)}
              subtitle="valor usado no período"
              icon={<DollarSign size={18} />}
            />
            <MetricCard
              title="Contatos no Site"
              value={formatNumber(totals.compras)}
              subtitle="contatos no período"
              icon={<Users size={18} />}
            />
            <MetricCard
              title="Custo por Contato"
              value={formatBRL(totals.custoPorCompra)}
              subtitle="investimento / contatos"
              icon={<DollarSign size={18} />}
            />
            <MetricCard
              title="Impressões"
              value={formatNumber(totals.impressoes)}
              subtitle="entregas no período"
              icon={<Activity size={18} />}
            />
            <MetricCard
              title="Cliques"
              value={formatNumber(totals.cliques)}
              subtitle="cliques no link"
              icon={<MousePointerClick size={18} />}
            />
            <MetricCard
              title="CPC"
              value={formatBRL(totals.cpc)}
              subtitle="custo por clique"
              icon={<DollarSign size={18} />}
            />
            <MetricCard
              title="Visitas na Página"
              value={formatNumber(totals.visitasLP)}
              subtitle="acessos à landing page"
              icon={<LinkIcon size={18} />}
            />
            <MetricCard
              title="Connect Rate"
              value={formatPercent(totals.connectRate)}
              subtitle="cliques → visualizações"
              icon={<Percent size={18} />}
            />
          </div>

          <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
            <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider mb-6">Funil de Captação de Leads</h2>
            <StepFunnel steps={funnelSteps} />
          </div>

          <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
            <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider mb-2">Evolução Temporal</h2>
            <p className="text-sm text-gray-500 mb-4">Contatos por dia</p>
            {timeline.length > 0 ? (
              <TimelineChart data={timeline} dataKey="contatos" />
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-500">Sem dados no período selecionado</div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <LeadList title="Melhores Públicos" rows={adsets} status={entityStatus} />
            <LeadList title="Melhores Criativos" rows={ads} status={entityStatus} showThumbnails />
          </div>
        </>
      )}
    </div>
  );
}

export default function CaptacaoLeadsPage() {
  return (
    <Suspense fallback={<div className="text-gray-400">Carregando...</div>}>
      <CaptacaoLeadsContent />
    </Suspense>
  );
}
