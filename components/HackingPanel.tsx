"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Socket } from "socket.io-client";

interface HackingPanelProps {
  socket: Socket | null;
  systemPrompt?: string;
}

interface LogEntry {
  type: "info" | "tool" | "output" | "error" | "summary";
  content: string;
  timestamp: Date;
}

export function HackingPanel({ socket, systemPrompt }: HackingPanelProps) {
  const [status, setStatus] = useState<"idle" | "running" | "completed">("idle");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!socket) return;

    const handleOutput = (data: { type: string; content: string }) => {
      setLogs((prev) => [
        ...prev,
        {
          type: data.type as LogEntry["type"],
          content: data.content,
          timestamp: new Date(),
        },
      ]);
    };

    const handleStatus = (newStatus: "idle" | "running" | "completed") => {
      setStatus(newStatus);
      if (newStatus === "completed") {
        setLogs((prev) => [
          ...prev,
          {
            type: "info",
            content: "--- Scan completed ---",
            timestamp: new Date(),
          },
        ]);
      }
    };

    socket.on("hacking:output", handleOutput);
    socket.on("hacking:status", handleStatus);

    return () => {
      socket.off("hacking:output", handleOutput);
      socket.off("hacking:status", handleStatus);
    };
  }, [socket]);

  // Auto-scroll to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleStart = () => {
    if (!socket) return;
    setLogs([
      {
        type: "info",
        content: "Starting security scan...",
        timestamp: new Date(),
      },
    ]);
    setStatus("running");
    socket.emit("hacking:start", { systemPrompt });
  };

  const handleStop = () => {
    if (!socket) return;
    socket.emit("hacking:stop");
    setLogs((prev) => [
      ...prev,
      {
        type: "info",
        content: "--- Scan interrupted by user ---",
        timestamp: new Date(),
      },
    ]);
    setStatus("idle");
  };

  const handleClear = () => {
    setLogs([]);
    setStatus("idle");
  };

  const getLogColor = (type: LogEntry["type"]) => {
    switch (type) {
      case "tool":
        return "text-blue-400";
      case "error":
        return "text-red-400";
      case "summary":
        return "text-green-400";
      case "info":
        return "text-gray-400";
      default:
        return "text-white";
    }
  };

  return (
    <div className="h-full flex flex-col gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Network Security Scanner</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-400 mb-4">
            Uses Claude Agent to scan your network for vulnerabilities, open ports,
            connected devices, and potential security issues.
          </p>
          <div className="flex gap-2">
            {status === "idle" || status === "completed" ? (
              <Button onClick={handleStart}>Start Test</Button>
            ) : (
              <Button variant="outline" onClick={handleStop}>
                Stop
              </Button>
            )}
            {logs.length > 0 && (
              <Button variant="ghost" onClick={handleClear}>
                Clear
              </Button>
            )}
            <span className="ml-auto text-sm text-gray-500 flex items-center">
              Status: {status === "running" ? "Running..." : status === "completed" ? "Completed" : "Idle"}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="flex-1 overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Live Output</CardTitle>
        </CardHeader>
        <CardContent className="h-full overflow-hidden">
          <div
            className="h-full overflow-y-auto font-mono text-sm bg-black p-3 border border-white/20"
            style={{ maxHeight: "calc(100vh - 320px)" }}
          >
            {logs.length === 0 ? (
              <p className="text-gray-500">Click "Start Test" to begin scanning...</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className={`mb-1 ${getLogColor(log.type)}`}>
                  <span className="text-gray-600 mr-2">
                    [{log.timestamp.toLocaleTimeString()}]
                  </span>
                  {log.type === "tool" && <span className="text-blue-400 mr-1">[TOOL]</span>}
                  {log.type === "error" && <span className="text-red-400 mr-1">[ERROR]</span>}
                  {log.type === "summary" && <span className="text-green-400 mr-1">[SUMMARY]</span>}
                  <span className="whitespace-pre-wrap">{log.content}</span>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
