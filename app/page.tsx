"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";

const BTC_POOL_TOTAL = 289;
const ADDRESS_COUNT = 1000;
const PINNED_WHALE_BTC = 1.5;
const PINNED_COUNT = 2;
const LIVE_PRICE_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true";

const COLORS = [
  "#22c55e",
  "#06b6d4",
  "#8b5cf6",
  "#f59e0b",
  "#ef4444",
  "#3b82f6",
  "#ec4899",
  "#14b8a6",
  "#a855f7",
  "#84cc16",
];

function usd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

function usd2(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

function btc(n: number) {
  return `${n.toFixed(4)} BTC`;
}

function pct(n: number) {
  return `${n.toFixed(2)}%`;
}

function shortAddress(id: string) {
  return `${id.slice(0, 6)}...${id.slice(-4)}`;
}

type AddressRow = {
  id: string;
  btc: number;
  usd: number;
  sharePct: number;
  flow: number;
  isPinned: boolean;
};

type HistoryRow = {
  tick: string;
  btcPrice: number;
  poolUsd: number;
  stakedBtc: number;
};

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function makeHexAddress(i: number) {
  let out = "0x";
  for (let j = 0; j < 40; j++) {
    const n = Math.floor(seededRandom(i * 100 + j + 1) * 16);
    out += n.toString(16);
  }
  return out;
}

function generateAllocations(total: number, count: number) {
  const pinnedTotal = PINNED_WHALE_BTC * PINNED_COUNT;
  const remaining = total - pinnedTotal;
  const variableCount = count - PINNED_COUNT;

  const weights = Array.from({ length: variableCount }, (_, i) => {
    const r = seededRandom(i + 11);
    return Math.pow(r + 0.02, 2.2);
  });

  const weightSum = weights.reduce((a, b) => a + b, 0);
  const variableAllocations = weights.map((w) => (w / weightSum) * remaining);

  const rows = [
    { id: makeHexAddress(1), btc: PINNED_WHALE_BTC, isPinned: true },
    { id: makeHexAddress(2), btc: PINNED_WHALE_BTC, isPinned: true },
    ...variableAllocations.map((amt, idx) => ({
      id: makeHexAddress(idx + 3),
      btc: amt,
      isPinned: false,
    })),
  ];

  return rows.sort((a, b) => b.btc - a.btc);
}

export default function Page() {
  const [btcPrice, setBtcPrice] = useState(0);
  const [btcChange24h, setBtcChange24h] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pulse, setPulse] = useState(0);
  const [allocations] = useState(() => generateAllocations(BTC_POOL_TOTAL, ADDRESS_COUNT));
  const [history, setHistory] = useState<HistoryRow[]>([]);

  useEffect(() => {
    async function fetchPrice() {
      try {
        const res = await fetch(LIVE_PRICE_URL, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setBtcPrice(Number(json?.bitcoin?.usd || 0));
        setBtcChange24h(Number(json?.bitcoin?.usd_24h_change || 0));
        setError("");
      } catch (e: any) {
        setError("Live BTC price fetch failed. Dashboard keeps simulating using the last known price.");
      } finally {
        setLoading(false);
      }
    }

    fetchPrice();
    const priceInterval = setInterval(fetchPrice, 15000);
    const pulseInterval = setInterval(() => setPulse((p) => p + 1), 1200);

    return () => {
      clearInterval(priceInterval);
      clearInterval(pulseInterval);
    };
  }, []);

  const liveRows: AddressRow[] = useMemo(() => {
    const basePrice = btcPrice || 68000;
    return allocations.map((row, idx) => {
      const wave = Math.sin((pulse + idx) * 0.22) * 0.0075;
      const wave2 = Math.cos((pulse + idx * 2) * 0.11) * 0.004;
      const adjustedBtc = row.btc * (1 + wave + wave2);
      const usdValue = adjustedBtc * basePrice;
      return {
        id: row.id,
        btc: adjustedBtc,
        usd: usdValue,
        sharePct: (adjustedBtc / BTC_POOL_TOTAL) * 100,
        flow: (wave + wave2) * 100,
        isPinned: row.isPinned,
      };
    });
  }, [allocations, btcPrice, pulse]);

  const top10 = useMemo(() => liveRows.slice(0, 10), [liveRows]);
  const top20 = useMemo(() => liveRows.slice(0, 20), [liveRows]);
  const pinned = useMemo(() => liveRows.filter((r) => r.isPinned), [liveRows]);

  const poolUsd = useMemo(() => BTC_POOL_TOTAL * (btcPrice || 68000), [btcPrice]);
  const avgBtc = BTC_POOL_TOTAL / ADDRESS_COUNT;
  const medianBtc = useMemo(() => {
    const values = liveRows.map((r) => r.btc).sort((a, b) => a - b);
    const mid = Math.floor(values.length / 2);
    return values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];
  }, [liveRows]);

  const concentration = useMemo(() => {
    const top10Share = top10.reduce((sum, r) => sum + r.btc, 0) / BTC_POOL_TOTAL;
    const top100Share = liveRows.slice(0, 100).reduce((sum, r) => sum + r.btc, 0) / BTC_POOL_TOTAL;
    return { top10Share, top100Share };
  }, [liveRows, top10]);

  const pieData = useMemo(() => {
    const top5 = liveRows.slice(0, 5).map((r, i) => ({
      name: r.isPinned ? `Pinned ${i + 1}` : `Addr ${i + 1}`,
      value: r.btc,
    }));
    const rest = BTC_POOL_TOTAL - top5.reduce((s, x) => s + x.value, 0);
    return [...top5, { name: "Other 995", value: rest }];
  }, [liveRows]);

  const buckets = useMemo(() => {
    const ranges = [
      { name: "<0.05 BTC", min: 0, max: 0.05 },
      { name: "0.05–0.10", min: 0.05, max: 0.1 },
      { name: "0.10–0.25", min: 0.1, max: 0.25 },
      { name: "0.25–0.50", min: 0.25, max: 0.5 },
      { name: "0.50–1.00", min: 0.5, max: 1 },
      { name: ">1 BTC", min: 1, max: Infinity },
    ];

    return ranges.map((range) => ({
      name: range.name,
      count: liveRows.filter((r) => r.btc >= range.min && r.btc < range.max).length,
    }));
  }, [liveRows]);

  useEffect(() => {
  let lastGoodPrice = 68000;

  async function fetchPrice() {
    try {
      const res = await fetch(LIVE_PRICE_URL);

      if (!res.ok) throw new Error("Bad response");

      const json = await res.json();

      const price = Number(json?.bitcoin?.usd);
      const change = Number(json?.bitcoin?.usd_24h_change);

      if (!price || isNaN(price)) throw new Error("Invalid price");

      setBtcPrice(price);
      setBtcChange24h(change || 0);
      lastGoodPrice = price;
      setError("");
    } catch (e) {
      console.warn("Price fetch failed, using fallback");
      setBtcPrice(lastGoodPrice);
      setError("Using fallback BTC price (API temporarily unavailable)");
    } finally {
      setLoading(false);
    }
  }

  fetchPrice();

  const interval = setInterval(fetchPrice, 30000);
  const pulseInterval = setInterval(() => {
    setPulse((p) => p + 1);
  }, 1200);

  return () => {
    clearInterval(interval);
    clearInterval(pulseInterval);
  };
}, []);

    setHistory((prev) => [...prev.slice(-29), next]);
  }, [pulse, btcPrice, poolUsd]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, #1e293b 0%, #0f172a 35%, #020617 100%)",
        color: "#e2e8f0",
        padding: 24,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1450, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.35)", padding: "8px 14px", borderRadius: 999 }}>
              <div style={{ width: 10, height: 10, borderRadius: 999, background: "#22c55e", boxShadow: "0 0 18px #22c55e" }} />
              <span style={{ fontSize: 13, fontWeight: 700 }}>LIVE STAKING PANEL</span>
            </div>
            <h1 style={{ margin: "14px 0 8px", fontSize: 42, lineHeight: 1.05 }}>
              BTC Pool Dashboard — 289 BTC / 1000 Addresses
            </h1>
            <div style={{ color: "#94a3b8", fontSize: 16, maxWidth: 900 }}>
              Live BTC price feed with continuously moving simulated wallet allocations. Two pinned wallets hold exactly 1.5 BTC each.
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#94a3b8", fontSize: 13 }}>Feed source</div>
            <div style={{ fontWeight: 700 }}>CoinGecko BTC/USD</div>
            <div style={{ color: btcChange24h >= 0 ? "#22c55e" : "#ef4444", fontWeight: 700, marginTop: 6 }}>
              24h BTC {btcChange24h >= 0 ? "+" : ""}{pct(btcChange24h)}
            </div>
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 18, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)", padding: 14, borderRadius: 16 }}>
            {error}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 16, marginTop: 22 }}>
          {[
            { label: "BTC Price", value: usd2(btcPrice || 68000), sub: loading ? "Loading..." : "Live" },
            { label: "Pool Size", value: `${BTC_POOL_TOTAL} BTC`, sub: usd(poolUsd) },
            { label: "Addresses", value: `${ADDRESS_COUNT}`, sub: `Avg ${btc(avgBtc)}` },
            { label: "Median Wallet", value: btc(medianBtc), sub: `Top 10 ${(concentration.top10Share * 100).toFixed(1)}%` },
            { label: "Pinned Wallets", value: `${PINNED_COUNT}`, sub: `Each ${btc(PINNED_WHALE_BTC)}` },
          ].map((card, idx) => (
            <div
              key={card.label}
              style={{
                borderRadius: 24,
                padding: 18,
                background: `linear-gradient(135deg, ${idx % 2 === 0 ? "rgba(30,41,59,0.96)" : "rgba(15,23,42,0.96)"} 0%, rgba(30,41,59,0.75) 100%)`,
                border: "1px solid rgba(148,163,184,0.18)",
                boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
              }}
            >
              <div style={{ color: "#94a3b8", fontSize: 13 }}>{card.label}</div>
              <div style={{ fontSize: 30, fontWeight: 800, marginTop: 8 }}>{card.value}</div>
              <div style={{ color: "#cbd5e1", fontSize: 13, marginTop: 8 }}>{card.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 18, marginTop: 22 }}>
          <div style={panelStyle}>
            <div style={panelTitle}>Pool Value / BTC Price Feed</div>
            <div style={{ width: "100%", height: 330 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id="poolGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.55} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(148,163,184,0.15)" strokeDasharray="3 3" />
                  <XAxis dataKey="tick" stroke="#94a3b8" minTickGap={20} />
                  <YAxis yAxisId="left" stroke="#94a3b8" tickFormatter={(v) => `$${Math.round(v / 1000000)}m`} />
                  <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
                  <Tooltip
                    contentStyle={{ background: "#0f172a", border: "1px solid rgba(148,163,184,0.22)", borderRadius: 14 }}
                    formatter={(value: any, name: any) => [name === "poolUsd" ? usd(Number(value)) : usd2(Number(value)), name === "poolUsd" ? "Pool USD" : "BTC Price"]}
                  />
                  <Area yAxisId="left" type="monotone" dataKey="poolUsd" stroke="#22c55e" fill="url(#poolGradient)" strokeWidth={2.5} />
                  <Area yAxisId="right" type="monotone" dataKey="btcPrice" stroke="#3b82f6" fill="url(#priceGradient)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={panelStyle}>
            <div style={panelTitle}>Wallet Concentration</div>
            <div style={{ width: "100%", height: 330 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={115} paddingAngle={3}>
                    {pieData.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#0f172a", border: "1px solid rgba(148,163,184,0.22)", borderRadius: 14 }}
                    formatter={(value: any) => btc(Number(value))}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 18 }}>
          <div style={panelStyle}>
            <div style={panelTitle}>Address Size Distribution</div>
            <div style={{ width: "100%", height: 290 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={buckets}>
                  <CartesianGrid stroke="rgba(148,163,184,0.15)" strokeDasharray="3 3" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ background: "#0f172a", border: "1px solid rgba(148,163,184,0.22)", borderRadius: 14 }}
                    formatter={(value: any) => [`${value}`, "Addresses"]}
                  />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                    {buckets.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={panelStyle}>
            <div style={panelTitle}>Pinned Wallets</div>
            <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
              {pinned.map((row, idx) => (
                <div
                  key={row.id}
                  style={{
                    borderRadius: 20,
                    padding: 16,
                    background: `linear-gradient(135deg, rgba(${idx === 0 ? "34,197,94" : "59,130,246"},0.18), rgba(15,23,42,0.65))`,
                    border: "1px solid rgba(148,163,184,0.18)",
                  }}
                >
                  <div style={{ fontSize: 13, color: "#cbd5e1" }}>Pinned address #{idx + 1}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginTop: 6 }}>{shortAddress(row.id)}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
                    <span>{btc(PINNED_WHALE_BTC)}</span>
                    <span>{usd2(row.usd)}</span>
                  </div>
                  <div style={{ color: row.flow >= 0 ? "#22c55e" : "#ef4444", marginTop: 8, fontSize: 13 }}>
                    Live flow {row.flow >= 0 ? "+" : ""}{pct(row.flow)}
                  </div>
                </div>
              ))}
              <div style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.6 }}>
                These two wallets are fixed at exactly 1.5 BTC base allocation each, then visually pulse in USD value with live BTC price and panel motion.
              </div>
            </div>
          </div>
        </div>

        <div style={{ ...panelStyle, marginTop: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div style={panelTitle}>Top 20 Wallets — Live Allocation Table</div>
            <div style={{ color: "#94a3b8", fontSize: 13 }}>
              Top 100 wallets hold {(concentration.top100Share * 100).toFixed(1)}% of the 289 BTC pool
            </div>
          </div>
          <div style={{ overflowX: "auto", marginTop: 14 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
              <thead>
                <tr>
                  {[
                    "Rank",
                    "Address",
                    "BTC",
                    "USD Value",
                    "Pool Share",
                    "Live Flow",
                    "Flag",
                  ].map((head) => (
                    <th key={head} style={thStyle}>{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {top20.map((row, idx) => (
                  <tr key={row.id} style={{ background: idx % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent" }}>
                    <td style={tdStyle}>{idx + 1}</td>
                    <td style={tdStyle}>{shortAddress(row.id)}</td>
                    <td style={tdStyle}>{btc(row.btc)}</td>
                    <td style={tdStyle}>{usd2(row.usd)}</td>
                    <td style={tdStyle}>{pct(row.sharePct)}</td>
                    <td style={{ ...tdStyle, color: row.flow >= 0 ? "#22c55e" : "#ef4444", fontWeight: 700 }}>
                      {row.flow >= 0 ? "+" : ""}{pct(row.flow)}
                    </td>
                    <td style={tdStyle}>{row.isPinned ? "Pinned 1.5 BTC" : idx < 10 ? "Whale" : "Standard"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  borderRadius: 24,
  padding: 18,
  background: "linear-gradient(180deg, rgba(15,23,42,0.92) 0%, rgba(15,23,42,0.72) 100%)",
  border: "1px solid rgba(148,163,184,0.16)",
  boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
};

const panelTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  marginBottom: 10,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: 12,
  color: "#94a3b8",
  fontSize: 13,
  borderBottom: "1px solid rgba(148,163,184,0.16)",
};

const tdStyle: React.CSSProperties = {
  padding: 12,
  fontSize: 14,
  borderBottom: "1px solid rgba(148,163,184,0.08)",
};
