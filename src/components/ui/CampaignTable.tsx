import { formatBRL, formatNumber } from "@/lib/format";
import type { CampaignPerformanceRow } from "@/lib/meta";

function sumBy(rows: CampaignPerformanceRow[], key: keyof CampaignPerformanceRow): number {
  return rows.reduce((total, row) => total + (row[key] as number), 0);
}

export function CampaignTable({ rows }: { rows: CampaignPerformanceRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-500">Sem dados no período selecionado</div>
    );
  }

  const impressions = sumBy(rows, "impressions");
  const clicks = sumBy(rows, "clicks");
  const checkouts = sumBy(rows, "checkoutsIniciados");
  const purchases = sumBy(rows, "purchases");
  const spend = sumBy(rows, "spend");
  const revenue = sumBy(rows, "revenue");

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
            <th className="py-3 pr-4 text-right">Fina. Iniciada</th>
            <th className="py-3 pr-4 text-right">Custo por Fina.</th>
            <th className="py-3 pr-4 text-right">Compras</th>
            <th className="py-3 pr-4 text-right">Custo por Com.</th>
            <th className="py-3 text-right">Lucro Bruto</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-card-border last:border-0 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <td className="py-3 pr-4 font-medium max-w-[220px] truncate" title={row.name}>
                {row.name}
              </td>
              <td className="py-3 pr-4 text-right">{formatNumber(row.impressions)}</td>
              <td className="py-3 pr-4 text-right">{formatNumber(row.clicks)}</td>
              <td className="py-3 pr-4 text-right">{formatBRL(row.cpc)}</td>
              <td className="py-3 pr-4 text-right">{formatBRL(row.cpm)}</td>
              <td className="py-3 pr-4 text-right">{formatNumber(row.checkoutsIniciados)}</td>
              <td className="py-3 pr-4 text-right">{formatBRL(row.custoPorCheckout)}</td>
              <td className="py-3 pr-4 text-right font-bold">{formatNumber(row.purchases)}</td>
              <td className="py-3 pr-4 text-right">{formatBRL(row.cpa)}</td>
              <td className="py-3 text-right font-bold text-green-600 dark:text-green-400 bg-green-500/10 rounded-lg px-2">
                {formatBRL(row.grossProfit)}
              </td>
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
            <td className="py-3 pr-4 text-right">{formatNumber(checkouts)}</td>
            <td className="py-3 pr-4 text-right">{formatBRL(checkouts > 0 ? spend / checkouts : 0)}</td>
            <td className="py-3 pr-4 text-right">{formatNumber(purchases)}</td>
            <td className="py-3 pr-4 text-right">{formatBRL(purchases > 0 ? spend / purchases : 0)}</td>
            <td className="py-3 text-right text-green-600 dark:text-green-400">{formatBRL(revenue - spend)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
