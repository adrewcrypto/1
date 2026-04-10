"use client";
import React, { useEffect, useMemo, useState } from "react";

const APR = 0.05;
const LOCK_START_ISO = "2026-04-01T00:00:00Z";
const LOCK_END_ISO = "2031-04-01T00:00:00Z";
const DAY_MS = 24 * 60 * 60 * 1000;
const USD_LOCALE = "en-US";

const PINNED_WALLETS = [
  {
    id: "andrew",
    member: "Andrew",
    address: "0x44ec7f9a8db1432ea54b6f12c6a41fa54ed6d7c6",
    btc: 1.5016,
  },
  {
    id: "ksenia",
    member: "Ksenia",
    address: "0x12135f70dceeb99241f86f34f9685e1a1c4d63e7",
    btc: 1.5016,
  },
];

const TOP_WALLETS = [
  ["0x3087c4fe90d7f3b7d827f1f52683e117d6fa64b2", 3.0738, 0.004, "Whale"],
  ["0xe267be53729a9735f5547946ed5ace8df842dbea", 3.0670, 0.0055, "Whale"],
  ["0xcb0f50d1d8ce1d4b8f4a70dfc95f6037f882ff19", 3.0524, 0.0068, "Whale"],
  ["0x2b09c47f96d0f9ef8d0ee8e2db9cb91c310ac312", 3.0484, 0.0078, "Whale"],
  ["0xcf3e932437a5fa8f4b7e1f5d3c3d5a8b768a4f7e", 3.0378, 0.0083, "Whale"],
  ["0xc61d0f06c9a8f7e48c6fda0ba56f8a4f29582a52", 3.0111, 0.0085, "Whale"],
  ["0xd9cebd4a7413ef3d4af7b0b8f52a8b945ef84bf7", 3.0054, 0.0083, "Whale"],
  ["0x6efe1a88d94f561d8ba30e99a8425c91af4d6f4e", 2.9414, 0.0076, "Whale"],
  ["0x4f51e87f031f3bcd2bb5ad420bc832fa91447fab", 2.8998, 0.0066, "Whale"],
  ["0xa1b304ceef6332666b91291e8fd6500ab9137d46", 2.8947, 0.0053, "Whale"],
  ["0x154a8d0ef426c2baaf34dd2a4f6bb4be1d8a7d7a", 2.8869, 0.0037, "Standard"],
  ["0xacf8b6932998a59f8389d98d7c60a9786d4dc07c", 2.8795, 0.002, "Standard"],
  ["0xb3134cb0b76df9f3eaab7584a7a66ef0f638819b", 2.8699, 0.0001, "Standard"],
  ["0x849ce0f50881e058e4dfb3e4f885d0f8b9f4bc80", 2.8358, -0.0018, "Standard"],
  ["0xd97bf58ca7c9554664908a9a9ff6d95333cedb19", 2.8206, -0.0035, "Standard"],
  ["0x154f4a7e0fcf8f6a95164bd7c2524e16bc0bcc8a", 2.8009, -0.0051, "Standard"],
  ["0x30549c7b7cc85c8738d6957ec4fc0a0a41e40ef0", 2.7952, -0.0065, "Standard"],
  ["0xd5099a3413a87139b3657c14aa0d50b7f6496326", 2.7770, -0.0075, "Standard"],
  ["0xa198eb3ee2dbf4e3e8d379d5d86a7f57b8e56846", 2.7718, -0.0082, "Standard"],
  ["0x49d634af0db6a75ab8ab9cd10f818f4ab7f8db5d", 2.7485, -0.0085, "Standard"],
];

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function daysBetween(start: Date, end: Date) {
  return Math.max(0, Math.floor((startOfUtcDay(end).getTime() - startOfUtcDay(start).getTime()) / DAY_MS));
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

function compoundBtc(principal: number, apr: number, days: number) {
  return principal * Math.pow(1 + apr / 365, days);
}

function accruedRewardBtc(principal: number, apr: number, days: number) {
  return compoundBtc(principal, apr, days) - principal;
}

function formatUsd(value: number) {
  return new Intl.NumberFormat(USD_LOCALE, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatBtc(value: number, digits = 4) {
  return `${value.toFixed(digits)} BTC`;
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

function MetricCard({ label, value, subvalue }: { label: string; value: string; subvalue?: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-sm backdrop-blur">
      <div className="text-xs uppercase tracking-[0.22em] text-white/50">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
      {subvalue ? <div className="mt-1 text-sm text-white/60">{subvalue}</div> : null}
    </div>
  );
}

export default function App() {
  const [btcPrice, setBtcPrice] = useState(68000);
  const [priceDelta24h, setPriceDelta24h] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadPrice() {
      try {
        const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true", {
          headers: { accept: "application/json" },
        });

        if (!response.ok) throw new Error("Failed to fetch BTC price");
        const data = await response.json();
        if (!isMounted) return;

        const nextPrice = Number(data?.bitcoin?.usd);
        const nextDelta = Number(data?.bitcoin?.usd_24h_change ?? 0);

        if (Number.isFinite(nextPrice)) setBtcPrice(nextPrice);
        if (Number.isFinite(nextDelta)) setPriceDelta24h(nextDelta);
      } catch {
        // Keep fallback values so UI still renders.
      }
    }

    loadPrice();
    const interval = setInterval(loadPrice, 60000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const now = new Date();
  const lockStart = new Date(LOCK_START_ISO);
  const lockEnd = new Date(LOCK_END_ISO);

  const totalLockDays = daysBetween(lockStart, lockEnd);
  const elapsedDays = Math.min(totalLockDays, daysBetween(lockStart, now));
  const remainingDays = Math.max(0, totalLockDays - elapsedDays);

  const totalPoolBtc = 460;
  const totalAddresses = 500;
  const avgAddressBtc = totalPoolBtc / totalAddresses;

  const poolAccruedRewardsBtc = accruedRewardBtc(totalPoolBtc, APR, elapsedDays);
  const projectedPoolBtc = compoundBtc(totalPoolBtc, APR, totalLockDays);
  const projectedReleaseDate = addDays(lockStart, totalLockDays);

  const pinnedWallets = useMemo(
    () =>
      PINNED_WALLETS.map((wallet) => {
        const projectedBtc = compoundBtc(wallet.btc, APR, totalLockDays);
        const accruedBtc = accruedRewardBtc(wallet.btc, APR, elapsedDays);
        return {
          ...wallet,
          accruedBtc,
          projectedBtc,
          currentUsd: wallet.btc * btcPrice,
          projectedUsd: projectedBtc * btcPrice,
        };
      }),
    [btcPrice, elapsedDays, totalLockDays]
  );

  const topWallets = useMemo(
    () =>
      TOP_WALLETS.map(([address, btc, flow, flag], index) => ({
        rank: index + 1,
        address: String(address),
        btc: Number(btc),
        flow: Number(flow),
        flag: String(flag),
        usdValue: Number(btc) * btcPrice,
        poolShare: (Number(btc) / totalPoolBtc) * 100,
      })),
    [btcPrice]
  );

  return (
    <main className="min-h-screen bg-[#07111f] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-cyan-300/80">Live Staking Panel</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">BTC Fixed Yield Pool — 5Y Lock</h1>
            <p className="mt-2 text-sm text-white/60">Compound model corrected: projections now use daily compounding in BTC across the full lock term.</p>
          </div>
          <div className="rounded-3xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
            Subscription closed
          </div>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="BTC Price" value={formatUsd(btcPrice)} subvalue={`24h BTC ${priceDelta24h >= 0 ? "+" : ""}${priceDelta24h.toFixed(2)}%`} />
          <MetricCard label="Pool Size" value={formatBtc(totalPoolBtc, 0)} subvalue={formatUsd(totalPoolBtc * btcPrice)} />
          <MetricCard label="Addresses" value={String(totalAddresses)} subvalue={`Avg ${formatBtc(avgAddressBtc)}`} />
          <MetricCard label="Accrued Rewards" value={formatBtc(poolAccruedRewardsBtc)} subvalue={formatUsd(poolAccruedRewardsBtc * btcPrice)} />
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 lg:col-span-2">
            <div className="text-xs uppercase tracking-[0.22em] text-white/50">5-Year Lock Projection</div>
            <div className="mt-3 text-3xl font-semibold text-white">{formatUsd(projectedPoolBtc * btcPrice)}</div>
            <div className="mt-1 text-sm text-white/60">Projected release {formatDate(projectedReleaseDate)}</div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-white/45">APR</div>
                <div className="mt-2 text-xl font-semibold">{(APR * 100).toFixed(2)}%</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-white/45">Projected BTC</div>
                <div className="mt-2 text-xl font-semibold">{formatBtc(projectedPoolBtc, 4)}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-white/45">Remaining Days</div>
                <div className="mt-2 text-xl font-semibold">{remainingDays}</div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs uppercase tracking-[0.22em] text-white/50">Pool Lock Rules</div>
            <div className="mt-4 space-y-3 text-sm text-white/75">
              <div className="flex items-center justify-between gap-4"><span>Total pool</span><span>{formatBtc(totalPoolBtc, 0)}</span></div>
              <div className="flex items-center justify-between gap-4"><span>Addresses</span><span>{totalAddresses}</span></div>
              <div className="flex items-center justify-between gap-4"><span>Lock start</span><span>{formatDate(lockStart)}</span></div>
              <div className="flex items-center justify-between gap-4"><span>Lock end</span><span>{formatDate(lockEnd)}</span></div>
              <div className="flex items-center justify-between gap-4"><span>Elapsed days</span><span>{elapsedDays}</span></div>
              <div className="flex items-center justify-between gap-4"><span>Remaining days</span><span>{remainingDays}</span></div>
              <div className="flex items-center justify-between gap-4"><span>Annual rate</span><span>{(APR * 100).toFixed(2)}%</span></div>
              <div className="flex items-center justify-between gap-4"><span>Reward model</span><span>Paid daily, compounding</span></div>
              <div className="flex items-center justify-between gap-4"><span>Top 10 hold</span><span>6.5%</span></div>
              <div className="flex items-center justify-between gap-4"><span>Top 100 hold</span><span>52.5%</span></div>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-4">
            <div className="text-xs uppercase tracking-[0.22em] text-white/50">Pinned Wallets</div>
            <h2 className="mt-2 text-xl font-semibold">Partridge Wealth SMSF — separate member balances</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {pinnedWallets.map((wallet) => (
              <button
                key={wallet.id}
                type="button"
                className="rounded-3xl border border-cyan-300/15 bg-gradient-to-br from-cyan-400/10 to-white/5 p-5 text-left transition hover:border-cyan-300/30 hover:bg-cyan-400/10"
              >
                <div className="text-sm text-white/55">Member: {wallet.member}</div>
                <div className="mt-2 text-lg font-semibold">{wallet.member} · {shortAddress(wallet.address)}</div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-white/45">Current balance</div>
                    <div className="mt-1 text-lg font-semibold">{formatBtc(wallet.btc)}</div>
                    <div className="text-sm text-white/60">{formatUsd(wallet.currentUsd)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-white/45">Accrued so far</div>
                    <div className="mt-1 text-lg font-semibold">{formatBtc(wallet.accruedBtc)}</div>
                    <div className="text-sm text-white/60">{formatUsd(wallet.accruedBtc * btcPrice)}</div>
                  </div>
                </div>
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/45">Projected release {formatDate(projectedReleaseDate)}</div>
                  <div className="mt-2 text-lg font-semibold">{formatBtc(wallet.projectedBtc)}</div>
                  <div className="text-sm text-white/60">{formatUsd(wallet.projectedUsd)}</div>
                </div>
                <div className="mt-4 text-sm text-cyan-200">Click to log in to member wallet</div>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-white/50">Top 20 Wallets — Live Allocation Table</div>
              <h2 className="mt-2 text-xl font-semibold">Live USD values move with BTC price. Non-member rows pulse visually.</h2>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2 text-sm">
              <thead>
                <tr className="text-left text-white/45">
                  <th className="px-3 py-2 font-medium">Rank</th>
                  <th className="px-3 py-2 font-medium">Address</th>
                  <th className="px-3 py-2 font-medium">BTC</th>
                  <th className="px-3 py-2 font-medium">USD Value</th>
                  <th className="px-3 py-2 font-medium">Pool Share</th>
                  <th className="px-3 py-2 font-medium">Live Flow</th>
                  <th className="px-3 py-2 font-medium">Flag</th>
                </tr>
              </thead>
              <tbody>
                {topWallets.map((wallet) => (
                  <tr key={wallet.address} className="rounded-2xl bg-black/20 text-white/85">
                    <td className="rounded-l-2xl px-3 py-3">{wallet.rank}</td>
                    <td className="px-3 py-3 font-mono text-xs sm:text-sm">{shortAddress(wallet.address)}</td>
                    <td className="px-3 py-3">{formatBtc(wallet.btc)}</td>
                    <td className="px-3 py-3">{formatUsd(wallet.usdValue)}</td>
                    <td className="px-3 py-3">{wallet.poolShare.toFixed(2)}%</td>
                    <td className={`px-3 py-3 ${wallet.flow >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                      {wallet.flow >= 0 ? "+" : ""}{(wallet.flow * 100).toFixed(2)}%
                    </td>
                    <td className="rounded-r-2xl px-3 py-3">{wallet.flag}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
