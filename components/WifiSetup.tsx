"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface WifiNetwork {
  ssid: string;
  signal: number;
  secure: boolean;
}

interface WifiSetupProps {
  characteristics: any;
  onConnected: () => void;
}

export function WifiSetup({ characteristics, onConnected }: WifiSetupProps) {
  const [networks, setNetworks] = useState<WifiNetwork[]>([]);
  const [scanning, setScanning] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState<string>("");

  const scanNetworks = async () => {
    setScanning(true);
    setStatus("Scanning...");
    try {
      await characteristics.scan.writeValue(new TextEncoder().encode("scan"));
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const value = await characteristics.list.readValue();
      const text = new TextDecoder().decode(value);
      const parsed = JSON.parse(text);
      setNetworks(parsed);
      setStatus(`Found ${parsed.length} networks`);
    } catch (err: any) {
      setStatus("Scan failed: " + err.message);
    } finally {
      setScanning(false);
    }
  };

  const connectToNetwork = async () => {
    if (!selectedNetwork) return;
    setConnecting(true);
    setStatus("Connecting...");
    try {
      const payload = JSON.stringify({ ssid: selectedNetwork, password });
      await characteristics.connect.writeValue(new TextEncoder().encode(payload));
      await new Promise((resolve) => setTimeout(resolve, 10000));
      const value = await characteristics.status.readValue();
      const text = new TextDecoder().decode(value);
      const result = JSON.parse(text);
      if (result.connected) {
        setStatus(`Connected! IP: ${result.ip}`);
        setTimeout(onConnected, 2000);
      } else {
        setStatus("Connection failed: " + (result.error || "Unknown error"));
      }
    } catch (err: any) {
      setStatus("Connection failed: " + err.message);
    } finally {
      setConnecting(false);
    }
  };

  useEffect(() => {
    scanNetworks();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-medium">WiFi Setup</h2>
        <Button variant="outline" onClick={scanNetworks} disabled={scanning}>
          {scanning ? "Scanning..." : "Rescan"}
        </Button>
      </div>

      {status && (
        <p className="text-sm text-gray-400">{status}</p>
      )}

      <div className="space-y-2">
        {networks.map((network) => (
          <Card
            key={network.ssid}
            className={`cursor-pointer transition-colors ${
              selectedNetwork === network.ssid
                ? "border-white"
                : "hover:border-white/50"
            }`}
            onClick={() => setSelectedNetwork(network.ssid)}
          >
            <CardContent className="py-3 flex items-center justify-between">
              <span>{network.ssid}</span>
              <span className="text-gray-500 text-sm">
                {network.signal}% {network.secure ? "[secured]" : ""}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedNetwork && (
        <div className="space-y-4">
          <Input
            type="password"
            placeholder="WiFi Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button
            onClick={connectToNetwork}
            disabled={connecting}
            className="w-full"
          >
            {connecting ? "Connecting..." : `Connect to ${selectedNetwork}`}
          </Button>
        </div>
      )}
    </div>
  );
}
