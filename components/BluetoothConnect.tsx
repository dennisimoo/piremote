"use client";

import { useState } from "react";
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
  const [connecting, setConnecting] = useState(false);

  const connect = async () => {
    if (!navigator.bluetooth) {
      onError("Bluetooth not supported in this browser. Use Chrome.");
      return;
    }

    setConnecting(true);

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
    } catch (err: any) {
      if (err.name !== "NotFoundError") {
        onError(err.message || "Failed to connect");
      }
    } finally {
      setConnecting(false);
    }
  };

  return (
    <Button onClick={connect} disabled={connecting} size="lg">
      {connecting ? "Connecting..." : "Connect via Bluetooth"}
    </Button>
  );
}
