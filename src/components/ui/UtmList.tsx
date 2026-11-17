import type { ReactNode } from "react";
import { formatBRL } from "@/lib/format";
import type { UtmBreakdownItem } from "@/lib/woocommerce";

type UtmListProps = {
  title: string;
  items: UtmBreakdownItem[];
  // aviso de configuração/carregando/erro (resultado de DataStatus); null quando há dados para exibir
  status?: ReactNode;
};

export function UtmList({ title, items, status }: UtmListProps) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
      <h2 className="font-bold text-sm text-gray-400 uppercase tracking-wider mb-6">{title}</h2>
      {status ??
        (items.length > 0 ? (
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="border-b border-card-border pb-3 last:border-0">
                <p className="font-bold text-sm break-words flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  {item.name}
                </p>
                <div className="flex justify-between items-center text-sm mt-1">
                  <span className="text-gray-400">
                    {item.orders} pedido{item.orders === 1 ? "" : "s"}
                  </span>
                  <span className="font-bold text-primary">{formatBRL(item.value)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center text-gray-500">
            Sem pedidos no período selecionado
          </div>
        ))}
    </div>
  );
}
