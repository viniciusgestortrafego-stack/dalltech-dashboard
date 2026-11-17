"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Camera,
  ChartColumn,
  Image as ImageIcon,
  LayoutDashboard,
  MousePointerClick,
  Search,
  Settings,
  Users,
} from "lucide-react";
import { siteConfig } from "@/config/site";

const NAV_ITEMS = [
  { href: "/", label: "Meta Ads", icon: LayoutDashboard },
  { href: "/landing-page", label: "Funil de Vendas", icon: MousePointerClick },
  { href: "/google-ads", label: "Google Ads", icon: Search },
  { href: "/analytics", label: "Analytics", icon: ChartColumn },
  { href: "/captacao-leads", label: "Captação de Leads", icon: Users },
  { href: "/criativos", label: "Criativos", icon: ImageIcon },
  { href: "/instagram", label: "Instagram", icon: Camera },
];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof Camera;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 ${
        active ? "text-primary bg-primary/10" : "text-gray-400"
      }`}
    >
      <Icon size={20} aria-hidden="true" />
      <span className="font-medium text-sm">{label}</span>
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <aside className="w-64 bg-card border-r border-card-border flex flex-col h-screen shrink-0 transition-colors">
      <div className="flex flex-col items-center justify-center gap-2 px-6 py-6 border-b border-card-border">
        <Image
          src={siteConfig.logoSrc}
          alt={siteConfig.agencyName}
          width={48}
          height={48}
          className="w-12 h-12 object-contain shrink-0"
          unoptimized
        />
        <span className="font-bold text-lg text-foreground text-center leading-tight">
          {siteConfig.agencyName}
        </span>
      </div>
      <nav className="flex-1 p-4 flex flex-col gap-2">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} {...item} active={isActive(item.href)} />
        ))}
      </nav>
      <div className="p-4 border-t border-card-border space-y-2">
        <NavLink href="/settings" label="Configurações" icon={Settings} active={isActive("/settings")} />
      </div>
    </aside>
  );
}
