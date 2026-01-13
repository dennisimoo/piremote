"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

const SERVICE_UUID = "12345678-1234-5678-1234-56789abcdef0";
const WIFI_SCAN_UUID = "12345678-1234-5678-1234-56789abcdef1";
const WIFI_LIST_UUID = "12345678-1234-5678-1234-56789abcdef2";
const WIFI_CONNECT_UUID = "12345678-1234-5678-1234-56789abcdef3";
const WIFI_STATUS_UUID = "12345678-1234-5678-1234-56789abcdef4";

interface BluetoothConnectProps {
  onConnected: (device: BluetoothDevice, characteristics: any) => void;
  onError: (error: string) => void;
}

export function BluetoothConnect({ onConnected, onError }: BluetoothConnectProps) {
  const [searching, setSearching] = useState(false);
  const [autoRetry, setAutoRetry] = useState(false);

  const connect = async () => {
    if (!navigator.bluetooth) {
      onError("Bluetooth not supported in this browser. Use Chrome.");
      return;
    }

    setSearching(true);

    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [SERVICE_UUID] }],
        optionalServices: [SERVICE_UUID],
      });

      const server = await device.gatt?.connect();
      if (!server) throw new Error("Failed to connect to GATT server");

      const service = await server.getPrimaryService(SERVICE_UUID);

      const characteristics = {
        scan: await service.getCharacteristic(WIFI_SCAN_UUID),
        list: await service.getCharacteristic(WIFI_LIST_UUID),
        connect: await service.getCharacteristic(WIFI_CONNECT_UUID),
        status: await service.getCharacteristic(WIFI_STATUS_UUID),
      };

      onConnected(device, characteristics);
      setAutoRetry(false);
    } catch (err: any) {
      if (err.name === "NotFoundError") {
        // Device not found, enable auto-retry
        setAutoRetry(true);
      } else {
        onError(err.message || "Failed to connect");
        setAutoRetry(false);
      }
    } finally {
      setSearching(false);
    }
  };

  // Auto-retry connection every 3 seconds if enabled
  useEffect(() => {
    if (!autoRetry) return;

    const interval = setInterval(() => {
      connect();
    }, 3000);

    return () => clearInterval(interval);
  }, [autoRetry]);

  return (
    <div className="space-y-4">
      <Button onClick={connect} disabled={searching} size="lg" className="w-full">
        {searching ? "Searching for device..." : "Search for Raspberry Pi"}
      </Button>

      {autoRetry && (
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: "0ms" }} />
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: "150ms" }} />
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: "300ms" }} />
          </div>
          <span>Searching for Raspberry Pi...</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAutoRetry(false)}
            className="ml-auto text-xs"
          >
            Stop
          </Button>
        </div>
      )}
    </div>
  );
}
