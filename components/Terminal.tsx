"use client";

import { useEffect, useRef } from "react";
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

  const setupSocketListeners = (socket: Socket) => {
    const handleOutput = (data: string) => {
      console.log("Received output:", data.length, "bytes");
      if (xtermRef.current) {
        xtermRef.current.write(data);
      }
    };

    socket.off("terminal:output");
    socket.on("terminal:output", handleOutput);

    // Send initial resize
    if (xtermRef.current) {
      socket.emit("terminal:resize", {
        cols: xtermRef.current.cols,
        rows: xtermRef.current.rows,
      });
    }
  };

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

      console.log("Terminal initialized, cols:", xterm.cols, "rows:", xterm.rows);

      // Send input directly
      xterm.onData((data: string) => {
        console.log("Sending input:", data.length, "bytes");
        if (socketRef.current) {
          socketRef.current.emit("terminal:input", data);
        }
      });

      // Set up output handler if socket already exists
      if (socketRef.current) {
        setupSocketListeners(socketRef.current);
      }
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

    console.log("Socket connected, setting up listeners");
    setupSocketListeners(socket);

    return () => {
      socket.off("terminal:output");
    };
  }, [socket]);

  return (
    <div className="w-full" style={{ height: "calc(100vh - 120px)", minHeight: "400px" }}>
      <div ref={terminalRef} className="w-full h-full" />
    </div>
  );
}
