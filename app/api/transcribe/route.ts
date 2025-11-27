import { NextRequest, NextResponse } from "next/server";
import { kv } from "@/lib/kv";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "Missing meeting ID" },
      { status: 400 }
    );
  }

  try {
    const data = await kv.get(id);

    if (!data) {
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching meeting status:", error);
    return NextResponse.json(
      { error: "Failed to fetch meeting status" },
      { status: 500 }
    );
  }
}
