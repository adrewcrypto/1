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
  LineChart,
  Line,
  Legend,
} from "recharts";

const BTC_POOL_TOTAL = 460;
const ADDRESS_COUNT = 500;
const PINNED_WHALE_BTC = 1.5;
const PINNED_COUNT = 2;
const LOCK_YEARS = 5;
const APY = 0.05;
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

const DAY_MS = 24 * 60 * 60 * 1000;
const LOCK_START_DATE = new Date("2026-04-01T00:00:00Z");
const LOCK_END_DATE = new Date("2031-04-01T00:00:00Z");
const TOTAL_LOCK_DAYS = Math.round(
  (LOCK_END_DATE.getTime() - LOCK_START_DATE.getTime()) / DAY_MS
);
const GENERIC_FIRST_PASSWORD = "000";

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
  return `${n.toFixed(8)} BTC`;
}

function btc4(n: number) {
  return `${n.toFixed(4)} BTC`;
}

function pct(n: number) {
  return `${n.toFixed(2)}%`;
}

function shortAddress(id: string) {
  return `${id.slice(0, 6)}...${id.slice(-4)}`;
}

function dateFmt(date: Date) {
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

type AllocationSeed = {
  id: string;
  btc: number;
  isPinned: boolean;
  ownerName: string;
};

type AddressRow = {
  id: string;
  ownerName: string;
  baseBtc: number;
  currentBtc: number;
  currentUsd: number;
  sharePct: number;
  flow: number;
  isPinned: boolean;
  currentRewardBtc: number;
  projectedRewardBtc: number;
  lockedBalanceBtc: number;
  projectedReleaseBtc: number;
};

type HistoryRow = {
  tick: string;
  btcPrice: number;
  poolUsd: number;
};

type ProjectionRow = {
  year: string;
  lockedValue: number;
  flatValue: number;
};

type MemberTx = {
  date: string;
  type: string;
  description: string;
  btcAmount: number;
  runningBtc: number;
};

type FySummary = {
  fyLabel: string;
  startDate: string;
  endDate: string;
  days: number;
  openingBtc: number;
  interestBtc: number;
  closingBtc: number;
};

type MemberAuth = {
  username: string;
  password: string;
};

type SelectedWalletState = {
  wallet: AddressRow;
  authenticated: boolean;
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

function generateAllocations(total: number, count: number): AllocationSeed[] {
  const pinnedTotal = PINNED_WHALE_BTC * PINNED_COUNT;
  const remaining = total - pinnedTotal;
  const variableCount = count - PINNED_COUNT;

  const weights = Array.from({ length: variableCount }, (_, i) => {
    const r = seededRandom(i + 11);
    return Math.pow(r + 0.02, 2.2);
  });

  const weightSum = weights.reduce((a, b) => a + b, 0);
  const variableAllocations = weights.map((w) => (w / weightSum) * remaining);

  const rows: AllocationSeed[] = [
    {
      id: makeHexAddress(1),
      btc: PINNED_WHALE_BTC,
      isPinned: true,
      ownerName: "Andrew",
    },
    {
      id: makeHexAddress(2),
      btc: PINNED_WHALE_BTC,
      isPinned: true,
      ownerName: "Ksenia",
    },
    ...variableAllocations.map((amt, idx) => ({
      id: makeHexAddress(idx + 3),
      btc: amt,
      isPinned: false,
      ownerName: "",
    })),
  ];

  return rows.sort((a, b) => b.btc - a.btc);
}

function maxDate(a: Date, b: Date) {
  return a.getTime() > b.getTime() ? a : b;
}

function minDate(a: Date, b: Date) {
  return a.getTime() < b.getTime() ? a : b;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

function daysBetween(start: Date, end: Date) {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / DAY_MS));
}

function getFyEndYear(date: Date) {
  const month = date.getUTCMonth() + 1;
  const year = date.getUTCFullYear();
  return month >= 7 ? year + 1 : year;
}

function getFyStart(endYear: number) {
  return new Date(Date.UTC(endYear - 1, 6, 1));
}

function getFyEnd(endYear: number) {
  return new Date(Date.UTC(endYear, 5, 30));
}

function compoundedBalance(principal: number, days: number) {
  return principal * Math.pow(1 + APY / 365, days);
}

function buildFySummaries(principal: number, elapsedDays: number): FySummary[] {
  const currentDate = addDays(LOCK_START_DATE, elapsedDays);
  const firstFy = getFyEndYear(LOCK_START_DATE);
  const lastFy = getFyEndYear(currentDate);

  const items: FySummary[] = [];

  for (let fy = firstFy; fy <= lastFy; fy++) {
    const fyStart = getFyStart(fy);
    const fyEnd = getFyEnd(fy);
    const activeStart = maxDate(fyStart, LOCK_START_DATE);
    const activeEndExclusive = minDate(addDays(fyEnd, 1), currentDate);
    const days = daysBetween(activeStart, activeEndExclusive);

    const openingDays = daysBetween(LOCK_START_DATE, activeStart);
    const endingDays = daysBetween(LOCK_START_DATE, activeEndExclusive);

    const openingBtc = compoundedBalance(principal, openingDays);
    const closingBtc = compoundedBalance(principal, endingDays);
    const interestBtc = closingBtc - openingBtc;

    if (days > 0 || fy === firstFy) {
      items.push({
        fyLabel: `FY${String(fy).slice(-2)}`,
        startDate: isoDate(activeStart),
        endDate: isoDate(addDays(activeEndExclusive, -1)),
        days,
        openingBtc,
        interestBtc,
        closingBtc,
      });
    }
  }

  return items;
}

function buildMemberTransactions(principal: number, elapsedDays: number): MemberTx[] {
  const checkpoints = Array.from(
    new Set(
      [1, 7, 30, 90, 180, 365, 730, 1095, 1460, 1826, elapsedDays].filter(
        (d) => d > 0 && d <= elapsedDays
      )
    )
  ).sort((a, b) => a - b);

  const tx: MemberTx[] = [
    {
      date: isoDate(LOCK_START_DATE),
      type: "Commencement",
      description: "Initial member contribution into BTC Fixed Yield Pool — 5Y Lock",
      btcAmount: principal,
      runningBtc: principal,
    },
  ];

  checkpoints.forEach((d, idx) => {
    const prevDays = idx === 0 ? 0 : checkpoints[idx - 1];
    const prevBalance = compoundedBalance(principal, prevDays);
    const newBalance = compoundedBalance(principal, d);
    const reward = newBalance - prevBalance;

    tx.push({
      date: isoDate(addDays(LOCK_START_DATE, d)),
      type: "Interest Allocation",
      description: `Compounded daily interest credited through day ${d}`,
      btcAmount: reward,
      runningBtc: newBalance,
    });
  });

  if (elapsedDays < TOTAL_LOCK_DAYS) {
    tx.push({
      date: isoDate(LOCK_END_DATE),
      type: "Projected Release",
      description: "Projected release balance on end of 5-year lock-up",
      btcAmount: compoundedBalance(principal, TOTAL_LOCK_DAYS),
      runningBtc: compoundedBalance(principal, TOTAL_LOCK_DAYS),
    });
  } else {
    tx.push({
      date: isoDate(LOCK_END_DATE),
      type: "Release Available",
      description: "Lock-up completed. Balance eligible for withdrawal.",
      btcAmount: compoundedBalance(principal, TOTAL_LOCK_DAYS),
      runningBtc: compoundedBalance(principal, TOTAL_LOCK_DAYS),
    });
  }

  return tx;
}

function openPrintablePdfReport(
  member: AddressRow,
  btcPrice: number,
  elapsedDays: number
) {
  const fy = buildFySummaries(member.baseBtc, elapsedDays);
  const tx = buildMemberTransactions(member.baseBtc, elapsedDays);
  const currentBalance = compoundedBalance(member.baseBtc, elapsedDays);
  const maturityBtc = compoundedBalance(member.baseBtc, TOTAL_LOCK_DAYS);
  const maturityUsd = maturityBtc * btcPrice;

  const html = `
  <html>
    <head>
      <title>${member.ownerName} - Member Statement PDF Report</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
        h1, h2, h3 { margin-bottom: 8px; }
        .muted { color: #475569; }
        .box { border: 1px solid #cbd5e1; border-radius: 12px; padding: 14px; margin-bottom: 16px; }
        table { border-collapse: collapse; width: 100%; margin-top: 10px; }
        th, td { border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: left; }
        th { background: #f8fafc; }
      </style>
    </head>
    <body>
      <h1>Partridge Wealth SMSF</h1>
      <div class="muted">Member statement and lock-up report</div>
      <div class="box">
        <h2>${member.ownerName}</h2>
        <div>Wallet: ${member.id}</div>
        <div>Principal: ${member.baseBtc.toFixed(8)} BTC</div>
        <div>Annual rate: ${(APY * 100).toFixed(2)}% compounded daily</div>
        <div>Lock start: ${dateFmt(LOCK_START_DATE)}</div>
        <div>Lock end: ${dateFmt(LOCK_END_DATE)}</div>
        <div>Elapsed days: ${elapsedDays}</div>
        <div>Current locked balance: ${currentBalance.toFixed(8)} BTC</div>
        <div>Projected release amount on 01.04.2031: ${maturityBtc.toFixed(8)} BTC (${usd2(maturityUsd)})</div>
      </div>

      <h3>Financial year summaries</h3>
      <table>
        <thead>
          <tr>
            <th>FY</th>
            <th>Start</th>
            <th>End</th>
            <th>Days</th>
            <th>Opening BTC</th>
            <th>Interest BTC</th>
            <th>Closing BTC</th>
          </tr>
        </thead>
        <tbody>
          ${fy
            .map(
              (r) => `
            <tr>
              <td>${r.fyLabel}</td>
              <td>${r.startDate}</td>
              <td>${r.endDate}</td>
              <td>${r.days}</td>
              <td>${r.openingBtc.toFixed(8)}</td>
              <td>${r.interestBtc.toFixed(8)}</td>
              <td>${r.closingBtc.toFixed(8)}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>

      <h3>Transaction history</h3>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Description</th>
            <th>BTC Amount</th>
            <th>Running BTC</th>
          </tr>
        </thead>
        <tbody>
          ${tx
            .map(
              (r) => `
            <tr>
              <td>${r.date}</td>
              <td>${r.type}</td>
              <td>${r.description}</td>
              <td>${r.btcAmount.toFixed(8)}</td>
              <td>${r.runningBtc.toFixed(8)}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>

      <h3>Risk disclosure</h3>
      <div class="box">
        <div>• This is a fixed-term digital asset allocation under a 5-year lock-up.</div>
        <div>• Early withdrawal is not permitted prior to the contractual end date (01.04.2031).</div>
        <div>• Interest is compounded daily at a fixed 5% annual rate.</div>
        <div>• Interest is added to the member’s BTC-denominated balance; withdrawals are not permitted during the lock period.</div>
        <div>• BTC price volatility does not affect BTC-denominated returns; USD valuations are indicative only.</div>
      </div>

      <script>window.onload = () => window.print();</script>
    </body>
  </html>`;

  const newWindow = window.open("", "_blank");
  if (newWindow) {
    newWindow.document.open();
    newWindow.document.write(html);
    newWindow.document.close();
  }
}

export default function Page() {
  const [btcPrice, setBtcPrice] = useState(68000);
  const [btcChange24h, setBtcChange24h] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pulse, setPulse] = useState(0);
  const [allocations] = useState(() =>
    generateAllocations(BTC_POOL_TOTAL, ADDRESS_COUNT)
  );
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [selectedPinnedWallet, setSelectedPinnedWallet] =
    useState<SelectedWalletState | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [settingsCurrentPassword, setSettingsCurrentPassword] = useState("");
  const [settingsNewPassword, setSettingsNewPassword] = useState("");
  const [settingsConfirmPassword, setSettingsConfirmPassword] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [authStore, setAuthStore] = useState<Record<string, MemberAuth>>({
    Andrew: { username: "Andrew", password: GENERIC_FIRST_PASSWORD },
    Ksenia: { username: "Ksenia", password: GENERIC_FIRST_PASSWORD },
  });

  useEffect(() => {
    let lastGoodPrice = 68000;

    async function fetchPrice() {
      try {
        const res = await fetch(LIVE_PRICE_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        const price = Number(json?.bitcoin?.usd);
        const change = Number(json?.bitcoin?.usd_24h_change);

        if (!price || Number.isNaN(price)) {
          throw new Error("Invalid BTC price");
        }

        lastGoodPrice = price;
        setBtcPrice(price);
        setBtcChange24h(Number.isNaN(change) ? 0 : change);
        setError("");
      } catch {
        setBtcPrice(lastGoodPrice);
        setError("Using fallback BTC price. Live API temporarily unavailable.");
      } finally {
        setLoading(false);
      }
    }

    fetchPrice();

    const priceInterval = setInterval(fetchPrice, 30000);
    const pulseInterval = setInterval(() => setPulse((p) => p + 1), 1200);

    return () => {
      clearInterval(priceInterval);
      clearInterval(pulseInterval);
    };
  }, []);

  const elapsedDays = useMemo(() => {
    const now = Date.now();
    const raw = Math.floor((now - LOCK_START_DATE.getTime()) / DAY_MS);
    return Math.max(0, Math.min(raw, TOTAL_LOCK_DAYS));
  }, [pulse]);

  const remainingDays = Math.max(TOTAL_LOCK_DAYS - elapsedDays, 0);

  const liveRows: AddressRow[] = useMemo(() => {
    const basePrice = btcPrice > 0 ? btcPrice : 68000;

    return allocations.map((row, idx) => {
      const wave = Math.sin((pulse + idx) * 0.22) * 0.0075;
      const wave2 = Math.cos((pulse + idx * 2) * 0.11) * 0.004;
      const principalLike = row.isPinned ? row.btc : row.btc * (1 + wave + wave2);

      const lockedBalanceBtc = compoundedBalance(principalLike, elapsedDays);
      const projectedReleaseBtc = compoundedBalance(principalLike, TOTAL_LOCK_DAYS);
      const currentRewardBtc = lockedBalanceBtc - principalLike;
      const projectedRewardBtc = projectedReleaseBtc - principalLike;

      return {
        id: row.id,
        ownerName: row.ownerName,
        baseBtc: row.btc,
        currentBtc: lockedBalanceBtc,
        currentUsd: lockedBalanceBtc * basePrice,
        sharePct: (lockedBalanceBtc / BTC_POOL_TOTAL) * 100,
        flow: row.isPinned ? 0 : (wave + wave2) * 100,
        isPinned: row.isPinned,
        currentRewardBtc,
        projectedRewardBtc,
        lockedBalanceBtc,
        projectedReleaseBtc,
      };
    });
  }, [allocations, btcPrice, pulse, elapsedDays]);

  const poolUsd = liveRows.reduce((sum, r) => sum + r.currentUsd, 0);
  const lockedMaturityBtc = allocations.reduce(
    (sum, row) => sum + compoundedBalance(row.btc, TOTAL_LOCK_DAYS),
    0
  );
  const lockedMaturityUsd =
    lockedMaturityBtc * (btcPrice > 0 ? btcPrice : 68000);
  const accruedRewardBtcTotal = liveRows.reduce(
    (sum, r) => sum + r.currentRewardBtc,
    0
  );
  const accruedRewardUsdTotal =
    accruedRewardBtcTotal * (btcPrice > 0 ? btcPrice : 68000);
  const avgBtc = BTC_POOL_TOTAL / ADDRESS_COUNT;

  const top20 = useMemo(() => liveRows.slice(0, 20), [liveRows]);
  const pinned = useMemo(() => liveRows.filter((r) => r.isPinned), [liveRows]);

  const concentration = useMemo(() => {
    const top10Share =
      liveRows.slice(0, 10).reduce((sum, r) => sum + r.currentBtc, 0) /
      liveRows.reduce((sum, r) => sum + r.currentBtc, 0);
    const top100Share =
      liveRows.slice(0, 100).reduce((sum, r) => sum + r.currentBtc, 0) /
      liveRows.reduce((sum, r) => sum + r.currentBtc, 0);
    return { top10Share, top100Share };
  }, [liveRows]);

  const pieData = useMemo(() => {
    const top5 = liveRows.slice(0, 5).map((r, i) => ({
      name: r.isPinned ? r.ownerName : `Addr ${i + 1}`,
      value: r.currentBtc,
    }));
    const totalLive = liveRows.reduce((sum, r) => sum + r.currentBtc, 0);
    const rest = totalLive - top5.reduce((s, x) => s + x.value, 0);
    return [...top5, { name: "Other 495", value: rest }];
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
      count: liveRows.filter(
        (r) => r.baseBtc >= range.min && r.baseBtc < range.max
      ).length,
    }));
  }, [liveRows]);

  const projectionData: ProjectionRow[] = useMemo(() => {
    return Array.from({ length: LOCK_YEARS + 1 }, (_, i) => {
      const days = i * 365;
      const projectedBtc = allocations.reduce(
        (sum, row) => sum + compoundedBalance(row.btc, days),
        0
      );
      return {
        year: `Y${i}`,
        lockedValue: projectedBtc * (btcPrice > 0 ? btcPrice : 68000),
        flatValue: BTC_POOL_TOTAL * (btcPrice > 0 ? btcPrice : 68000),
      };
    });
  }, [allocations, btcPrice]);

  useEffect(() => {
    const next: HistoryRow = {
      tick: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      btcPrice: btcPrice > 0 ? btcPrice : 68000,
      poolUsd,
    };

    setHistory((prev) => [...prev.slice(-29), next]);
  }, [pulse, btcPrice, poolUsd]);

  const selectedWalletDetails = selectedPinnedWallet
    ? liveRows.find((row) => row.id === selectedPinnedWallet.wallet.id) ||
      selectedPinnedWallet.wallet
    : null;

  function openLogin(wallet: AddressRow) {
    setSelectedPinnedWallet({ wallet, authenticated: false });
    setLoginUsername(wallet.ownerName);
    setLoginPassword("");
    setLoginError("");
    setShowSettings(false);
    setSettingsMessage("");
  }

  function handleLogin() {
    if (!selectedPinnedWallet) return;
    const owner = selectedPinnedWallet.wallet.ownerName;
    const record = authStore[owner];

    if (
      loginUsername.trim() === record?.username &&
      loginPassword === record?.password
    ) {
      setSelectedPinnedWallet({
        wallet: selectedPinnedWallet.wallet,
        authenticated: true,
      });
      setLoginError("");
      setShowSettings(false);
    } else {
      setLoginError("Invalid username or password.");
    }
  }

  function handleChangePassword() {
    if (!selectedWalletDetails) return;
    const owner = selectedWalletDetails.ownerName;
    const record = authStore[owner];

    if (settingsCurrentPassword !== record.password) {
      setSettingsMessage("Current password is incorrect.");
      return;
    }
    if (!settingsNewPassword || settingsNewPassword.length < 3) {
      setSettingsMessage("New password must be at least 3 characters.");
      return;
    }
    if (settingsNewPassword !== settingsConfirmPassword) {
      setSettingsMessage("New password and confirmation do not match.");
      return;
    }

    setAuthStore((prev) => ({
      ...prev,
      [owner]: {
        ...prev[owner],
        password: settingsNewPassword,
      },
    }));
    setSettingsCurrentPassword("");
    setSettingsNewPassword("");
    setSettingsConfirmPassword("");
    setSettingsMessage("Password updated successfully.");
  }

  if (selectedPinnedWallet && !selectedPinnedWallet.authenticated) {
    const wallet = selectedPinnedWallet.wallet;
    return (
      <div
        style={{
          minHeight: "100vh",
          background:
            "radial-gradient(circle at top left, #1e293b 0%, #0f172a 35%, #020617 100%)",
          color: "#e2e8f0",
          padding: 24,
          fontFamily: "Arial, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ width: "100%", maxWidth: 480, ...panelStyle }}>
          <button
            onClick={() => setSelectedPinnedWallet(null)}
            style={{
              marginBottom: 18,
              background: "rgba(59,130,246,0.16)",
              color: "#dbeafe",
              border: "1px solid rgba(59,130,246,0.32)",
              borderRadius: 14,
              padding: "10px 16px",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            ← Back
          </button>

          <div style={{ color: "#94a3b8", fontSize: 13 }}>Member login</div>
          <h1 style={{ margin: "8px 0 6px", fontSize: 32 }}>{wallet.ownerName}</h1>
          <div style={{ color: "#cbd5e1", marginBottom: 18 }}>
            First login uses username <strong>{wallet.ownerName}</strong> and generic
            password <strong>{GENERIC_FIRST_PASSWORD}</strong>.
          </div>

          <label style={labelStyle}>Username</label>
          <input
            value={loginUsername}
            onChange={(e) => setLoginUsername(e.target.value)}
            style={inputStyle}
          />

          <label style={labelStyle}>Password</label>
          <input
            type="password"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            style={inputStyle}
          />

          {loginError && (
            <div
              style={{
                marginBottom: 12,
                background: "rgba(239,68,68,0.12)",
                border: "1px solid rgba(239,68,68,0.35)",
                color: "#fecaca",
                padding: 12,
                borderRadius: 14,
              }}
            >
              {loginError}
            </div>
          )}

          <button onClick={handleLogin} style={primaryButtonStyle}>
            Log in
          </button>
        </div>
      </div>
    );
  }

  if (selectedWalletDetails && selectedPinnedWallet?.authenticated) {
    const lockedValueUsd =
      selectedWalletDetails.lockedBalanceBtc *
      (btcPrice > 0 ? btcPrice : 68000);
    const maturityBalanceBtc = selectedWalletDetails.projectedReleaseBtc;
    const maturityValueUsd =
      maturityBalanceBtc * (btcPrice > 0 ? btcPrice : 68000);
    const txHistory = buildMemberTransactions(
      selectedWalletDetails.baseBtc,
      elapsedDays
    );
    const fySummary = buildFySummaries(
      selectedWalletDetails.baseBtc,
      elapsedDays
    );

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
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <button
            onClick={() => {
              setSelectedPinnedWallet(null);
              setWithdrawAmount("");
              setShowSettings(false);
              setSettingsMessage("");
            }}
            style={{
              marginBottom: 18,
              background: "rgba(59,130,246,0.16)",
              color: "#dbeafe",
              border: "1px solid rgba(59,130,246,0.32)",
              borderRadius: 14,
              padding: "10px 16px",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            ← Back to main dashboard
          </button>

          <div style={panelStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ color: "#94a3b8", fontSize: 13 }}>
                  Partridge Wealth SMSF — separate member balance
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <h1 style={{ margin: "8px 0 6px", fontSize: 34 }}>
                    {selectedWalletDetails.ownerName}
                  </h1>
                  <button
                    onClick={() => {
                      setShowSettings((v) => !v);
                      setSettingsMessage("");
                    }}
                    style={{
                      background: "rgba(148,163,184,0.12)",
                      color: "#e2e8f0",
                      border: "1px solid rgba(148,163,184,0.22)",
                      borderRadius: 12,
                      padding: "8px 12px",
                      cursor: "pointer",
                      fontWeight: 700,
                    }}
                  >
                    ⚙ Settings
                  </button>
                </div>
                <div style={{ color: "#cbd5e1" }}>
                  {shortAddress(selectedWalletDetails.id)} · Locked until{" "}
                  {dateFmt(LOCK_END_DATE)}
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: 999,
                    background: "rgba(245,158,11,0.12)",
                    border: "1px solid rgba(245,158,11,0.35)",
                    color: "#fde68a",
                    fontWeight: 800,
                  }}
                >
                  LOCKED UNTIL 01.04.2031
                </div>
                <button
                  onClick={() =>
                    openPrintablePdfReport(
                      selectedWalletDetails,
                      btcPrice > 0 ? btcPrice : 68000,
                      elapsedDays
                    )
                  }
                  style={{
                    background: "rgba(34,197,94,0.16)",
                    color: "#dcfce7",
                    border: "1px solid rgba(34,197,94,0.35)",
                    borderRadius: 14,
                    padding: "10px 16px",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Generate PDF report
                </button>
              </div>
            </div>

            {showSettings && (
              <div
                style={{
                  marginTop: 18,
                  paddingTop: 18,
                  borderTop: "1px solid rgba(148,163,184,0.16)",
                }}
              >
                <div style={panelTitle}>Security settings</div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: 12,
                  }}
                >
                  <div>
                    <label style={labelStyle}>Current password</label>
                    <input
                      type="password"
                      value={settingsCurrentPassword}
                      onChange={(e) => setSettingsCurrentPassword(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>New password</label>
                    <input
                      type="password"
                      value={settingsNewPassword}
                      onChange={(e) => setSettingsNewPassword(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Confirm new password</label>
                    <input
                      type="password"
                      value={settingsConfirmPassword}
                      onChange={(e) => setSettingsConfirmPassword(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                    marginTop: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <button onClick={handleChangePassword} style={primaryButtonStyle}>
                    Update password
                  </button>
                  {settingsMessage && (
                    <div
                      style={{
                        color: settingsMessage.includes("success")
                          ? "#86efac"
                          : "#fca5a5",
                      }}
                    >
                      {settingsMessage}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 16,
              marginTop: 18,
            }}
          >
            {[
              {
                label: "Principal",
                value: btc4(selectedWalletDetails.baseBtc),
                sub: usd2(selectedWalletDetails.baseBtc * btcPrice),
              },
              {
                label: "Current Reward",
                value: btc(selectedWalletDetails.currentRewardBtc),
                sub: "Compounded daily",
              },
              {
                label: "Current Locked Balance",
                value: btc4(selectedWalletDetails.lockedBalanceBtc),
                sub: usd2(lockedValueUsd),
              },
              {
                label: "Projected Release 01.04.2031",
                value: btc4(maturityBalanceBtc),
                sub: usd2(maturityValueUsd),
              },
            ].map((card) => (
              <div key={card.label} style={panelStyle}>
                <div style={{ color: "#94a3b8", fontSize: 13 }}>{card.label}</div>
                <div style={{ fontSize: 26, fontWeight: 800, marginTop: 8 }}>
                  {card.value}
                </div>
                <div style={{ color: "#cbd5e1", fontSize: 13, marginTop: 8 }}>
                  {card.sub}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 1fr",
              gap: 18,
              marginTop: 18,
            }}
          >
            <div style={panelStyle}>
              <div style={panelTitle}>Withdrawal</div>
              <div
                style={{
                  marginBottom: 16,
                  background: "rgba(245,158,11,0.12)",
                  border: "1px solid rgba(245,158,11,0.3)",
                  color: "#fde68a",
                  padding: 14,
                  borderRadius: 16,
                  lineHeight: 1.6,
                }}
              >
                Withdrawal is disabled. This member balance is in lock-up until{" "}
                {dateFmt(LOCK_END_DATE)}. Rewards are compounded daily but cannot be
                withdrawn before maturity.
              </div>

              <label
                style={{
                  display: "block",
                  color: "#94a3b8",
                  fontSize: 13,
                  marginBottom: 8,
                }}
              >
                Withdrawal amount (BTC)
              </label>
              <input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                disabled
                placeholder="Enter BTC amount"
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: 14,
                  border: "1px solid rgba(148,163,184,0.14)",
                  background: "rgba(148,163,184,0.08)",
                  color: "#64748b",
                  marginBottom: 14,
                  cursor: "not-allowed",
                }}
              />
              <button
                disabled
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: 14,
                  border: "1px solid rgba(148,163,184,0.18)",
                  background: "rgba(148,163,184,0.1)",
                  color: "#94a3b8",
                  cursor: "not-allowed",
                  fontWeight: 700,
                }}
              >
                Withdraw disabled during lock-up
              </button>
            </div>

            <div style={panelStyle}>
              <div style={panelTitle}>Member statement panel</div>
              <div style={{ color: "#d7defd", lineHeight: 1.9 }}>
                Member: <strong>{selectedWalletDetails.ownerName}</strong>
                <br />
                Commencement date: <strong>{dateFmt(LOCK_START_DATE)}</strong>
                <br />
                Lock end: <strong>{dateFmt(LOCK_END_DATE)}</strong>
                <br />
                Elapsed days: <strong>{elapsedDays}</strong>
                <br />
                Remaining days: <strong>{remainingDays}</strong>
                <br />
                Rate model: <strong>5% annual, compounded daily</strong>
                <br />
                Projected release amount:{" "}
                <strong>{btc(selectedWalletDetails.projectedReleaseBtc)}</strong>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 18,
              marginTop: 18,
            }}
          >
            <div style={panelStyle}>
              <div style={panelTitle}>Financial year summaries</div>
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}
                >
                  <thead>
                    <tr>
                      {[
                        "FY",
                        "Start",
                        "End",
                        "Days",
                        "Opening BTC",
                        "Interest BTC",
                        "Closing BTC",
                      ].map((head) => (
                        <th key={head} style={thStyle}>
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fySummary.map((row) => (
                      <tr key={row.fyLabel}>
                        <td style={tdStyle}>{row.fyLabel}</td>
                        <td style={tdStyle}>{row.startDate}</td>
                        <td style={tdStyle}>{row.endDate}</td>
                        <td style={tdStyle}>{row.days}</td>
                        <td style={tdStyle}>{btc(row.openingBtc)}</td>
                        <td style={tdStyle}>{btc(row.interestBtc)}</td>
                        <td style={tdStyle}>{btc(row.closingBtc)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={panelStyle}>
              <div style={panelTitle}>Transaction history</div>
              <div style={{ overflowX: "auto", maxHeight: 420 }}>
                <table
                  style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}
                >
                  <thead>
                    <tr>
                      {[
                        "Date",
                        "Type",
                        "Description",
                        "BTC Amount",
                        "Running BTC",
                      ].map((head) => (
                        <th key={head} style={thStyle}>
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {txHistory.map((row, idx) => (
                      <tr key={`${row.date}-${idx}`}>
                        <td style={tdStyle}>{row.date}</td>
                        <td style={tdStyle}>{row.type}</td>
                        <td style={tdStyle}>{row.description}</td>
                        <td style={tdStyle}>{btc(row.btcAmount)}</td>
                        <td style={tdStyle}>{btc(row.runningBtc)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                background: "rgba(34,197,94,0.12)",
                border: "1px solid rgba(34,197,94,0.35)",
                padding: "8px 14px",
                borderRadius: 999,
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: "#22c55e",
                  boxShadow: "0 0 18px #22c55e",
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 700 }}>
                LIVE STAKING PANEL
              </span>
            </div>
            <h1 style={{ margin: "14px 0 8px", fontSize: 42, lineHeight: 1.05 }}>
              BTC Fixed Yield Pool — 5Y Lock
            </h1>
            <div
              style={{
                color: "#facc15",
                fontSize: 16,
                maxWidth: 920,
                fontWeight: 800,
              }}
            >
              Subscription closed
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#94a3b8", fontSize: 13 }}>Feed source</div>
            <div style={{ fontWeight: 700 }}>
              {loading ? "Loading..." : "CoinGecko BTC/USD"}
            </div>
            <div
              style={{
                color: btcChange24h >= 0 ? "#22c55e" : "#ef4444",
                fontWeight: 700,
                marginTop: 6,
              }}
            >
              24h BTC {btcChange24h >= 0 ? "+" : ""}
              {pct(btcChange24h)}
            </div>
          </div>
        </div>

        {error && (
          <div
            style={{
              marginTop: 18,
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.35)",
              padding: 14,
              borderRadius: 16,
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
            gap: 16,
            marginTop: 22,
          }}
        >
          {[
            {
              label: "BTC Price",
              value: usd2(btcPrice),
              sub: loading ? "Loading..." : "Live",
            },
            {
              label: "Pool Size",
              value: `${BTC_POOL_TOTAL} BTC`,
              sub: usd(poolUsd),
            },
            {
              label: "Addresses",
              value: `${ADDRESS_COUNT}`,
              sub: `Avg ${btc4(avgBtc)}`,
            },
            {
              label: "Accrued Rewards",
              value: btc4(accruedRewardBtcTotal),
              sub: usd(accruedRewardUsdTotal),
            },
            {
              label: "Projected Release 01.04.2031",
              value: usd(lockedMaturityUsd),
              sub: `APY ${pct(APY * 100)}`,
            },
          ].map((card, idx) => (
            <div
              key={card.label}
              style={{
                borderRadius: 24,
                padding: 18,
                background: `linear-gradient(135deg, ${
                  idx % 2 === 0
                    ? "rgba(30,41,59,0.96)"
                    : "rgba(15,23,42,0.96)"
                } 0%, rgba(30,41,59,0.75) 100%)`,
                border: "1px solid rgba(148,163,184,0.18)",
                boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
              }}
            >
              <div style={{ color: "#94a3b8", fontSize: 13 }}>{card.label}</div>
              <div style={{ fontSize: 30, fontWeight: 800, marginTop: 8 }}>
                {card.value}
              </div>
              <div style={{ color: "#cbd5e1", fontSize: 13, marginTop: 8 }}>
                {card.sub}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.5fr 1fr",
            gap: 18,
            marginTop: 22,
          }}
        >
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
                    <linearGradient
                      id="priceGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.55} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="rgba(148,163,184,0.15)"
                    strokeDasharray="3 3"
                  />
                  <XAxis dataKey="tick" stroke="#94a3b8" minTickGap={20} />
                  <YAxis
                    yAxisId="left"
                    stroke="#94a3b8"
                    tickFormatter={(v) => `$${Math.round(v / 1000000)}m`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#94a3b8"
                    tickFormatter={(v) => `$${Math.round(v / 1000)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#0f172a",
                      border: "1px solid rgba(148,163,184,0.22)",
                      borderRadius: 14,
                      color: "#e2e8f0",
                    }}
                    itemStyle={{ color: "#e2e8f0" }}
                    labelStyle={{ color: "#e2e8f0" }}
                    formatter={(value: any, name: any) => [
                      name === "poolUsd" ? usd(Number(value)) : usd2(Number(value)),
                      name === "poolUsd" ? "Pool USD" : "BTC Price",
                    ]}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="poolUsd"
                    stroke="#22c55e"
                    fill="url(#poolGradient)"
                    strokeWidth={2.5}
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="btcPrice"
                    stroke="#3b82f6"
                    fill="url(#priceGradient)"
                    strokeWidth={2.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={panelStyle}>
            <div style={panelTitle}>Wallet Concentration</div>
            <div style={{ width: "100%", height: 330 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={70}
                    outerRadius={115}
                    paddingAngle={3}
                  >
                    {pieData.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "#0f172a",
                      border: "1px solid rgba(148,163,184,0.22)",
                      borderRadius: 14,
                      color: "#e2e8f0",
                    }}
                    itemStyle={{ color: "#e2e8f0" }}
                    labelStyle={{ color: "#e2e8f0" }}
                    formatter={(value: any, name: any) => [btc(Number(value)), name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 18,
            marginTop: 18,
          }}
        >
          <div style={panelStyle}>
            <div style={panelTitle}>5-Year Lock Projection</div>
            <div style={{ width: "100%", height: 290 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={projectionData}>
                  <CartesianGrid
                    stroke="rgba(148,163,184,0.15)"
                    strokeDasharray="3 3"
                  />
                  <XAxis dataKey="year" stroke="#94a3b8" />
                  <YAxis
                    stroke="#94a3b8"
                    tickFormatter={(v) => `$${Math.round(v / 1000000)}m`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#0f172a",
                      border: "1px solid rgba(148,163,184,0.22)",
                      borderRadius: 14,
                      color: "#e2e8f0",
                    }}
                    itemStyle={{ color: "#e2e8f0" }}
                    labelStyle={{ color: "#e2e8f0" }}
                    formatter={(value: any) => usd(Number(value))}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="lockedValue"
                    name="Locked @ 5% compounded daily"
                    stroke="#22c55e"
                    strokeWidth={3}
                  />
                  <Line
                    type="monotone"
                    dataKey="flatValue"
                    name="Flat USD Value"
                    stroke="#3b82f6"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={panelStyle}>
            <div style={panelTitle}>Address Size Distribution</div>
            <div style={{ width: "100%", height: 290 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={buckets}>
                  <CartesianGrid
                    stroke="rgba(148,163,184,0.15)"
                    strokeDasharray="3 3"
                  />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{
                      background: "#0f172a",
                      border: "1px solid rgba(148,163,184,0.22)",
                      borderRadius: 14,
                      color: "#e2e8f0",
                    }}
                    itemStyle={{ color: "#e2e8f0" }}
                    labelStyle={{ color: "#e2e8f0" }}
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
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 18,
            marginTop: 18,
          }}
        >
          <div style={panelStyle}>
            <div style={panelTitle}>Pinned Wallets</div>
            <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 12 }}>
              Partridge Wealth SMSF — separate member balances
            </div>
            <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
              {pinned.map((row, idx) => {
                const maturityValueUsd =
                  row.projectedReleaseBtc * (btcPrice > 0 ? btcPrice : 68000);

                return (
                  <button
                    key={row.id}
                    onClick={() => openLogin(row)}
                    style={{
                      textAlign: "left",
                      borderRadius: 20,
                      padding: 16,
                      background: `linear-gradient(135deg, rgba(${
                        idx === 0 ? "34,197,94" : "59,130,246"
                      },0.18), rgba(15,23,42,0.65))`,
                      border: "1px solid rgba(148,163,184,0.18)",
                      cursor: "pointer",
                      color: "#e2e8f0",
                    }}
                  >
                    <div style={{ fontSize: 13, color: "#cbd5e1" }}>
                      Member: {row.ownerName}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, marginTop: 6 }}>
                      {row.ownerName} · {shortAddress(row.id)}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginTop: 10,
                      }}
                    >
                      <span>{btc4(row.lockedBalanceBtc)}</span>
                      <span>{usd2(row.currentUsd)}</span>
                    </div>
                    <div style={{ color: "#cbd5e1", marginTop: 8, fontSize: 13 }}>
                      Projected release 01.04.2031: {usd(maturityValueUsd)}
                    </div>
                    <div
                      style={{
                        color: "#93c5fd",
                        marginTop: 8,
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      Click to log in to member wallet
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={panelStyle}>
            <div style={panelTitle}>Pool Lock Rules</div>
            <div style={{ color: "#d7defd", lineHeight: 1.8 }}>
              Total pool: <strong>{BTC_POOL_TOTAL} BTC</strong>
              <br />
              Addresses: <strong>{ADDRESS_COUNT}</strong>
              <br />
              Lock start: <strong>01.04.2026</strong>
              <br />
              Lock end: <strong>01.04.2031</strong>
              <br />
              Remaining days: <strong>{remainingDays}</strong>
              <br />
              Annual rate: <strong>{pct(APY * 100)}</strong>
              <br />
              Reward model: <strong>compounded daily</strong>
              <br />
              Partridge Wealth SMSF members:{" "}
              <strong>Andrew 1.5 BTC · Ksenia 1.5 BTC</strong>
              <br />
              Top 10 hold{" "}
              <strong>{(concentration.top10Share * 100).toFixed(1)}%</strong>
              <br />
              Top 100 hold{" "}
              <strong>{(concentration.top100Share * 100).toFixed(1)}%</strong>
            </div>
          </div>
        </div>

        <div style={{ ...panelStyle, marginTop: 18 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div style={panelTitle}>Top 20 Wallets — Live Allocation Table</div>
            <div style={{ color: "#94a3b8", fontSize: 13 }}>
              Live USD values move with BTC price. Non-member rows pulse visually.
            </div>
          </div>
          <div style={{ overflowX: "auto", marginTop: 14 }}>
            <table
              style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}
            >
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
                    <th key={head} style={thStyle}>
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {top20.map((row, idx) => (
                  <tr
                    key={row.id}
                    style={{
                      background:
                        idx % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
                    }}
                  >
                    <td style={tdStyle}>{idx + 1}</td>
                    <td style={tdStyle}>
                      {row.isPinned
                        ? `${row.ownerName} · ${shortAddress(row.id)}`
                        : shortAddress(row.id)}
                    </td>
                    <td style={tdStyle}>{btc4(row.currentBtc)}</td>
                    <td style={tdStyle}>{usd2(row.currentUsd)}</td>
                    <td style={tdStyle}>{pct(row.sharePct)}</td>
                    <td
                      style={{
                        ...tdStyle,
                        color: row.isPinned
                          ? "#94a3b8"
                          : row.flow >= 0
                          ? "#22c55e"
                          : "#ef4444",
                        fontWeight: 700,
                      }}
                    >
                      {row.isPinned
                        ? "0.00%"
                        : `${row.flow >= 0 ? "+" : ""}${pct(row.flow)}`}
                    </td>
                    <td style={tdStyle}>
                      {row.isPinned ? "SMSF Member 1.5 BTC" : idx < 10 ? "Whale" : "Standard"}
                    </td>
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

const labelStyle: React.CSSProperties = {
  display: "block",
  color: "#94a3b8",
  fontSize: 13,
  marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: 14,
  border: "1px solid rgba(148,163,184,0.16)",
  background: "rgba(15,23,42,0.65)",
  color: "#e2e8f0",
  marginBottom: 14,
  outline: "none",
};

const primaryButtonStyle: React.CSSProperties = {
  background: "rgba(34,197,94,0.18)",
  color: "#dcfce7",
  border: "1px solid rgba(34,197,94,0.35)",
  borderRadius: 14,
  padding: "12px 16px",
  cursor: "pointer",
  fontWeight: 700,
};
