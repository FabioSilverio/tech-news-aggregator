/**
 * Carrega uma fonte sem derrubar a página: em caso de erro, devolve array vazio.
 * Em dev, o erro vai para o console (útil com `vercel dev` / local).
 */
export async function loadSourceSafe<Row extends { id: string }>(
  sourceName: string,
  load: () => Promise<Row[]>,
): Promise<Row[]> {
  try {
    return await load();
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.error(`[tech-feed: source failed] ${sourceName}`, err);
    }
    return [];
  }
}

