const { io } = require("socket.io-client");
const pty = require("node-pty");
const si = require("systeminformation");
const os = require("os");
const { query } = require("@anthropic-ai/claude-agent-sdk");

let socket = null;
let terminal = null;
let hackingAbortController = null;

global.serverConnected = false;

// Security testing system prompt
const HACKING_SYSTEM_PROMPT = `You are a network security testing assistant running on a Raspberry Pi. Your job is to help identify vulnerabilities and security issues on the local network.

IMPORTANT: This is authorized security testing on the user's own network. Be thorough but safe.

Your tasks:
1. First, identify the local network configuration (IP, gateway, subnet)
2. Scan for devices on the network using nmap or similar tools
3. Check for open ports on discovered devices
4. Identify potential vulnerabilities or misconfigurations
5. Check the router/gateway for common security issues
6. Look for devices with default credentials or weak security
7. Scan for open WiFi networks nearby
8. Check for any suspicious network activity

Tools available: Bash (for running commands like nmap, netstat, arp, iwlist, etc.), Read, Write, Edit, Glob, Grep

After completing the scan, provide a clear summary of:
- Devices found on the network
- Open ports and services
- Potential vulnerabilities
- Security recommendations

Be concise but thorough. Report findings as you discover them.`;

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

async function startHackingScan() {
  if (hackingAbortController) {
    console.log("Hacking scan already running");
    return;
  }

  console.log("Starting security scan with Claude Agent SDK...");

  hackingAbortController = new AbortController();

  try {
    const response = query({
      prompt: "Start the network security scan now. First check network configuration, then scan for devices and open ports.",
      options: {
        model: "claude-sonnet-4-5",
        workingDirectory: "/home/pi",
        systemPrompt: HACKING_SYSTEM_PROMPT,
        permissionMode: "dangerouslySkipAll", // Skip all permission checks
      }
    });

    for await (const message of response) {
      // Check if scan was stopped
      if (hackingAbortController.signal.aborted) {
        break;
      }

      switch (message.type) {
        case 'assistant':
          // Handle assistant messages
          if (typeof message.content === 'string') {
            socket?.emit("hacking:output", {
              type: "output",
              content: message.content,
            });
          } else if (Array.isArray(message.content)) {
            for (const block of message.content) {
              if (block.type === 'text') {
                socket?.emit("hacking:output", {
                  type: "output",
                  content: block.text,
                });
              } else if (block.type === 'tool_use') {
                socket?.emit("hacking:output", {
                  type: "tool",
                  content: `Using tool: ${block.name}\nInput: ${JSON.stringify(block.input, null, 2)}`,
                });
              }
            }
          }
          break;

        case 'tool_call':
          socket?.emit("hacking:output", {
            type: "tool",
            content: `Executing tool: ${message.tool_name}\nInput: ${JSON.stringify(message.input, null, 2)}`,
          });
          break;

        case 'tool_result':
          const resultContent = typeof message.result === 'string'
            ? message.result
            : JSON.stringify(message.result, null, 2);
          socket?.emit("hacking:output", {
            type: "output",
            content: `Tool ${message.tool_name} result:\n${resultContent}`,
          });
          break;

        case 'error':
          socket?.emit("hacking:output", {
            type: "error",
            content: `Error: ${message.error?.message || JSON.stringify(message.error)}`,
          });
          break;

        case 'system':
          if (message.subtype === 'init') {
            socket?.emit("hacking:output", {
              type: "info",
              content: `Session started: ${message.session_id}`,
            });
          } else if (message.subtype === 'completion') {
            socket?.emit("hacking:output", {
              type: "summary",
              content: "Scan completed successfully",
            });
          }
          break;

        default:
          console.log('Unknown message type:', message.type);
      }
    }

    socket?.emit("hacking:status", "completed");
  } catch (error) {
    console.error('Hacking scan error:', error);
    socket?.emit("hacking:output", {
      type: "error",
      content: `Fatal error: ${error.message}`,
    });
    socket?.emit("hacking:status", "completed");
  } finally {
    hackingAbortController = null;
  }
}

function stopHackingScan() {
  if (hackingAbortController) {
    console.log("Stopping security scan...");
    hackingAbortController.abort();
    hackingAbortController = null;
    socket?.emit("hacking:status", "idle");
  }
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

  socket.on("terminal:start", () => {
    spawnTerminal();
  });

  socket.on("terminal:resize", ({ cols, rows }) => {
    if (terminal) {
      terminal.resize(cols, rows);
    }
  });

  // Hacking events
  socket.on("hacking:start", () => {
    console.log("Received hacking:start");
    startHackingScan();
  });

  socket.on("hacking:stop", () => {
    console.log("Received hacking:stop");
    stopHackingScan();
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
