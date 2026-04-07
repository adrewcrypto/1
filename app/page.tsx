"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";

type Row = {
  year: number;
  Hold: number;
  LP: number;
};

export default function Page() {
  const [btcPrice, setBtcPrice] = useState(0);

  const initialBTC = 3;
  const years = [0, 1, 2, 3];
  const assumedAPY = 0.12; // 12% LP fee/yield assumption

  useEffect(() => {
    async function fetchPrice() {
      try {
        const res = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
        );
        const data = await res.json();
        setBtcPrice(data.bitcoin.usd);
      } catch (error) {
        console.error("Failed to fetch BTC price:", error);
      }
    }

    fetchPrice();
    const interval = setInterval(fetchPrice, 10000);
    return () => clearInterval(interval);
  }, []);

  function simulate(): Row[] {
    if (!btcPrice) return [];

    return years.map((year) => {
      const priceRatio = 1 + year * 0.25; // example: BTC rises 25% per year
      const holdValue = initialBTC * btcPrice * priceRatio;

      // Impermanent loss formula for a 50/50 LP
      const il = (2 * Math.sqrt(priceRatio)) / (1 + priceRatio) - 1;

      const startingValue = initialBTC * btcPrice;
      const lpWithFees = startingValue * Math.pow(1 + assumedAPY, year);
      const lpFinal = lpWithFees * (1 + il);

      return {
        year,
        Hold: Math.round(holdValue),
        LP: Math.round(lpFinal),
      };
    });
  }

  const data = simulate();

  return (
    <div style={{ padding: 20, fontFamily: "Arial, sans-serif" }}>
      <h1>BTC LP Simulator (Uniswap-style 50/50 model)</h1>
      <p style={{ fontSize: 20, fontWeight: 700 }}>
        Live BTC Price: ${btcPrice || 0}
      </p>

      <div style={{ width: "100%", height: 420, marginTop: 20 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="Hold" stroke="#8884d8" />
            <Line type="monotone" dataKey="LP" stroke="#82ca9d" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ marginTop: 24, lineHeight: 1.7 }}>
        <strong>Model assumptions:</strong>
        <br />
        • Starting position: 3 BTC
        <br />
        • LP type: 50/50 BTC-stable style pool
        <br />
        • LP yield assumption: 12% annually
        <br />
        • Includes impermanent loss
        <br />
        • BTC growth assumption in this example: 25% per year
      </div>
    </div>
  );
}
