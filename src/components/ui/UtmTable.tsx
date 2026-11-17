import type { AnalyticsUtmSummary } from "@/lib/analytics";
import { formatBRL, formatNumber } from "@/lib/format";

function clean(value: string): string {
  return value === "(not set)" || value === "(not provided)" ? "—" : value;
}

export function UtmTable({ rows }: { rows: AnalyticsUtmSummary[] }) {
  if (rows.length === 0) {
    return <div className="h-48 flex items-center justify-center text-gray-500">Sem dados no período selecionado</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-card-border">
            <th className="py-3 pr-4">Origem</th>
            <th className="py-3 pr-4">Mídia</th>
            <th className="py-3 pr-4">Campanha</th>
            <th className="py-3 pr-4">Termo</th>
            <th className="py-3 pr-4">Conteúdo</th>
            <th className="py-3 pr-4 text-right">Sessões</th>
            <th className="py-3 pr-4 text-right">Conversões</th>
            <th className="py-3 text-right">Receita</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 30).map((row, i) => (
            <tr
              key={i}
              className="border-b border-card-border last:border-0 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <td className="py-3 pr-4 font-medium">{clean(row.source)}</td>
              <td className="py-3 pr-4 text-gray-400">{clean(row.medium)}</td>
              <td className="py-3 pr-4 max-w-[240px] truncate text-gray-400" title={row.campaign}>
                {clean(row.campaign)}
              </td>
              <td className="py-3 pr-4 max-w-[160px] truncate text-gray-400" title={row.term}>
                {clean(row.term)}
              </td>
              <td className="py-3 pr-4 max-w-[160px] truncate text-gray-400" title={row.content}>
                {clean(row.content)}
              </td>
              <td className="py-3 pr-4 text-right font-bold">{formatNumber(row.sessions)}</td>
              <td className="py-3 pr-4 text-right">{formatNumber(row.conversions)}</td>
              <td className="py-3 text-right text-primary font-bold">{formatBRL(row.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
