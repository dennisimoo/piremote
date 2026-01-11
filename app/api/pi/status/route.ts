import { NextResponse } from "next/server";

// This will be set by the WebSocket server
declare global {
  var piConnected: boolean;
}

export async function GET() {
  return NextResponse.json({
    online: global.piConnected || false,
  });
}
