"use client";

import { Suspense, useEffect, useState } from "react";
import { Activity, Users, Percent, Target } from "lucide-react";
import { MetricCard } from "@/components/ui/MetricCard";
import { TimelineChart } from "@/components/charts/TimelineChart";
import { ChannelTable } from "@/components/ui/ChannelTable";
import { EventBreakdownList } from "@/components/ui/EventBreakdownList";
import { ProductTable } from "@/components/ui/ProductTable";
import { UtmTable } from "@/components/ui/UtmTable";
import { useDateRange } from "@/lib/dateRange";
import { formatNumber, formatPercent, formatShortDate } from "@/lib/format";
import {
  AnalyticsChannelRow,
  AnalyticsConversionRow,
  AnalyticsDailyRow,
  AnalyticsFetchError,
  AnalyticsProductRow,
  AnalyticsUtmRow,
  aggregateByChannel,
  aggregateByProduct,
  aggregateByUtm,
  aggregateConversionBreakdown,
  aggregateDaily,
  aggregateSessionsByDay,
  fetchAnalyticsData,
  filterChannelsByRange,
  filterConversionsByRange,
  filterDailyByRange,
  filterProductsByRange,
  filterUtmsByRange,
} from "@/lib/analytics";
import { siteConfig } from "@/config/site";

function AnalyticsContent() {
  const { from, to } = useDateRange();

  const [daily, setDaily] = useState<AnalyticsDailyRow[]>([]);
  const [channels, setChannels] = useState<AnalyticsChannelRow[]>([]);
  const [conversionBreakdown, setConversionBreakdown] = useState<AnalyticsConversionRow[]>([]);
  const [conversionEventNames, setConversionEventNames] = useState<string[]>([]);
  const [products, setProducts] = useState<AnalyticsProductRow[]>([]);
  const [utms, setUtms] = useState<AnalyticsUtmRow[]>([]);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchAnalyticsData()
      .then((data) => {
        setConfigured(data.configured);
        setDaily(data.daily);
        setChannels(data.channels);
        setConversionBreakdown(data.conversionBreakdown);
        setConversionEventNames(data.conversionEventNames);
        setProducts(data.products);
        setUtms(data.utms);
      })
      .catch((err) => setError(err instanceof AnalyticsFetchError ? err.message : "Erro ao buscar dados do Analytics"))
      .finally(() => setLoading(false));
  }, []);

  const dailyInRange = filterDailyByRange(daily, from, to);
  const totals = aggregateDaily(dailyInRange);
  const channelRows = aggregateByChannel(filterChannelsByRange(channels, from, to));
  const conversionTotals = aggregateConversionBreakdown(filterConversionsByRange(conversionBreakdown, from, to));
  // só os eventos configurados como conversão, mesmo os que ainda não ocorreram no período
  const conversionItems = conversionEventNames.map(
    (eventName) => conversionTotals.find((item) => item.eventName === eventName) || { eventName, count: 0 },
  );
  const totalConversions = conversionItems.reduce((total, item) => total + item.count, 0);
  const productRows = aggregateByProduct(filterProductsByRange(products, from, to));
  const utmRows = aggregateByUtm(filterUtmsByRange(utms, from, to));
  const timeline = aggregateSessionsByDay(dailyInRange, formatShortDate);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary">{siteConfig.clientName}</h1>
        <p className="text-gray-400">Analytics (GA4)</p>
      </div>

      {loading ? (
        <div className="h-48 flex items-center justify-center text-gray-400">Carregando...</div>
      ) : error ? (
        <div className="border border-red-500/30 rounded-xl bg-red-500/5 p-6 text-center text-red-400">{error}</div>
      ) : !configured ? (
        <div className="border border-card-border rounded-xl bg-card p-6 text-center text-gray-400 space-y-2">
          <p>
            Google Analytics não configurado. Defina GOOGLE_ANALYTICS_PROPERTY_ID, GOOGLE_ANALYTICS_REFRESH_TOKEN,
            GOOGLE_ADS_CLIENT_ID e GOOGLE_ADS_CLIENT_SECRET nas variáveis de ambiente do servidor.
          </p>
        </div>
      ) : daily.length === 0 ? (
        <div className="border border-card-border rounded-xl bg-card p-6 text-center text-gray-400 space-y-2">
          <p>Nenhum dado do Google Analytics disponível.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Sessões"
              value={formatNumber(totals.sessions)}
              subtitle="visitas no período"
              icon={<Activity size={18} />}
            />
            <MetricCard
              title="Usuários Ativos"
              value={formatNumber(totals.activeUsers)}
              subtitle="pessoas únicas no período"
              icon={<Users size={18} />}
            />
            <MetricCard
              title="Taxa de Engajamento"
              value={formatPercent(totals.engagementRate * 100)}
              subtitle="sessões engajadas / sessões"
              icon={<Percent size={18} />}
            />
            <MetricCard
              title="Conversões"
              value={formatNumber(totalConversions)}
              subtitle="eventos de conversão no período"
              icon={<Target size={18} />}
            />
          </div>

          <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
            <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider mb-2">Evolução Temporal</h2>
            <p className="text-sm text-gray-500 mb-4">Sessões por dia</p>
            {timeline.length > 0 ? (
              <TimelineChart data={timeline} dataKey="sessoes" />
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-500">Sem dados no período selecionado</div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-card border border-card-border rounded-xl p-6 shadow-sm">
              <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider mb-6">Canais de Aquisição</h2>
              <ChannelTable rows={channelRows} />
            </div>
            <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
              <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider mb-6">Eventos de Conversão</h2>
              <EventBreakdownList items={conversionItems} />
            </div>
          </div>

          <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
            <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider mb-6">Produtos Mais Visualizados</h2>
            <ProductTable rows={productRows} />
          </div>

          <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
            <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider mb-6">UTMs e Campanhas</h2>
            <UtmTable rows={utmRows} />
          </div>
        </>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div className="text-gray-400">Carregando...</div>}>
      <AnalyticsContent />
    </Suspense>
  );
}
