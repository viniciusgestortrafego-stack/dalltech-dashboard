"use client";

import { Suspense, useEffect, useState } from "react";
import { HorizontalBarChart } from "@/components/charts/HorizontalBarChart";
import { TimelineChart } from "@/components/charts/TimelineChart";
import { DataStatus } from "@/components/ui/DataStatus";
import { CampaignTable } from "@/components/ui/CampaignTable";
import { useConfigStatus } from "@/lib/useConfigStatus";
import { useDateRange } from "@/lib/dateRange";
import { formatBRL, formatNumber, formatShortDate } from "@/lib/format";
import {
  BreakdownItem,
  CampaignPerformanceRow,
  MetaFetchError,
  fetchCampaignPerformance,
  fetchDailySalesRows,
  fetchPurchaseBreakdown,
  formatAgeGenderLabel,
  formatDeviceLabel,
} from "@/lib/meta";
import { SalesRow, aggregateSalesRows, filterRowsByRange } from "@/lib/sales";
import { siteConfig } from "@/config/site";

const EMPTY_PURCHASES = "Sem compras registradas no período";

function BreakdownList({ items }: { items: BreakdownItem[] }) {
  if (items.length === 0) {
    return <div className="h-48 flex items-center justify-center text-gray-500">{EMPTY_PURCHASES}</div>;
  }
  return (
    <div className="space-y-4">
      {items.map((item, i) => (
        <div
          key={i}
          className="flex justify-between items-center text-sm border-b border-card-border pb-2 last:border-0"
        >
          <span className="font-bold flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
            {item.name}
          </span>
          <span className="font-bold text-primary">{formatNumber(item.value)}</span>
        </div>
      ))}
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{title}</h3>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}

function OverviewContent() {
  const { status: configStatus, loaded } = useConfigStatus();
  const { from, to } = useDateRange();

  const [rows, setRows] = useState<SalesRow[]>([]);
  const [placementData, setPlacementData] = useState<BreakdownItem[]>([]);
  const [deviceData, setDeviceData] = useState<BreakdownItem[]>([]);
  const [ageGenderData, setAgeGenderData] = useState<BreakdownItem[]>([]);
  const [campaignRows, setCampaignRows] = useState<CampaignPerformanceRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!loaded || !configStatus.hasMeta) return;
    const { adAccountId } = configStatus;
    setLoading(true);
    setError(null);
    Promise.all([
      fetchDailySalesRows({ adAccountId, since: from, until: to }),
      fetchPurchaseBreakdown({
        adAccountId,
        breakdowns: ["publisher_platform", "platform_position"],
        since: from,
        until: to,
      }),
      fetchPurchaseBreakdown({
        adAccountId,
        breakdowns: ["device_platform"],
        since: from,
        until: to,
        formatLabel: formatDeviceLabel,
      }),
      fetchPurchaseBreakdown({
        adAccountId,
        breakdowns: ["age", "gender"],
        since: from,
        until: to,
        formatLabel: formatAgeGenderLabel,
      }),
      fetchCampaignPerformance({ adAccountId, since: from, until: to }),
    ])
      .then(([salesRows, placements, devices, ageGender, campaigns]) => {
        setRows(salesRows);
        setPlacementData(placements);
        setDeviceData(devices);
        setAgeGenderData(ageGender);
        setCampaignRows(campaigns);
      })
      .catch((err: unknown) =>
        setError(err instanceof MetaFetchError ? err.message : "Erro ao buscar dados do Meta Ads"),
      )
      .finally(() => setLoading(false));
  }, [loaded, configStatus.hasMeta, configStatus.adAccountId, from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  const status = DataStatus({
    configured: configStatus.hasMeta,
    loading,
    error,
    configureMessage: `Configure o token e a conta do Meta Ads em Configurações para ver os números da ${siteConfig.clientName}.`,
  });

  const filtered = filterRowsByRange(rows, from, to);
  const totals = aggregateSalesRows(filtered);
  const timelineData = filtered
    .filter((row): row is SalesRow & { dateObj: Date } => row.dateObj !== null)
    .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
    .map((row) => ({ date: formatShortDate(row.dateObj), receita: row.receita }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary">{siteConfig.clientName}</h1>
        <p className="text-gray-400">Meta Ads</p>
      </div>

      {status ?? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <StatCard title="Vendas" value={formatNumber(totals.compras)} />
            <StatCard title="Receita" value={formatBRL(totals.receita)} />
            <StatCard title="Investido" value={formatBRL(totals.investimento)} />
            <StatCard title="Custo por Venda" value={formatBRL(totals.custoPorCompra)} />
            <StatCard title="ROAS" value={`${totals.roas.toFixed(2)}x`} />
          </div>

          <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
            <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider mb-2">Evolução Temporal</h2>
            <p className="text-sm text-gray-500 mb-4">Receita por dia</p>
            {timelineData.length > 0 ? (
              <TimelineChart data={timelineData} dataKey="receita" />
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-500">
                Sem dados no período selecionado
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 bg-card border border-card-border rounded-xl p-6 shadow-sm">
              <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider mb-6">
                Compras por Posicionamento
              </h2>
              {placementData.length > 0 ? (
                <HorizontalBarChart data={placementData} />
              ) : (
                <div className="h-48 flex items-center justify-center text-gray-500">{EMPTY_PURCHASES}</div>
              )}
            </div>

            <div className="lg:col-span-3 bg-card border border-card-border rounded-xl p-6 shadow-sm">
              <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider mb-6">
                Compras por Dispositivo
              </h2>
              <BreakdownList items={deviceData} />
            </div>

            <div className="lg:col-span-3 bg-card border border-card-border rounded-xl p-6 shadow-sm">
              <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider mb-6">
                Compras por Idade e Gênero
              </h2>
              <BreakdownList items={ageGenderData} />
            </div>
          </div>

          <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
            <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider mb-6">
              Visão Geral de Campanhas
            </h2>
            <CampaignTable rows={campaignRows} />
          </div>
        </>
      )}
    </div>
  );
}

export default function OverviewPage() {
  return (
    <Suspense fallback={<div className="text-gray-400">Carregando...</div>}>
      <OverviewContent />
    </Suspense>
  );
}
