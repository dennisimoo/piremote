import { NextRequest, NextResponse } from "next/server";
import { validatePassword, createToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();

    if (validatePassword(password)) {
      const token = createToken();
      return NextResponse.json({ success: true, token });
    }

    return NextResponse.json({ success: false }, { status: 401 });
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }
}
