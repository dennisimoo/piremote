"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StatsData {
  cpu: number;
  memory: { used: number; total: number };
  disk: { used: number; total: number };
  temperature: number;
  uptime: number;
  network: { ip: string; hostname: string };
}

interface StatsProps {
  stats: StatsData | null;
}

function formatBytes(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(1)} GB`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function Stats({ stats }: StatsProps) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardContent className="py-4">
              <div className="h-4 bg-white/10 animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const items = [
    { label: "CPU", value: `${stats.cpu.toFixed(1)}%` },
    {
      label: "Memory",
      value: `${formatBytes(stats.memory.used)} / ${formatBytes(stats.memory.total)}`,
    },
    {
      label: "Disk",
      value: `${formatBytes(stats.disk.used)} / ${formatBytes(stats.disk.total)}`,
    },
    { label: "Temperature", value: `${stats.temperature.toFixed(1)} C` },
    { label: "Uptime", value: formatUptime(stats.uptime) },
    { label: "IP", value: stats.network.ip },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardHeader className="pb-2 mb-0">
            <CardTitle className="text-xs text-gray-500 uppercase tracking-wider">
              {item.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-mono">{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
