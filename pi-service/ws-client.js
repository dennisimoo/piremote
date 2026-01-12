const { io } = require("socket.io-client");
const pty = require("node-pty");
const si = require("systeminformation");
const os = require("os");

let socket = null;
let terminal = null;

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

function spawnTerminal() {
  // Kill old terminal if exists
  if (terminal) {
    console.log("Killing old terminal...");
    terminal.kill();
    terminal = null;
  }

  console.log("Starting new terminal...");

  const env = {
    ...process.env,
    HOME: "/home/pi",
    PATH: "/home/pi/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:" + (process.env.PATH || ""),
  };

  terminal = pty.spawn("bash", ["--login", "-i"], {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    cwd: "/home/pi",
    env: env,
  });

  terminal.onData((data) => {
    if (socket && socket.connected) {
      socket.emit("terminal:output", data);
    }
  });

  console.log("Terminal started");
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
    if (terminal) {
      terminal.write(data);
    }
  });

  // Spawn new terminal when client connects (signaled by terminal:start)
  socket.on("terminal:start", () => {
    spawnTerminal();
  });

  socket.on("terminal:resize", ({ cols, rows }) => {
    if (terminal) {
      terminal.resize(cols, rows);
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
