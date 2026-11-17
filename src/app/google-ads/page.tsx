"use client";

import { Suspense, useEffect, useState } from "react";
import { Activity, DollarSign, MousePointerClick, Percent, Target, TrendingUp } from "lucide-react";
import { MetricCard } from "@/components/ui/MetricCard";
import { StepFunnel } from "@/components/ui/StepFunnel";
import { TimelineChart } from "@/components/charts/TimelineChart";
import { siteConfig } from "@/config/site";
import { formatBRL, formatNumber, formatPercent, formatShortDate } from "@/lib/format";
import { useDateRange } from "@/lib/dateRange";
import {
  GoogleAdsFetchError,
  LEAD_CATEGORIES,
  aggregateConversionBreakdown,
  aggregateGoogleAdsByCampaign,
  aggregateGoogleAdsByDay,
  aggregateGoogleAdsByKeyword,
  aggregateGoogleAdsRows,
  fetchGoogleAdsData,
  filterConversionsByRange,
  filterGoogleAdsRowsByRange,
  filterKeywordsByRange,
  type GoogleAdsConversionRow,
  type GoogleAdsKeywordRow,
  type GoogleAdsRow,
} from "@/lib/googleAds";

const MATCH_TYPE_LABEL: Record<string, string> = { EXACT: "Exata", PHRASE: "Frase", BROAD: "Ampla" };
const CONVERSION_COLORS = ["#2a78d6", "#1baf7a", "#eda100", "#008300", "#4a3aa7", "#e34948", "#e87ba4", "#eb6834"];

type CampaignRow = ReturnType<typeof aggregateGoogleAdsByCampaign>[number];
type KeywordAgg = ReturnType<typeof aggregateGoogleAdsByKeyword>[number];
type ConversionAgg = { name: string; conversions: number; conversionValue: number };

const Empty = ({ children, h = "h-48" }: { children: string; h?: string }) => (
  <div className={`${h} flex items-center justify-center text-gray-500`}>{children}</div>
);

function CampaignTable({ rows }: { rows: CampaignRow[] }) {
  if (rows.length === 0) return <Empty>Sem dados no período selecionado</Empty>;
  const sum = (key: "impressions" | "clicks" | "conversions" | "spend" | "conversionValue") =>
    rows.reduce((total, r) => total + r[key], 0);
  const impressions = sum("impressions");
  const clicks = sum("clicks");
  const conversions = sum("conversions");
  const spend = sum("spend");
  const conversionValue = sum("conversionValue");

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-card-border">
            <th className="py-3 pr-4">Campanha</th>
            <th className="py-3 pr-4 text-right">Impressões</th>
            <th className="py-3 pr-4 text-right">Cliques</th>
            <th className="py-3 pr-4 text-right">CPC</th>
            <th className="py-3 pr-4 text-right">CPM</th>
            <th className="py-3 pr-4 text-right">Investimento</th>
            <th className="py-3 pr-4 text-right">Conversões</th>
            <th className="py-3 pr-4 text-right">Custo por Conv.</th>
            <th className="py-3 text-right">ROAS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-card-border last:border-0 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
              <td className="py-3 pr-4 font-medium max-w-[220px] truncate" title={r.name}>{r.name}</td>
              <td className="py-3 pr-4 text-right">{formatNumber(r.impressions)}</td>
              <td className="py-3 pr-4 text-right">{formatNumber(r.clicks)}</td>
              <td className="py-3 pr-4 text-right">{formatBRL(r.cpc)}</td>
              <td className="py-3 pr-4 text-right">{formatBRL(r.cpm)}</td>
              <td className="py-3 pr-4 text-right">{formatBRL(r.spend)}</td>
              <td className="py-3 pr-4 text-right font-bold">{formatNumber(r.conversions)}</td>
              <td className="py-3 pr-4 text-right">{formatBRL(r.costPerConversion)}</td>
              <td className="py-3 text-right font-bold text-primary">{r.roas.toFixed(2)}x</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-card-border font-bold">
            <td className="py-3 pr-4">Total geral</td>
            <td className="py-3 pr-4 text-right">{formatNumber(impressions)}</td>
            <td className="py-3 pr-4 text-right">{formatNumber(clicks)}</td>
            <td className="py-3 pr-4 text-right">{formatBRL(clicks > 0 ? spend / clicks : 0)}</td>
            <td className="py-3 pr-4 text-right">{formatBRL(impressions > 0 ? (spend / impressions) * 1000 : 0)}</td>
            <td className="py-3 pr-4 text-right">{formatBRL(spend)}</td>
            <td className="py-3 pr-4 text-right">{formatNumber(conversions)}</td>
            <td className="py-3 pr-4 text-right">{formatBRL(conversions > 0 ? spend / conversions : 0)}</td>
            <td className="py-3 text-right text-primary">{(spend > 0 ? conversionValue / spend : 0).toFixed(2)}x</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function KeywordTable({ rows }: { rows: KeywordAgg[] }) {
  if (rows.length === 0) return <Empty>Sem dados no período selecionado</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-card-border">
            <th className="py-3 pr-4">Palavra-chave</th>
            <th className="py-3 pr-4">Tipo</th>
            <th className="py-3 pr-4 text-right">Cliques</th>
            <th className="py-3 pr-4 text-right">CPC</th>
            <th className="py-3 pr-4 text-right">Investimento</th>
            <th className="py-3 pr-4 text-right">Conversões</th>
            <th className="py-3 text-right">Custo por Conv.</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 30).map((r, i) => (
            <tr key={i} className="border-b border-card-border last:border-0 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
              <td className="py-3 pr-4 font-medium max-w-[220px] truncate" title={r.keyword}>{r.keyword}</td>
              <td className="py-3 pr-4 text-gray-400">{MATCH_TYPE_LABEL[r.matchType] ?? r.matchType}</td>
              <td className="py-3 pr-4 text-right">{formatNumber(r.clicks)}</td>
              <td className="py-3 pr-4 text-right">{formatBRL(r.cpc)}</td>
              <td className="py-3 pr-4 text-right">{formatBRL(r.spend)}</td>
              <td className="py-3 pr-4 text-right font-bold">{formatNumber(r.conversions)}</td>
              <td className="py-3 text-right text-primary font-bold">{formatBRL(r.costPerConversion)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConversionList({ items }: { items: ConversionAgg[] }) {
  if (items.length === 0) return <Empty h="h-32">Sem conversões no período selecionado</Empty>;
  return (
    <div className="space-y-4">
      {items.map((item, i) => (
        <div key={item.name} className="flex justify-between items-center text-sm border-b border-card-border pb-2 last:border-0">
          <span className="font-bold flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CONVERSION_COLORS[i % CONVERSION_COLORS.length] }} />
            {item.name}
          </span>
          <span className="text-gray-400">{formatBRL(item.conversionValue)}</span>
          <span className="font-bold text-primary">{formatNumber(item.conversions)}</span>
        </div>
      ))}
    </div>
  );
}

const Section = ({ title, subtitle, className = "", children }: { title: string; subtitle?: string; className?: string; children: React.ReactNode }) => (
  <div className={`bg-card border border-card-border rounded-xl p-6 shadow-sm ${className}`}>
    <h2 className={`font-bold text-sm text-gray-400 uppercase tracking-wider ${subtitle ? "mb-2" : "mb-6"}`}>{title}</h2>
    {subtitle && <p className="text-sm text-gray-500 mb-4">{subtitle}</p>}
    {children}
  </div>
);

function GoogleAdsContent() {
  const { from, to } = useDateRange();
  const [rows, setRows] = useState<GoogleAdsRow[]>([]);
  const [keywords, setKeywords] = useState<GoogleAdsKeywordRow[]>([]);
  const [conversionBreakdown, setConversionBreakdown] = useState<GoogleAdsConversionRow[]>([]);
  const [conversionNames, setConversionNames] = useState<string[]>([]);
  const [categories, setCategories] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchGoogleAdsData()
      .then((data) => {
        setRows(data.rows);
        setKeywords(data.keywords);
        setConversionBreakdown(data.conversionBreakdown);
        setConversionNames(data.conversionActionNames);
        setCategories(data.conversionActionCategories);
      })
      .catch((e) => setError(e instanceof GoogleAdsFetchError ? e.message : "Erro ao buscar dados do Google Ads"))
      .finally(() => setLoading(false));
  }, []);

  const periodRows = filterGoogleAdsRowsByRange(rows, from, to);
  const totals = aggregateGoogleAdsRows(periodRows);
  const campaigns = aggregateGoogleAdsByCampaign(periodRows);
  const keywordRows = aggregateGoogleAdsByKeyword(filterKeywordsByRange(keywords, from, to));
  const conversionTotals = aggregateConversionBreakdown(filterConversionsByRange(conversionBreakdown, from, to));
  const conversionItems: ConversionAgg[] = conversionNames.map(
    (name) => conversionTotals.find((c) => c.name === name) || { name, conversions: 0, conversionValue: 0 },
  );
  const timeline = aggregateGoogleAdsByDay(periodRows).map((d) => {
    const [y, m, day] = d.date.split("-").map(Number);
    return { date: formatShortDate(new Date(y, (m || 1) - 1, day || 1)), investimento: d.spend };
  });

  // leads = conversões cujas categorias são de geração de contatos (formulário, ligação, orçamento...)
  const leads = conversionItems
    .filter((c) => LEAD_CATEGORIES.has(categories[c.name]))
    .reduce((acc, c) => acc + c.conversions, 0);
  const costPer = (n: number) => (n > 0 ? totals.spend / n : 0);
  const impressionsBase = totals.impressions || 1;

  const funnel = [
    { label: "INVESTIMENTO", value: formatBRL(totals.spend), percentage: 100 },
    { label: "IMPRESSÕES", value: formatNumber(totals.impressions), subtext: `CPM ${formatBRL(totals.cpm)}`, percentage: 100 },
    { label: "CLIQUES", value: formatNumber(totals.clicks), subtext: `${formatPercent(totals.ctr)} CTR`, percentage: (totals.clicks / impressionsBase) * 100 },
    { label: "CONVERSÕES", value: formatNumber(totals.conversions), subtext: `Custo ${formatBRL(costPer(totals.conversions))}`, percentage: (totals.conversions / impressionsBase) * 100 },
    { label: "LEADS", value: formatNumber(leads), subtext: `Custo ${formatBRL(costPer(leads))}`, percentage: (leads / impressionsBase) * 100 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary">{siteConfig.clientName}</h1>
        <p className="text-gray-400">Google Ads</p>
      </div>

      {loading ? (
        <div className="h-48 flex items-center justify-center text-gray-400">Carregando...</div>
      ) : error ? (
        <div className="border border-red-500/30 rounded-xl bg-red-500/5 p-6 text-center text-red-400">{error}</div>
      ) : rows.length === 0 ? (
        <div className="border border-card-border rounded-xl bg-card p-6 text-center text-gray-400 space-y-2">
          <p>Nenhum dado recebido do Google Ads ainda.</p>
          <p className="text-sm">
            Configure o script de envio (URL do webhook + chave) em{" "}
            <a href="/settings" className="text-primary font-semibold hover:underline">Configurações</a>.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard title="Investimento" value={formatBRL(totals.spend)} subtitle="valor usado no período" icon={<DollarSign size={18} />} />
            <MetricCard title="Impressões" value={formatNumber(totals.impressions)} subtitle="entregas no período" icon={<Activity size={18} />} />
            <MetricCard title="Cliques" value={formatNumber(totals.clicks)} subtitle="cliques no período" icon={<MousePointerClick size={18} />} />
            <MetricCard title="CTR" value={formatPercent(totals.ctr)} subtitle="cliques / impressões" icon={<Percent size={18} />} />
            <MetricCard title="CPC" value={formatBRL(totals.cpc)} subtitle="custo por clique" icon={<DollarSign size={18} />} />
            <MetricCard title="CPM" value={formatBRL(totals.cpm)} subtitle="custo por mil impressões" icon={<DollarSign size={18} />} />
            <MetricCard title="Conversões" value={formatNumber(totals.conversions)} subtitle="todas as ações de conversão" icon={<Target size={18} />} />
            <MetricCard title="Custo por Conversão" value={formatBRL(totals.costPerConversion)} subtitle="investimento / conversões" icon={<DollarSign size={18} />} />
            <MetricCard title="Leads" value={formatNumber(leads)} subtitle={`custo ${formatBRL(costPer(leads))}`} icon={<Target size={18} />} />
            <MetricCard title="Valor das Conversões" value={formatBRL(totals.conversionValue)} subtitle="valor atribuído às conversões" icon={<DollarSign size={18} />} />
            <MetricCard title="ROAS" value={`${totals.roas.toFixed(2)}x`} subtitle="valor de conversão / investimento" icon={<TrendingUp size={18} />} />
          </div>

          <Section title="Funil do Google Ads">
            <StepFunnel steps={funnel} />
          </Section>

          <Section title="Evolução Temporal" subtitle="Investimento por dia">
            {timeline.length > 0 ? <TimelineChart data={timeline} dataKey="investimento" /> : <Empty>Sem dados no período selecionado</Empty>}
          </Section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Section title="Campanhas" className="lg:col-span-2">
              <CampaignTable rows={campaigns} />
            </Section>
            <Section title="Conversões Personalizadas">
              <ConversionList items={conversionItems} />
            </Section>
          </div>

          <Section title="Palavras-chave">
            <KeywordTable rows={keywordRows} />
          </Section>
        </>
      )}
    </div>
  );
}

export default function GoogleAdsPage() {
  return (
    <Suspense fallback={<div className="text-gray-400">Carregando...</div>}>
      <GoogleAdsContent />
    </Suspense>
  );
}
