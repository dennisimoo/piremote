"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { Terminal } from "@/components/Terminal";
import { Stats } from "@/components/Stats";
import { HackingPanel } from "@/components/HackingPanel";
import { Button } from "@/components/ui/button";

interface StatsData {
  cpu: number;
  memory: { used: number; total: number };
  disk: { used: number; total: number };
  temperature: number;
  uptime: number;
  network: { ip: string; hostname: string };
}

export default function DashboardPage() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [view, setView] = useState<"hacking" | "terminal" | "stats">("hacking");
  const router = useRouter();

  useEffect(() => {
    const token = document.cookie
      .split("; ")
      .find((row) => row.startsWith("token="))
      ?.split("=")[1];

    if (!token) {
      router.push("/");
      return;
    }

    const s = io({
      auth: { token },
    });

    s.on("connect", () => {
      setConnected(true);
    });

    s.on("disconnect", () => {
      setConnected(false);
    });

    s.on("pi:offline", () => {
      setConnected(false);
      router.push("/setup");
    });

    s.on("stats", (data: StatsData) => {
      setStats(data);
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [router]);

  const handleLogout = () => {
    document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    socket?.disconnect();
    router.push("/");
  };

  return (
    <div className="h-screen flex flex-col">
      <header className="border-b border-white/20 p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="font-bold">BlackBox</h1>
          <span
            className={`text-xs px-2 py-1 border ${
              connected
                ? "border-white text-white"
                : "border-gray-600 text-gray-600"
            }`}
          >
            {connected ? "ONLINE" : "OFFLINE"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={view === "hacking" ? "default" : "ghost"}
            size="sm"
            onClick={() => setView("hacking")}
          >
            Hacking
          </Button>
          <Button
            variant={view === "terminal" ? "default" : "ghost"}
            size="sm"
            onClick={() => setView("terminal")}
          >
            Terminal
          </Button>
          <Button
            variant={view === "stats" ? "default" : "ghost"}
            size="sm"
            onClick={() => setView("stats")}
          >
            Stats
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        {!connected ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-gray-500">Connecting to Pi...</p>
          </div>
        ) : view === "hacking" ? (
          <div className="h-full p-4">
            <HackingPanel socket={socket} />
          </div>
        ) : view === "terminal" ? (
          <div className="h-full p-4" style={{ minHeight: "400px" }}>
            <Terminal socket={socket} />
          </div>
        ) : (
          <div className="p-4">
            <Stats stats={stats} />
          </div>
        )}
      </main>
    </div>
  );
}
