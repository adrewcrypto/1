"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
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
];

function generateAllocations() {
  const arr: any[] = [];

  // pinned whales
  for (let i = 0; i < PINNED_COUNT; i++) {
    arr.push({
      id: `WHALE_${i}`,
      btc: PINNED_WHALE_BTC,
      isPinned: true,
    });
  }

  let remaining = BTC_POOL_TOTAL - PINNED_WHALE_BTC * PINNED_COUNT;

  for (let i = PINNED_COUNT; i < ADDRESS_COUNT; i++) {
    const btc = Math.random() * (remaining / (ADDRESS_COUNT - i));
    remaining -= btc;

    arr.push({
      id: `addr_${i}`,
      btc,
      isPinned: false,
    });
  }

  return arr;
}

export default function Page() {
  const [allocations] = useState(() => generateAllocations());
  const [btcPrice, setBtcPrice] = useState(68000);
  const [error, setError] = useState("");
  const [pulse, setPulse] = useState(0);

  // 🔥 SAFE PRICE FETCH
  useEffect(() => {
    let lastGoodPrice = 68000;

    async function fetchPrice() {
      try {
        const res = await fetch(LIVE_PRICE_URL);

        if (!res.ok) throw new Error("fail");

        const json = await res.json();

        const price = Number(json?.bitcoin?.usd);

        if (!price || isNaN(price)) throw new Error("bad");

        lastGoodPrice = price;
        setBtcPrice(price);
        setError("");
      } catch {
        setBtcPrice(lastGoodPrice);
        setError("⚠ Using fallback price");
      }
    }

    fetchPrice();
    const interval = setInterval(fetchPrice, 30000);

    return () => clearInterval(interval);
  }, []);

  // 🔥 LIVE MOVEMENT
  useEffect(() => {
    const interval = setInterval(() => {
      setPulse((p) => p + 1);
    }, 1200);

    return () => clearInterval(interval);
  }, []);

  const liveRows = useMemo(() => {
    return allocations.map((row, i) => {
      const wave = Math.sin((pulse + i) * 0.3) * 0.01;
      const adjusted = row.btc * (1 + wave);

      return {
        id: row.id,
        btc: adjusted,
        usd: adjusted * btcPrice,
        isPinned: row.isPinned,
      };
    });
  }, [allocations, pulse, btcPrice]);

  const top = liveRows.slice(0, 10);

  const pieData = top.map((r) => ({
    name: r.id,
    value: r.btc,
  }));

  const history = [1, 2, 3].map((y) => ({
    year: y,
    hold: BTC_POOL_TOTAL * btcPrice * (1 + y * 0.25),
    lp: BTC_POOL_TOTAL * btcPrice * (1 + y * 0.15),
  }));

  return (
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      <h1>BTC DeFi Liquidity Dashboard</h1>

      <h2>
        BTC Price: ${btcPrice.toLocaleString()}{" "}
        {error && <span style={{ color: "red" }}>{error}</span>}
      </h2>

      {/* CHART */}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={history}>
          <XAxis dataKey="year" />
          <YAxis />
          <Tooltip />
          <Line dataKey="hold" stroke="#6366f1" />
          <Line dataKey="lp" stroke="#22c55e" />
        </LineChart>
      </ResponsiveContainer>

      {/* PIE */}
      <h3>Top Wallet Distribution</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie data={pieData} dataKey="value">
            {pieData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      {/* TABLE */}
      <h3>Live Wallets</h3>
      <div style={{ maxHeight: 300, overflow: "auto" }}>
        {liveRows.slice(0, 20).map((r) => (
          <div
            key={r.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: 6,
              borderBottom: "1px solid #eee",
              color: r.isPinned ? "#22c55e" : "#000",
              fontWeight: r.isPinned ? "bold" : "normal",
            }}
          >
            <span>{r.id}</span>
            <span>{r.btc.toFixed(4)} BTC</span>
            <span>${r.usd.toFixed(0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
