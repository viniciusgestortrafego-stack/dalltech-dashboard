export type SalesBaseMetrics = {
  investimento: number;
  compras: number;
  receita: number;
  impressoes: number;
  cliques: number;
  visitasLP: number;
  checkoutsIniciados: number;
};

export type SalesDerivedMetrics = {
  custoPorCompra: number;
  roas: number;
  ctr: number;
  cpm: number;
  cpc: number;
  connectRate: number;
  taxaConversaoCheckout: number;
};

export type SalesRow = SalesBaseMetrics &
  SalesDerivedMetrics & {
    date: string;
    dateObj: Date | null;
  };

export type SalesTotals = SalesBaseMetrics & SalesDerivedMetrics;

export function deriveSalesMetrics({
  investimento,
  compras,
  receita,
  impressoes,
  cliques,
  visitasLP,
  checkoutsIniciados,
}: SalesBaseMetrics): SalesDerivedMetrics {
  return {
    custoPorCompra: compras > 0 ? investimento / compras : 0,
    roas: investimento > 0 ? receita / investimento : 0,
    ctr: impressoes > 0 ? (cliques / impressoes) * 100 : 0,
    cpm: impressoes > 0 ? (investimento / impressoes) * 1000 : 0,
    cpc: cliques > 0 ? investimento / cliques : 0,
    connectRate: cliques > 0 ? (visitasLP / cliques) * 100 : 0,
    taxaConversaoCheckout: visitasLP > 0 ? (checkoutsIniciados / visitasLP) * 100 : 0,
  };
}

function sum(rows: SalesBaseMetrics[], key: keyof SalesBaseMetrics): number {
  return rows.reduce((total, row) => total + row[key], 0);
}

export function aggregateSalesRows(rows: SalesBaseMetrics[]): SalesTotals {
  const base: SalesBaseMetrics = {
    investimento: sum(rows, "investimento"),
    compras: sum(rows, "compras"),
    receita: sum(rows, "receita"),
    impressoes: sum(rows, "impressoes"),
    cliques: sum(rows, "cliques"),
    visitasLP: sum(rows, "visitasLP"),
    checkoutsIniciados: sum(rows, "checkoutsIniciados"),
  };
  return { ...base, ...deriveSalesMetrics(base) };
}

export function filterRowsByRange<T extends { dateObj: Date | null }>(
  rows: T[],
  from?: string,
  to?: string,
): T[] {
  if (!from && !to) return rows;
  const start = from ? new Date(`${from}T00:00:00`) : null;
  const end = to ? new Date(`${to}T23:59:59`) : null;
  return rows.filter((row) => {
    if (!row.dateObj) return false;
    if (start && row.dateObj < start) return false;
    if (end && row.dateObj > end) return false;
    return true;
  });
}
