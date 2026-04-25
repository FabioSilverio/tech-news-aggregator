import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

/**
 * Invalida o cache ISR desta rota; o próximo `router.refresh()` (ou carga) busca feeds de novo.
 */
export async function POST() {
  try {
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, at: new Date().toISOString() });
  } catch (e) {
    console.error("[api/refresh]", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
