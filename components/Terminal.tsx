"use client";

import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { Socket } from "socket.io-client";

interface TerminalProps {
  socket: Socket | null;
}

export function Terminal({ socket }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

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
    xterm.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    const handleResize = () => {
      fitAddon.fit();
      if (socket) {
        socket.emit("terminal:resize", {
          cols: xterm.cols,
          rows: xterm.rows,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    xterm.onData((data) => {
      if (socket) {
        socket.emit("terminal:input", data);
      }
    });

    return () => {
      window.removeEventListener("resize", handleResize);
      xterm.dispose();
      xtermRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!socket || !xtermRef.current) return;

    const handleOutput = (data: string) => {
      xtermRef.current?.write(data);
    };

    socket.on("terminal:output", handleOutput);

    socket.emit("terminal:resize", {
      cols: xtermRef.current.cols,
      rows: xtermRef.current.rows,
    });

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
