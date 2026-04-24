const feeds = [
  ["The Verge", "https://www.theverge.com/rss/index.xml"],
  ["TechCrunch", "https://techcrunch.com/feed/"],
];

async function fetchText(url) {
  const r = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "application/rss+xml, application/atom+xml, */*",
    },
  });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.text();
}

function firstItems(xml, n = 5) {
  const isAtom = /xmlns="http:\/\/www.w3.org\/2005\/Atom"/i.test(xml);
  if (isAtom) {
    const entries = xml.split(/<entry[\s>]/i).slice(1, n + 1);
    return entries.map((block) => {
      const updated =
        block.match(/<updated>([^<]+)<\/updated>/i)?.[1] ||
        block.match(/<published>([^<]+)<\/published>/i)?.[1];
      const title =
        block.match(/<title>([^<]*)<\/title>/i)?.[1] ||
        block.match(/<title type="html"><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i)?.[1];
      return { date: updated?.trim(), title: title?.replace(/<[^>]+>/g, "").trim().slice(0, 80) };
    });
  }
  const items = xml.split(/<item[\s>]/i).slice(1, n + 1);
  return items.map((block) => {
    const pubDate =
      block.match(/<pubDate>([^<]+)<\/pubDate>/i)?.[1] ||
      block.match(/<dc:date>([^<]+)<\/dc:date>/i)?.[1];
    const titleM =
      block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i) ||
      block.match(/<title>([^<]+)<\/title>/i);
    const title = titleM ? (titleM[1] || titleM[0]).replace(/<[^>]+>/g, "").trim() : "";
    return { date: pubDate?.trim(), title: title.slice(0, 80) };
  });
}

const now = Date.now();
for (const [name, url] of feeds) {
  console.log(`\n=== ${name} ===`);
  try {
    const xml = await fetchText(url);
    const rows = firstItems(xml, 5);
    for (let i = 0; i < rows.length; i++) {
      const { date, title } = rows[i];
      const parsed = date ? new Date(date) : null;
      const valid = parsed && !Number.isNaN(parsed.getTime());
      const ageH = valid ? ((now - parsed.getTime()) / 36e5).toFixed(2) : "?";
      console.log(`  ${i + 1}. ${date || "NO DATE"}`);
      if (valid) console.log(`     -> parsed ISO: ${parsed.toISOString()}  (~${ageH}h ago)`);
      console.log(`     ${title || ""}`);
    }
  } catch (e) {
    console.error("  ERROR:", e.message);
  }
}
