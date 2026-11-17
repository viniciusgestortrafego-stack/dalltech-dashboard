"use client";

import { useEffect, useState } from "react";
import { LogOut, Settings } from "lucide-react";
import { buildGoogleAdsScript } from "@/lib/googleAdsScript";

type Credentials = {
  metaToken: string;
  adAccountId: string;
  instagramAccountId: string;
  wooStoreUrl: string;
  wooConsumerKey: string;
  wooConsumerSecret: string;
  googleAdsWebhookSecret: string;
};

const EMPTY: Credentials = {
  metaToken: "",
  adAccountId: "",
  instagramAccountId: "",
  wooStoreUrl: "",
  wooConsumerKey: "",
  wooConsumerSecret: "",
  googleAdsWebhookSecret: "",
};

const INPUT =
  "w-full bg-background border border-card-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:border-primary transition-colors";
const LABEL = "text-xs font-bold text-gray-400 uppercase tracking-wider";
const HINT = "text-xs text-primary/70";

function Login({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error === "Login não configurado no servidor" ? body.error : "Usuário ou senha inválidos");
        return;
      }
      onLoggedIn();
    } catch {
      setError("Erro ao entrar. Tenta de novo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-16">
      <div className="flex items-center gap-3 mb-8 justify-center">
        <Settings className="w-8 h-8 text-primary" />
        <h1 className="text-2xl font-bold">Configurações</h1>
      </div>
      <form onSubmit={submit} className="bg-card border border-card-border rounded-xl p-8 shadow-sm space-y-5">
        <div className="space-y-2">
          <label htmlFor="login-user" className={LABEL}>Usuário</label>
          <input id="login-user" type="text" value={user} onChange={(e) => setUser(e.target.value)} autoFocus className={INPUT} />
        </div>
        <div className="space-y-2">
          <label htmlFor="login-pass" className={LABEL}>Senha</label>
          <input id="login-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={INPUT} />
        </div>
        {error && <p className="text-red-500 text-sm font-medium">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary hover:bg-primary-hover text-white px-8 py-3 rounded-lg font-semibold transition-colors shadow-sm disabled:opacity-60"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}

function Field(props: {
  name: keyof Credentials;
  label: string;
  hint: string;
  placeholder: string;
  type?: "text" | "password";
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={props.name} className={LABEL}>{props.label}</label>
      <input
        id={props.name}
        type={props.type ?? "text"}
        name={props.name}
        value={props.value}
        onChange={props.onChange}
        placeholder={props.placeholder}
        autoComplete="off"
        className={INPUT}
      />
      <p className={HINT}>{props.hint}</p>
    </div>
  );
}

type GoogleStatus = { updatedAt: string; rows: number } | null;

export function SettingsForm() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [form, setForm] = useState<Credentials>(EMPTY);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [google, setGoogle] = useState<GoogleStatus>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const load = () => {
    fetch("/api/credentials")
      .then((res) => {
        if (!res.ok) {
          setAuthed(false);
          return null;
        }
        setAuthed(true);
        return res.json();
      })
      .then((data) => {
        if (data) setForm({ ...EMPTY, ...data });
      })
      .catch(() => setAuthed(false));
    fetch("/api/google-ads/data", { cache: "no-store" })
      .then((res) => res.json())
      .then((d) => setGoogle({ updatedAt: d.updatedAt || "", rows: (d.rows || []).length }))
      .catch(() => setGoogle(null));
  };

  useEffect(() => {
    load();
  }, []);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setSaved(false);
  };

  const save = async () => {
    setError(null);
    try {
      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Erro ao salvar. Tenta de novo.");
    }
  };

  const clear = async () => {
    setError(null);
    try {
      const res = await fetch("/api/credentials", { method: "DELETE" });
      if (!res.ok) throw new Error();
      setForm(EMPTY);
      setSaved(false);
    } catch {
      setError("Erro ao limpar. Tenta de novo.");
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setForm(EMPTY);
    setAuthed(false);
  };

  const webhookUrl = origin ? `${origin}/api/google-ads/ingest` : "";
  const script = buildGoogleAdsScript(webhookUrl, form.googleAdsWebhookSecret);

  const copyScript = async () => {
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Não consegui copiar. Selecione o texto do script e copie manualmente.");
    }
  };

  if (authed === null) return <div className="max-w-3xl text-gray-400">Carregando...</div>;
  if (!authed) return <Login onLoggedIn={load} />;

  return (
    <div className="max-w-3xl space-y-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Settings className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Configurações</h1>
            <p className="text-gray-400">credenciais e integrações</p>
          </div>
        </div>
        <button onClick={logout} className="flex items-center gap-2 text-sm text-gray-400 hover:text-foreground transition-colors">
          <LogOut size={16} /> Sair
        </button>
      </div>

      <div className="bg-card border border-card-border rounded-xl p-8 shadow-sm">
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-2">Credenciais</h2>
          <p className="text-sm text-gray-500">
            Salvas no servidor e usadas por todas as páginas do dashboard. Os campos secretos nunca chegam ao navegador de quem só
            está vendo os dados — só quem loga aqui consegue vê-los ou alterá-los.
          </p>
        </div>

        <div className="space-y-6">
          <Field name="metaToken" type="password" label="System User Token - Meta" placeholder="EAA..." value={form.metaToken} onChange={onChange}
            hint="Business Manager → Usuários do sistema → Gerar novo token" />
          <Field name="adAccountId" label="ID da Conta de Anúncios" placeholder="act_123456789" value={form.adAccountId} onChange={onChange}
            hint='URL do Gerenciador, após "act="' />
          <Field name="instagramAccountId" label="ID da Conta do Instagram" placeholder="17841400..." value={form.instagramAccountId} onChange={onChange}
            hint="ID da conta profissional do Instagram vinculada à Página do Facebook (Meta Business Suite → Configurações → Contas)" />
          <Field name="wooStoreUrl" label="URL da Loja - WooCommerce" placeholder="https://minhaloja.com.br" value={form.wooStoreUrl} onChange={onChange}
            hint="Usada pra puxar as UTMs de venda no Funil de Vendas" />
          <Field name="wooConsumerKey" type="password" label="Consumer Key - WooCommerce" placeholder="ck_..." value={form.wooConsumerKey} onChange={onChange}
            hint="WordPress → WooCommerce → Configurações → Avançado → REST API" />
          <Field name="wooConsumerSecret" type="password" label="Consumer Secret - WooCommerce" placeholder="cs_..." value={form.wooConsumerSecret} onChange={onChange}
            hint="Chave gerada junto com a Consumer Key (permissão de leitura já basta)" />

          <div className="space-y-2 pt-6 border-t border-card-border">
            <label htmlFor="webhook-url" className={LABEL}>Google Ads — URL do Webhook</label>
            <input id="webhook-url" type="text" readOnly value={webhookUrl} onFocus={(e) => e.target.select()}
              className="w-full bg-background border border-card-border rounded-lg px-4 py-3 text-foreground/70 focus:outline-none" />
            <p className={HINT}>Cole essa URL no script do Google Ads (UrlFetchApp)</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="webhook-key" className={LABEL}>Google Ads — Chave do Webhook</label>
            <div className="flex gap-2">
              <input id="webhook-key" type="text" readOnly value={form.googleAdsWebhookSecret} onFocus={(e) => e.target.select()} placeholder="Clique em gerar →"
                className="flex-1 bg-background border border-card-border rounded-lg px-4 py-3 text-foreground/70 focus:outline-none" />
              <button
                onClick={() => {
                  setForm({ ...form, googleAdsWebhookSecret: crypto.randomUUID().replace(/-/g, "") });
                  setSaved(false);
                }}
                className="shrink-0 bg-transparent border border-card-border hover:bg-black/5 dark:hover:bg-white/5 text-foreground px-4 rounded-lg font-semibold transition-colors"
              >
                Gerar nova
              </button>
            </div>
            <p className={HINT}>Cole essa chave no script como cabeçalho Authorization: Bearer — gerar uma nova invalida a antiga</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="google-script" className={LABEL}>Google Ads — Script pronto para colar</label>
              <button onClick={copyScript} className="text-xs font-semibold text-primary hover:underline">
                {copied ? "Copiado!" : "Copiar script"}
              </button>
            </div>
            <textarea id="google-script" readOnly value={script} rows={8} onFocus={(e) => e.target.select()}
              className="w-full bg-background border border-card-border rounded-lg px-4 py-3 text-foreground/70 text-xs font-mono focus:outline-none" />
            <p className={HINT}>
              Google Ads → Ferramentas → Ações em massa → Scripts → Novo script → cole, autorize e agende (1x por dia).
              {google && google.updatedAt
                ? ` Último envio recebido em ${new Date(google.updatedAt).toLocaleString("pt-BR")} (${google.rows} linhas de campanha).`
                : " Nenhum envio recebido ainda."}
            </p>
          </div>

          <div className="pt-6 flex items-center gap-4 border-t border-card-border">
            <button onClick={save} className="bg-primary hover:bg-primary-hover text-white px-8 py-3 rounded-lg font-semibold transition-colors shadow-sm">
              Salvar
            </button>
            <button onClick={clear} className="bg-transparent border border-card-border hover:bg-black/5 dark:hover:bg-white/5 text-foreground px-8 py-3 rounded-lg font-semibold transition-colors">
              Limpar
            </button>
            {saved && <span className="text-green-500 font-medium text-sm">Salvo com sucesso!</span>}
            {error && <span className="text-red-500 font-medium text-sm">{error}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
