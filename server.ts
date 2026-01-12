import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer, Socket } from "socket.io";
import { validateToken } from "./lib/auth";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

let piSocket: Socket | null = null;
const clientSockets: Set<Socket> = new Set();

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

    console.log("Pi attempting connection, token match:", piToken === expectedToken);

    if (piToken !== expectedToken) {
      console.log("Pi rejected - invalid token");
      socket.disconnect();
      return;
    }

    console.log("Pi connected successfully");
    piSocket = socket;

    // Notify all clients that Pi is online
    clientSockets.forEach(client => {
      client.emit("pi:online");
    });

    // Forward terminal output to all clients
    socket.on("terminal:output", (data: string) => {
      console.log("Forwarding terminal output to", clientSockets.size, "clients");
      clientSockets.forEach(client => {
        client.emit("terminal:output", data);
      });
    });

    // Forward stats to all clients
    socket.on("stats", (data: any) => {
      clientSockets.forEach(client => {
        client.emit("stats", data);
      });
    });

    // Forward hacking output to all clients
    socket.on("hacking:output", (data: { type: string; content: string }) => {
      clientSockets.forEach(client => {
        client.emit("hacking:output", data);
      });
    });

    // Forward hacking status to all clients
    socket.on("hacking:status", (status: string) => {
      clientSockets.forEach(client => {
        client.emit("hacking:status", status);
      });
    });

    socket.on("disconnect", () => {
      console.log("Pi disconnected");
      piSocket = null;
      clientSockets.forEach(client => {
        client.emit("pi:offline");
      });
    });
  });

  // Default namespace - for web browser connections
  io.on("connection", (socket) => {
    const token = socket.handshake.auth.token;

    if (!validateToken(token)) {
      console.log("Client rejected - invalid token");
      socket.disconnect();
      return;
    }

    console.log("Client connected");
    clientSockets.add(socket);

    // Tell client if Pi is online/offline
    if (piSocket) {
      socket.emit("pi:online");
    } else {
      socket.emit("pi:offline");
    }

    // Start new terminal when client requests it
    socket.on("terminal:start", () => {
      console.log("Client requested new terminal");
      if (piSocket) {
        piSocket.emit("terminal:start");
      }
    });

    // Forward terminal input to Pi
    socket.on("terminal:input", (data: string) => {
      console.log("Forwarding terminal input to Pi");
      if (piSocket) {
        piSocket.emit("terminal:input", data);
      }
    });

    // Forward resize to Pi
    socket.on("terminal:resize", (size: { cols: number; rows: number }) => {
      if (piSocket) {
        piSocket.emit("terminal:resize", size);
      }
    });

    // Start hacking scan
    socket.on("hacking:start", () => {
      console.log("Client requested hacking scan");
      if (piSocket) {
        piSocket.emit("hacking:start");
      }
    });

    // Stop hacking scan
    socket.on("hacking:stop", () => {
      console.log("Client requested to stop hacking scan");
      if (piSocket) {
        piSocket.emit("hacking:stop");
      }
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected");
      clientSockets.delete(socket);
    });
  });

  httpServer.listen(port, () => {
    console.log(`> BlackBox server ready on http://${hostname}:${port}`);
  });
});
