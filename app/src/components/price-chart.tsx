"use client";

import { useEffect, useRef } from "react";
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickData, Time, LineSeries, CandlestickSeries, HistogramSeries } from "lightweight-charts";

interface OHLCV {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change_pct?: number;
}

interface Props {
  data: OHLCV[];
  type?: "candlestick" | "line";
  height?: number;
  showVolume?: boolean;
}

export function PriceChart({ data, type = "candlestick", height = 320, showVolume = true }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "#FFFFFF" },
        textColor: "#78716C",
        fontFamily: "var(--font-body), system-ui, sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#F5F5F4" },
        horzLines: { color: "#F5F5F4" },
      },
      rightPriceScale: {
        borderColor: "#E7E5E4",
        scaleMargins: { top: 0.05, bottom: showVolume ? 0.25 : 0.05 },
      },
      timeScale: {
        borderColor: "#E7E5E4",
        timeVisible: false,
      },
      crosshair: {
        mode: 1,
      },
      autoSize: true,
    });

    chartRef.current = chart;

    const rows = data
      .map((d) => ({
        time: d.date as Time,
        open: Number(d.open),
        high: Number(d.high),
        low: Number(d.low),
        close: Number(d.close),
        volume: Number(d.volume),
      }))
      .filter((d) => !isNaN(d.close))
      .sort((a, b) => String(a.time).localeCompare(String(b.time)));

    if (type === "candlestick") {
      const series: ISeriesApi<"Candlestick"> = chart.addSeries(CandlestickSeries, {
        upColor: "#16A34A",
        downColor: "#DC2626",
        borderUpColor: "#16A34A",
        borderDownColor: "#DC2626",
        wickUpColor: "#16A34A",
        wickDownColor: "#DC2626",
      });
      series.setData(rows as CandlestickData[]);
    } else {
      const lineSeries = chart.addSeries(LineSeries, {
        color: "#0066CC",
        lineWidth: 2,
      });
      lineSeries.setData(rows.map((r) => ({ time: r.time, value: r.close })));
    }

    if (showVolume) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: "volume" },
        priceScaleId: "",
        color: "#E7E5E4",
      });
      volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });
      volumeSeries.setData(
        rows.map((r, i) => ({
          time: r.time,
          value: r.volume,
          color:
            i > 0 && r.close >= rows[i - 1].close
              ? "rgba(22,163,74,0.35)"
              : "rgba(220,38,38,0.35)",
        }))
      );
    }

    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [data, type, height, showVolume]);

  if (data.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-sm text-[var(--color-muted)] bg-[var(--background)] border border-dashed border-[var(--color-border)] rounded-lg"
      >
        No historical data available yet
      </div>
    );
  }

  return <div ref={containerRef} className="w-full" style={{ height }} />;
}
