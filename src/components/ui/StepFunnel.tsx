type Step = {
  label: string;
  value: string;
  subtext?: string;
  percentage: number;
};

// rampa azul do modelo: do claro (topo do funil) ao escuro (fundo)
const RAMP = ["#86b6ef", "#6da7ec", "#5598e7", "#3987e5", "#2a78d6", "#256abf", "#1c5cab"];

function rampColor(index: number, total: number): string {
  const position = total > 1 ? index / (total - 1) : 0;
  return RAMP[Math.round(position * (RAMP.length - 1))];
}

function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function StepFunnel({ steps }: { steps: Step[] }) {
  return (
    <div className="space-y-4">
      {steps.map((step, i) => {
        const color = rampColor(i, steps.length);
        // raiz quadrada: etapas pequenas continuam visíveis
        const fill = Math.max(12, 10 * Math.sqrt(Math.min(100, Math.max(0, step.percentage))));
        return (
          <div
            key={i}
            className="relative h-14 rounded-lg border border-card-border overflow-hidden flex items-center px-4 justify-between"
            style={{ marginLeft: `${16 * i}px`, backgroundColor: withAlpha(color, 0.14) }}
          >
            {i > 0 && <div className="absolute -left-4 top-1/2 w-4 border-t border-card-border" />}
            <div
              className="absolute left-0 top-0 bottom-0 pointer-events-none transition-all duration-1000 ease-out"
              style={{ width: `${fill}%`, backgroundColor: withAlpha(color, 0.4) }}
            />
            <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: color }} />
            <div className="relative z-10 flex flex-col">
              <span className="font-bold text-primary text-xs uppercase tracking-wider">
                {String(i + 1).padStart(2, "0")}. {step.label}
              </span>
            </div>
            <div className="relative z-10 flex flex-col items-end">
              <span className="font-bold text-foreground">{step.value}</span>
              {step.subtext && <span className="text-xs text-primary font-bold">{step.subtext}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
