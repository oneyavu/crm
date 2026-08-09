import { NextResponse } from "next/server";

/**
 * The legacy public chat/voice embed is intentionally retired. Keep the route
 * as a harmless no-op so cached WordPress pages cannot recreate either widget.
 */
export function GET() {
	return new NextResponse("/* V-OS public widget retired */", {
		headers: {
			"Cache-Control": "public, max-age=60, must-revalidate",
			"Content-Type": "application/javascript; charset=utf-8",
			"X-Content-Type-Options": "nosniff",
		},
	});
}
