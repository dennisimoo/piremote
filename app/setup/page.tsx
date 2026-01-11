"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { io } from "socket.io-client";
import { BluetoothConnect } from "@/components/BluetoothConnect";
import { WifiSetup } from "@/components/WifiSetup";

export default function SetupPage() {
  const [device, setDevice] = useState<BluetoothDevice | null>(null);
  const [characteristics, setCharacteristics] = useState<any>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
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

    // Connect to socket to check if Pi is online
    const socket = io({
      auth: { token },
    });

    socket.on("connect", () => {
      // Wait a moment to receive pi:online or pi:offline
      setTimeout(() => {
        setChecking(false);
      }, 2000);
    });

    socket.on("pi:online", () => {
      // Pi is online, go to dashboard
      socket.disconnect();
      router.push("/dashboard");
    });

    socket.on("pi:offline", () => {
      setChecking(false);
    });

    // Cleanup
    return () => {
      socket.disconnect();
    };
  }, [router]);

  const handleConnected = (dev: BluetoothDevice, chars: any) => {
    setDevice(dev);
    setCharacteristics(chars);
    setError("");
  };

  const handleWifiConnected = () => {
    setTimeout(() => {
      router.push("/dashboard");
    }, 3000);
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Checking Pi status...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-lg mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Setup</h1>
          <p className="text-gray-500 mt-2">
            Connect to your Raspberry Pi via Bluetooth to configure WiFi
          </p>
        </div>

        {error && (
          <div className="border border-red-500 p-4 text-red-500 text-sm">
            {error}
          </div>
        )}

        {!device ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Make sure you are near your Raspberry Pi and Bluetooth is enabled.
            </p>
            <BluetoothConnect
              onConnected={handleConnected}
              onError={setError}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span className="w-2 h-2 bg-white rounded-full" />
              Connected to {device.name || "Raspberry Pi"}
            </div>
            <WifiSetup
              characteristics={characteristics}
              onConnected={handleWifiConnected}
            />
          </div>
        )}
      </div>
    </div>
  );
}
