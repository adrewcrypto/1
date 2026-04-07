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
} from "recharts";

export default function Simulator() {
  const [btcPrice, setBtcPrice] = useState(0);
  const [data, setData] = useState<any[]>([]);

  const btcAmount = 3;
  const years = 3;
  const apy = 0.12;

  async function fetchPrice() {
    try {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
      );
      const json = await res.json();
      setBtcPrice(json.bitcoin.usd);
    } catch (err) {
      console.error("Error fetching BTC price:", err);
    }
  }

  useEffect(() => {
    fetchPrice();
    const interval = setInterval(fetchPrice, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!btcPrice) return;

    const arr = [];

    for (let i = 0; i <= years; i++) {
      const growth = Math.pow(1 + apy, i);
      const poolValue = btcAmount * btcPrice * growth;
      const holdValue = btcAmount * btcPrice * (1 + i * 0.25);

      arr.push({
        year: i,
        pool: poolValue,
        hold: holdValue,
      });
    }

    setData(arr);
  }, [btcPrice]);

  return (
    <div style={{ padding: 40 }}>
      <h1>BTC Liquidity Pool Simulator (3 BTC)</h1>
      <h2>Live BTC Price: ${btcPrice}</h2>

      <div style={{ marginTop: 30, width: "100%", height: 400 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="pool" stroke="#8884d8" />
            <Line type="monotone" dataKey="hold" stroke="#82ca9d" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}