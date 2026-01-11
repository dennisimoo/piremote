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

  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    let xterm: any;
    let fitAddon: any;

    const initTerminal = async () => {
      const { Terminal: XTerm } = await import("xterm");
      const { FitAddon } = await import("xterm-addon-fit");

      // Import CSS
      await import("xterm/css/xterm.css");

      xterm = new XTerm({
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

      fitAddon = new FitAddon();
      xterm.loadAddon(fitAddon);
      xterm.open(terminalRef.current!);
      fitAddon.fit();

      xtermRef.current = xterm;
      fitAddonRef.current = fitAddon;

      xterm.onData((data: string) => {
        if (socket) {
          socket.emit("terminal:input", data);
        }
      });
    };

    initTerminal();

    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
        if (socket && xtermRef.current) {
          socket.emit("terminal:resize", {
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

    if (xtermRef.current) {
      socket.emit("terminal:resize", {
        cols: xtermRef.current.cols,
        rows: xtermRef.current.rows,
      });
    }

    return () => {
      socket.off("terminal:output", handleOutput);
    };
  }, [socket]);

  return (
    <div className="h-full w-full">
      <div ref={terminalRef} className="h-full w-full" />
    </div>
  );
}
