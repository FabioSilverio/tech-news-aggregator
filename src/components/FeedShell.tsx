"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import type { AggregatedItem } from "@/lib/types";

type TabId = "home" | "chrono";

function formatTimeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h`;
  const d = Math.floor(h / 24);
  return `${d} d`;
}

function Row({
  item,
  rank,
  highlightComments,
}: {
  item: AggregatedItem;
  rank: number;
  highlightComments: boolean;
}) {
  return (
    <article className="flex gap-3 border-b border-gray-200 bg-white px-4 py-4 sm:gap-4 sm:px-6">
      <div className="flex w-14 shrink-0 flex-col items-center gap-1 text-gray-400">
        <span className="text-sm font-medium tabular-nums text-gray-500">{rank}</span>
        <div className="flex flex-col items-center gap-0.5 rounded border border-gray-200 bg-gray-50 px-1 py-1 text-xs">
          <span className="leading-none text-gray-400">▲</span>
          <span className="font-semibold tabular-nums text-gray-700">
            {item.source === "rss" && item.score === 0
              ? "—"
              : item.score > 999
                ? `${(item.score / 1000).toFixed(1)}k`
                : item.score}
          </span>
          <span className="leading-none text-gray-400">▼</span>
        </div>
      </div>

      {item.thumbnail ? (
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element -- URLs dinâmicas de feeds/OG */}
          <img
            src={item.thumbnail}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group block"
        >
          <h2 className="text-base font-semibold leading-snug text-[#1a1a1b] group-hover:underline sm:text-lg">
            {item.title}{" "}
            <span className="text-sm font-normal text-gray-500">({item.domain})</span>
          </h2>
        </a>
        <p className="mt-1 text-xs text-gray-500 sm:text-sm">
          enviado há {formatTimeAgo(item.createdAt)}
          {item.author ? (
            <>
              {" "}
              por <span className="text-gray-600">{item.author}</span>
            </>
          ) : null}{" "}
          · <span className="text-gray-600">{item.sourceLabel}</span>
        </p>
      </div>

      <div className="hidden shrink-0 items-start gap-3 pt-1 text-gray-400 sm:flex">
        <span className="cursor-default" title="Compartilhar">
          ↗
        </span>
        <span className="cursor-default" title="Salvar">
          ⧉
        </span>
        <span className="cursor-default" title="Ocultar">
          ✕
        </span>
      </div>

      <div className="flex shrink-0 flex-col items-end justify-start pt-1">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-1 text-sm tabular-nums ${
            highlightComments ? "font-semibold text-[#ff4500]" : "text-gray-500"
          }`}
        >
          <span aria-hidden>💬</span>
          {item.comments}
        </a>
      </div>
    </article>
  );
}

export function FeedShell({
  homeItems,
  chronoItems,
}: {
  homeItems: AggregatedItem[];
  chronoItems: AggregatedItem[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("home");
  const [refreshing, setRefreshing] = useState(false);
  const list = tab === "home" ? homeItems : chronoItems;

  const onHardRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/refresh", { method: "POST" });
      if (!res.ok) throw new Error("Falha ao revalidar");
      router.refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  }, [router]);

  const hotCommentIndices = useMemo(() => {
    const comments = list.map((i) => i.comments);
    const max = Math.max(0, ...comments);
    const threshold = max > 0 ? max * 0.45 : 0;
    const set = new Set<number>();
    list.forEach((item, idx) => {
      if (item.comments >= threshold && item.comments > 0) set.add(idx);
    });
    return set;
  }, [list]);

  return (
    <div className="min-h-screen bg-[#f6f7f8]">
      <nav className="border-b border-gray-200 bg-[#eceef0] px-4 py-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-600">
        <div className="mx-auto flex max-w-5xl flex-wrap gap-x-4 gap-y-1">
          {["Front", "Tech", "Ciência", "Startups", "IA", "Gadgets"].map((c) => (
            <span key={c} className="cursor-default hover:text-gray-800">
              {c}
            </span>
          ))}
        </div>
      </nav>

      <header className="bg-[#ff4500] text-white shadow-sm">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-white/15 text-lg font-black tracking-tight">
              T
            </div>
            <span className="text-lg font-bold tracking-tight">TechFeed</span>
          </div>

          <div className="flex flex-1 flex-wrap items-center justify-center gap-1 sm:justify-center">
            {(
              [
                { id: "home" as const, label: "Destaques" },
                { id: "chrono" as const, label: "Cronológico" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded px-4 py-1.5 text-sm font-semibold transition-colors ${
                  tab === t.id ? "bg-[#e63e00] text-white" : "text-white/90 hover:bg-white/10"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:min-w-[200px] sm:justify-end">
            <button
              type="button"
              onClick={onHardRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-white/95 px-3 py-1.5 text-sm font-semibold text-gray-800 shadow-sm hover:bg-white disabled:cursor-wait disabled:opacity-70"
              title="Atualizar feeds agora (pega de novo HN, Reddit, RSS)"
            >
              <span
                className={`inline-block ${refreshing ? "animate-spin" : ""}`}
                aria-hidden
              >
                ↻
              </span>
              {refreshing ? "A atualizar…" : "Atualizar"}
            </button>
            <div className="hidden flex-1 items-center rounded-full bg-white/15 px-3 py-1.5 text-sm text-white/90 sm:flex sm:max-w-xs">
              <span className="mr-2 opacity-60">🔍</span>
              <span className="truncate">Buscar no feed…</span>
            </div>
            <button
              type="button"
              className="whitespace-nowrap rounded bg-white/10 px-2 py-1 text-sm hover:bg-white/20"
            >
              visitante ▾
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl border-x border-gray-200 bg-white shadow-sm">
        <p className="border-b border-gray-100 px-4 py-2 text-xs text-gray-500 sm:px-6">
          {tab === "home"
            ? "Destaques: pontuação por fonte (votos, comentários, similaridade com tendências) e listagem HN → Reddit → RSS em ciclo para misturar as origens no topo."
            : "Todas as fontes misturadas por data (mais recentes primeiro)."}
        </p>
        {list.length === 0 ? (
          <p className="p-8 text-center text-gray-500">Nada carregado. Tente atualizar a página.</p>
        ) : (
          list.map((item, i) => (
            <Row
              key={item.id}
              item={item}
              rank={i + 1}
              highlightComments={hotCommentIndices.has(i)}
            />
          ))
        )}
      </main>

      <footer className="mx-auto max-w-5xl px-4 py-6 text-center text-xs text-gray-500">
        Fontes: Hacker News, Reddit (hot), The Verge RSS, TechCrunch RSS. Apenas leitura; links
        abrem no site original.
      </footer>
    </div>
  );
}
