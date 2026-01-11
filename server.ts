import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { validateToken } from "./lib/auth";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

declare global {
  var piConnected: boolean;
  var piSocket: any;
}

global.piConnected = false;
global.piSocket = null;

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // Pi namespace - for Raspberry Pi connection
  const piNamespace = io.of("/pi");

  piNamespace.on("connection", (socket) => {
    const piToken = socket.handshake.auth.piToken;
    const expectedToken = process.env.PI_TOKEN || "pi-secret-token";

    if (piToken !== expectedToken) {
      socket.disconnect();
      return;
    }

    console.log("Pi connected");
    global.piConnected = true;
    global.piSocket = socket;

    // Broadcast to all clients that Pi is online
    io.emit("pi:online");

    socket.on("terminal:output", (data: string) => {
      io.emit("terminal:output", data);
    });

    socket.on("stats", (data: any) => {
      io.emit("stats", data);
    });

    socket.on("disconnect", () => {
      console.log("Pi disconnected");
      global.piConnected = false;
      global.piSocket = null;
      io.emit("pi:offline");
    });
  });

  // Client namespace - for web browser connections
  io.on("connection", (socket) => {
    const token = socket.handshake.auth.token;

    if (!validateToken(token)) {
      socket.disconnect();
      return;
    }

    console.log("Client connected");

    // Check if Pi is online
    if (!global.piConnected) {
      socket.emit("pi:offline");
    }

    // Forward terminal input to Pi
    socket.on("terminal:input", (data: string) => {
      if (global.piSocket) {
        global.piSocket.emit("terminal:input", data);
      }
    });

    // Forward resize to Pi
    socket.on("terminal:resize", (size: { cols: number; rows: number }) => {
      if (global.piSocket) {
        global.piSocket.emit("terminal:resize", size);
      }
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected");
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
