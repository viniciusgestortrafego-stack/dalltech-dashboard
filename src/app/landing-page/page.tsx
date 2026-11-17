"use client";

import { Suspense, useEffect, useState } from "react";
import { Activity, DollarSign, Link as LinkIcon, MousePointerClick, Percent, ShoppingCart, TrendingUp } from "lucide-react";
import { MetricCard } from "@/components/ui/MetricCard";
import { StepFunnel } from "@/components/ui/StepFunnel";
import { DonutChart } from "@/components/charts/DonutChart";
import { TimelineChart } from "@/components/charts/TimelineChart";
import { DataStatus } from "@/components/ui/DataStatus";
import { UtmList } from "@/components/ui/UtmList";
import { useConfigStatus } from "@/lib/useConfigStatus";
import { useDateRange } from "@/lib/dateRange";
import { formatBRL, formatNumber, formatPercent, formatShortDate } from "@/lib/format";
import { MetaFetchError, fetchDailySalesRows } from "@/lib/meta";
import { aggregateSalesRows, filterRowsByRange, type SalesRow } from "@/lib/sales";
import { WooFetchError, fetchUtmBreakdowns, type UtmBreakdownItem } from "@/lib/woocommerce";
import {
  aggregateConversionBreakdown,
  aggregateGoogleAdsRows,
  fetchGoogleAdsData,
  filterConversionsByRange,
  filterGoogleAdsRowsByRange,
  type GoogleAdsConversionRow,
  type GoogleAdsRow,
} from "@/lib/googleAds";
import { siteConfig } from "@/config/site";

function LandingPageContent() {
  const { status: configStatus, loaded } = useConfigStatus();
  const { from, to } = useDateRange();

  const [rows, setRows] = useState<SalesRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [googleRows, setGoogleRows] = useState<GoogleAdsRow[]>([]);
  const [googleConversions, setGoogleConversions] = useState<GoogleAdsConversionRow[]>([]);
  const [conversionCategories, setConversionCategories] = useState<Record<string, string>>({});

  const [bySource, setBySource] = useState<UtmBreakdownItem[]>([]);
  const [byCampaign, setByCampaign] = useState<UtmBreakdownItem[]>([]);
  const [byContent, setByContent] = useState<UtmBreakdownItem[]>([]);
  const [wooError, setWooError] = useState<string | null>(null);
  const [wooLoading, setWooLoading] = useState(false);

  useEffect(() => {
    if (!loaded || !configStatus.hasMeta) return;
    setLoading(true);
    setError(null);
    fetchDailySalesRows({ adAccountId: configStatus.adAccountId, since: from, until: to })
      .then(setRows)
      .catch((err: unknown) =>
        setError(err instanceof MetaFetchError ? err.message : "Erro ao buscar dados do Meta Ads"),
      )
      .finally(() => setLoading(false));
  }, [loaded, configStatus.hasMeta, configStatus.adAccountId, from, to]);

  // Google Ads é opcional: se não houver dados (ou der erro), o funil usa só o Meta
  useEffect(() => {
    fetchGoogleAdsData()
      .then((data) => {
        setGoogleRows(data.rows);
        setGoogleConversions(data.conversionBreakdown);
        setConversionCategories(data.conversionActionCategories);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!loaded || !configStatus.hasWoo) return;
    setWooLoading(true);
    setWooError(null);
    fetchUtmBreakdowns({ since: from, until: to })
      .then((result) => {
        setBySource(result.source);
        setByCampaign(result.campaign);
        setByContent(result.content);
      })
      .catch((err: unknown) =>
        setWooError(err instanceof WooFetchError ? err.message : "Erro ao buscar pedidos do WooCommerce"),
      )
      .finally(() => setWooLoading(false));
  }, [loaded, configStatus.hasWoo, configStatus.wooStoreUrl, from, to]);

  const status = DataStatus({
    configured: configStatus.hasMeta,
    loading,
    error,
    configureMessage: "Configure o token e a conta do Meta Ads em Configurações para ver o funil de vendas.",
  });

  const wooStatus = DataStatus({
    configured: configStatus.hasWoo,
    loading: wooLoading,
    error: wooError,
    configureMessage: "Configure a loja WooCommerce em Configurações para ver as vendas por UTM.",
  });

  const filtered = filterRowsByRange(rows, from, to);
  const meta = aggregateSalesRows(filtered);

  const chartData = filtered
    .filter((row): row is SalesRow & { dateObj: Date } => row.dateObj !== null)
    .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
    .map((row) => ({ date: formatShortDate(row.dateObj), receita: row.receita }));

  // Google Ads soma investimento, impressões, cliques e (somente) conversões de compra
  const google = aggregateGoogleAdsRows(filterGoogleAdsRowsByRange(googleRows, from, to));
  const googlePurchases = aggregateConversionBreakdown(filterConversionsByRange(googleConversions, from, to))
    .filter((conversion) => conversionCategories[conversion.name] === "PURCHASE")
    .reduce(
      (acc, conversion) => ({
        conversions: acc.conversions + conversion.conversions,
        conversionValue: acc.conversionValue + conversion.conversionValue,
      }),
      { conversions: 0, conversionValue: 0 },
    );

  const investimento = meta.investimento + google.spend;
  const impressoes = meta.impressoes + google.impressions;
  const cliques = meta.cliques + google.clicks;
  const compras = meta.compras + googlePurchases.conversions;
  const receita = meta.receita + googlePurchases.conversionValue;
  const custoPorCompra = compras > 0 ? investimento / compras : 0;
  const roas = investimento > 0 ? receita / investimento : 0;
  const ctr = impressoes > 0 ? (cliques / impressoes) * 100 : 0;
  const cpm = impressoes > 0 ? (investimento / impressoes) * 1000 : 0;
  const cpc = cliques > 0 ? investimento / cliques : 0;

  const base = impressoes || 1;
  const steps = [
    { label: "INVESTIMENTO", value: formatBRL(investimento), percentage: 100 },
    { label: "IMPRESSÕES", value: formatNumber(impressoes), subtext: `CPM ${formatBRL(cpm)}`, percentage: 100 },
    {
      label: "CLIQUES",
      value: formatNumber(cliques),
      subtext: `${formatPercent(ctr)} CTR`,
      percentage: (cliques / base) * 100,
    },
    {
      label: "VISITAS À PÁGINA",
      value: formatNumber(meta.visitasLP),
      subtext: `Connect Rate ${formatPercent(meta.connectRate)}`,
      percentage: (meta.visitasLP / base) * 100,
    },
    {
      label: "CHECKOUTS INICIADOS",
      value: formatNumber(meta.checkoutsIniciados),
      subtext: `Tx. Conversão ${formatPercent(meta.taxaConversaoCheckout)}`,
      percentage: (meta.checkoutsIniciados / base) * 100,
    },
    {
      label: "COMPRAS",
      value: formatNumber(compras),
      subtext: `CPL ${formatBRL(custoPorCompra)}`,
      percentage: (compras / base) * 100,
    },
  ];

  const investmentVsRevenue = [
    { name: "Investimento", value: investimento, color: "#2a78d6" },
    { name: "Receita", value: receita, color: "#1baf7a" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary">{siteConfig.clientName}</h1>
          <p className="text-gray-400">Funil de Vendas</p>
        </div>
      </div>

      {status ?? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Investimento"
              value={formatBRL(investimento)}
              subtitle="valor usado no período"
              icon={<DollarSign size={18} />}
            />
            <MetricCard
              title="Compras"
              value={formatNumber(compras)}
              subtitle="vendas no período"
              icon={<ShoppingCart size={18} />}
            />
            <MetricCard
              title="Receita"
              value={formatBRL(receita)}
              subtitle="faturamento no período"
              icon={<DollarSign size={18} />}
            />
            <MetricCard
              title="ROAS"
              value={`${roas.toFixed(2)}x`}
              subtitle="receita / investimento"
              icon={<TrendingUp size={18} />}
            />
            <MetricCard
              title="Custo por Compra"
              value={formatBRL(custoPorCompra)}
              subtitle="investimento / compras"
              icon={<DollarSign size={18} />}
            />
            <MetricCard
              title="Impressões"
              value={formatNumber(impressoes)}
              subtitle="entregas no período"
              icon={<Activity size={18} />}
            />
            <MetricCard
              title="Cliques"
              value={formatNumber(cliques)}
              subtitle="cliques no link"
              icon={<MousePointerClick size={18} />}
            />
            <MetricCard title="CPC" value={formatBRL(cpc)} subtitle="custo por clique" icon={<DollarSign size={18} />} />
            <MetricCard
              title="Visitas na Página"
              value={formatNumber(meta.visitasLP)}
              subtitle="acessos à landing page"
              icon={<LinkIcon size={18} />}
            />
            <MetricCard
              title="Connect Rate"
              value={formatPercent(meta.connectRate)}
              subtitle="cliques → visualizações"
              icon={<Percent size={18} />}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-card border border-card-border rounded-xl p-6 shadow-sm">
              <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider mb-6">Funil de Vendas</h2>
              <StepFunnel steps={steps} />
            </div>

            <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm flex flex-col">
              <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider mb-6">
                Investimento vs Receita
              </h2>
              <DonutChart data={investmentVsRevenue} total={formatBRL(receita)} label="RECEITA" />
              <div className="w-full space-y-3 mt-4">
                {investmentVsRevenue.map((item) => (
                  <div
                    key={item.name}
                    className="flex justify-between items-center text-sm border-b border-card-border pb-2 last:border-0 last:pb-0"
                  >
                    <span className="font-bold flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full inline-block"
                        style={{ backgroundColor: item.color }}
                      />{" "}
                      {item.name}
                    </span>
                    <span className="font-bold">{formatBRL(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
            <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider mb-2">Evolução Temporal</h2>
            <p className="text-sm text-gray-500 mb-4">Receita por dia</p>
            {chartData.length > 0 ? (
              <TimelineChart data={chartData} dataKey="receita" />
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-500">
                Sem dados no período selecionado
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <UtmList title="Vendas por Origem (UTM Source)" items={bySource} status={wooStatus} />
            <UtmList title="Vendas por Campanha (UTM Campaign)" items={byCampaign} status={wooStatus} />
            <UtmList title="Vendas por Criativo (UTM Content)" items={byContent} status={wooStatus} />
          </div>
        </>
      )}
    </div>
  );
}

export default function LandingPage() {
  return (
    <Suspense fallback={<div className="text-gray-400">Carregando...</div>}>
      <LandingPageContent />
    </Suspense>
  );
}
