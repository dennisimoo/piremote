"use client";

import { useEffect, useRef, useCallback } from "react";
import type { Socket } from "socket.io-client";

interface TerminalProps {
  socket: Socket | null;
}

export function Terminal({ socket }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<any>(null);
  const fitAddonRef = useRef<any>(null);
  const socketRef = useRef<Socket | null>(null);

  // Keep socket ref updated
  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    const initTerminal = async () => {
      const { Terminal: XTerm } = await import("xterm");
      const { FitAddon } = await import("xterm-addon-fit");

      const xterm = new XTerm({
        theme: {
          background: "#000000",
          foreground: "#ffffff",
          cursor: "#ffffff",
          cursorAccent: "#000000",
          selectionBackground: "#ffffff",
          selectionForeground: "#000000",
        },
        fontFamily: "ui-monospace, SFMono-Regular, SF Mono, Menlo, monospace",
        fontSize: 14,
        cursorBlink: true,
      });

      const fitAddon = new FitAddon();
      xterm.loadAddon(fitAddon);
      xterm.open(terminalRef.current!);
      fitAddon.fit();

      xtermRef.current = xterm;
      fitAddonRef.current = fitAddon;

      // Use ref to always get current socket
      xterm.onData((data: string) => {
        if (socketRef.current) {
          socketRef.current.emit("terminal:input", data);
        }
      });
    };

    initTerminal();

    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
        if (socketRef.current && xtermRef.current) {
          socketRef.current.emit("terminal:resize", {
            cols: xtermRef.current.cols,
            rows: xtermRef.current.rows,
          });
        }
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!socket || !xtermRef.current) return;

    const handleOutput = (data: string) => {
      xtermRef.current?.write(data);
    };

    socket.on("terminal:output", handleOutput);

    // Send initial resize
    socket.emit("terminal:resize", {
      cols: xtermRef.current.cols,
      rows: xtermRef.current.rows,
    });

    return () => {
      socket.off("terminal:output", handleOutput);
    };
  }, [socket]);

  return (
    <div className="h-full w-full" style={{ minHeight: "300px" }}>
      <div ref={terminalRef} className="h-full w-full" style={{ height: "100%" }} />
    </div>
  );
}
