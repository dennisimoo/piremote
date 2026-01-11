const { startBLE } = require("./ble-wifi");
const { connectToServer } = require("./ws-client");
const { exec } = require("child_process");

const SERVER_URL = process.env.BLACKBOX_SERVER || process.env.PIREMOTE_SERVER || "http://localhost:3000";
const PI_TOKEN = process.env.PI_TOKEN || "pi-secret-token";

// Check if we have WiFi connection
function checkWifi() {
  return new Promise((resolve) => {
    exec("nmcli -t -f GENERAL.STATE device show wlan0", (err, stdout) => {
      if (err) {
        resolve(false);
        return;
      }
      resolve(stdout.includes("100 (connected)"));
    });
  });
}

async function main() {
  console.log("BlackBox Service starting...");

  // Always start BLE for WiFi configuration
  startBLE();

  // Check WiFi and connect to server if available
  const hasWifi = await checkWifi();

  if (hasWifi) {
    console.log("WiFi connected, connecting to server...");
    connectToServer(SERVER_URL, PI_TOKEN);
  } else {
    console.log("No WiFi, waiting for configuration via Bluetooth...");
  }

  // Periodically check WiFi status
  setInterval(async () => {
    const connected = await checkWifi();
    if (connected && !global.serverConnected) {
      console.log("WiFi now available, connecting to server...");
      connectToServer(SERVER_URL, PI_TOKEN);
    }
  }, 10000);
}

main().catch(console.error);
