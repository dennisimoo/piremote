const { io } = require("socket.io-client");
const WebSocket = require("ws");
const si = require("systeminformation");
const os = require("os");

let socket = null;
let ttydWs = null;

global.serverConnected = false;

function getStats() {
  return Promise.all([
    si.currentLoad(),
    si.mem(),
    si.fsSize(),
    si.cpuTemperature(),
  ]).then(([load, mem, disk, temp]) => {
    const rootDisk = disk.find((d) => d.mount === "/") || disk[0] || {};
    return {
      cpu: load.currentLoad || 0,
      memory: {
        used: mem.used || 0,
        total: mem.total || 0,
      },
      disk: {
        used: rootDisk.used || 0,
        total: rootDisk.size || 0,
      },
      temperature: temp.main || 0,
      uptime: os.uptime(),
      network: {
        ip: getLocalIP(),
        hostname: os.hostname(),
      },
    };
  });
}

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "unknown";
}

function connectToTtyd() {
  if (ttydWs && ttydWs.readyState === WebSocket.OPEN) return;

  console.log("Connecting to ttyd...");
  ttydWs = new WebSocket("ws://localhost:7681/ws");

  ttydWs.on("open", () => {
    console.log("Connected to ttyd");
  });

  ttydWs.on("message", (data) => {
    // Forward ttyd output to server
    if (socket && socket.connected) {
      socket.emit("terminal:output", data.toString("base64"));
    }
  });

  ttydWs.on("close", () => {
    console.log("ttyd connection closed, reconnecting...");
    ttydWs = null;
    setTimeout(connectToTtyd, 1000);
  });

  ttydWs.on("error", (err) => {
    console.log("ttyd error:", err.message);
  });
}

function connectToServer(serverUrl, piToken) {
  if (socket?.connected) return;

  socket = io(serverUrl + "/pi", {
    auth: { piToken },
    reconnection: true,
    reconnectionDelay: 5000,
  });

  socket.on("connect", () => {
    console.log("Connected to server");
    global.serverConnected = true;

    // Connect to local ttyd
    connectToTtyd();

    // Send stats periodically
    const statsInterval = setInterval(() => {
      if (!socket?.connected) {
        clearInterval(statsInterval);
        return;
      }
      getStats()
        .then((stats) => socket.emit("stats", stats))
        .catch(() => {});
    }, 2000);
  });

  socket.on("terminal:input", (data) => {
    // Forward input to ttyd
    if (ttydWs && ttydWs.readyState === WebSocket.OPEN) {
      // ttyd expects: 0 + data for input
      const buf = Buffer.from(data, "base64");
      ttydWs.send(buf);
    }
  });

  socket.on("terminal:resize", ({ cols, rows }) => {
    if (ttydWs && ttydWs.readyState === WebSocket.OPEN) {
      // ttyd resize: 1 + JSON
      const msg = Buffer.concat([
        Buffer.from([1]),
        Buffer.from(JSON.stringify({ columns: cols, rows: rows }))
      ]);
      ttydWs.send(msg);
    }
  });

  socket.on("disconnect", () => {
    console.log("Disconnected from server");
    global.serverConnected = false;
  });

  socket.on("connect_error", (err) => {
    console.log("Connection error:", err.message);
  });
}

module.exports = { connectToServer };
