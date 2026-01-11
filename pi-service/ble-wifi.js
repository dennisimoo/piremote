const bleno = require("@abandonware/bleno");
const { exec } = require("child_process");
const os = require("os");

const SERVICE_UUID = "12345678123456781234567890abcdef0";
const WIFI_SCAN_UUID = "12345678123456781234567890abcdef1";
const WIFI_LIST_UUID = "12345678123456781234567890abcdef2";
const WIFI_CONNECT_UUID = "12345678123456781234567890abcdef3";
const WIFI_STATUS_UUID = "12345678123456781234567890abcdef4";

let cachedNetworks = [];
let connectionStatus = { connected: false, ip: null, error: null };

// Scan for WiFi networks
function scanNetworks() {
  return new Promise((resolve) => {
    exec(
      "nmcli -t -f SSID,SIGNAL,SECURITY device wifi list --rescan yes",
      (err, stdout) => {
        if (err) {
          resolve([]);
          return;
        }
        const networks = stdout
          .trim()
          .split("\n")
          .filter((line) => line.length > 0)
          .map((line) => {
            const parts = line.split(":");
            return {
              ssid: parts[0],
              signal: parseInt(parts[1]) || 0,
              secure: parts[2] && parts[2].length > 0,
            };
          })
          .filter((n) => n.ssid.length > 0);

        // Remove duplicates
        const unique = [];
        const seen = new Set();
        for (const n of networks) {
          if (!seen.has(n.ssid)) {
            seen.add(n.ssid);
            unique.push(n);
          }
        }
        resolve(unique);
      }
    );
  });
}

// Connect to WiFi network
function connectToWifi(ssid, password) {
  return new Promise((resolve) => {
    const cmd = password
      ? `nmcli device wifi connect "${ssid}" password "${password}"`
      : `nmcli device wifi connect "${ssid}"`;

    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        resolve({ connected: false, error: stderr || err.message });
        return;
      }

      // Get IP address
      setTimeout(() => {
        exec(
          "hostname -I | awk '{print $1}'",
          (err, stdout) => {
            const ip = stdout?.trim() || "unknown";
            resolve({ connected: true, ip });
          }
        );
      }, 2000);
    });
  });
}

// Get current connection status
function getStatus() {
  return new Promise((resolve) => {
    exec("hostname -I | awk '{print $1}'", (err, stdout) => {
      if (err || !stdout?.trim()) {
        resolve({ connected: false, ip: null });
        return;
      }
      resolve({ connected: true, ip: stdout.trim() });
    });
  });
}

// BLE Characteristics
class ScanCharacteristic extends bleno.Characteristic {
  constructor() {
    super({
      uuid: WIFI_SCAN_UUID,
      properties: ["write"],
    });
  }

  onWriteRequest(data, offset, withoutResponse, callback) {
    scanNetworks().then((networks) => {
      cachedNetworks = networks;
      callback(this.RESULT_SUCCESS);
    });
  }
}

class ListCharacteristic extends bleno.Characteristic {
  constructor() {
    super({
      uuid: WIFI_LIST_UUID,
      properties: ["read"],
    });
  }

  onReadRequest(offset, callback) {
    const data = Buffer.from(JSON.stringify(cachedNetworks));
    callback(this.RESULT_SUCCESS, data.slice(offset));
  }
}

class ConnectCharacteristic extends bleno.Characteristic {
  constructor() {
    super({
      uuid: WIFI_CONNECT_UUID,
      properties: ["write"],
    });
  }

  onWriteRequest(data, offset, withoutResponse, callback) {
    try {
      const { ssid, password } = JSON.parse(data.toString());
      connectToWifi(ssid, password).then((result) => {
        connectionStatus = result;
        callback(this.RESULT_SUCCESS);
      });
    } catch (e) {
      callback(this.RESULT_UNLIKELY_ERROR);
    }
  }
}

class StatusCharacteristic extends bleno.Characteristic {
  constructor() {
    super({
      uuid: WIFI_STATUS_UUID,
      properties: ["read"],
    });
  }

  onReadRequest(offset, callback) {
    getStatus().then((status) => {
      const data = Buffer.from(JSON.stringify(status));
      callback(this.RESULT_SUCCESS, data.slice(offset));
    });
  }
}

function startBLE() {
  const hostname = os.hostname();

  bleno.on("stateChange", (state) => {
    console.log("BLE state:", state);
    if (state === "poweredOn") {
      bleno.startAdvertising(hostname, [SERVICE_UUID]);
    } else {
      bleno.stopAdvertising();
    }
  });

  bleno.on("advertisingStart", (err) => {
    if (err) {
      console.error("BLE advertising error:", err);
      return;
    }

    console.log("BLE advertising started");

    bleno.setServices([
      new bleno.PrimaryService({
        uuid: SERVICE_UUID,
        characteristics: [
          new ScanCharacteristic(),
          new ListCharacteristic(),
          new ConnectCharacteristic(),
          new StatusCharacteristic(),
        ],
      }),
    ]);
  });
}

module.exports = { startBLE };
