import type { Metadata } from "next";
import { connection } from "next/server";
import { requireSession } from "@/lib/session";
import { ClientPortal } from "./client-portal";

export const metadata: Metadata = { title: "Client portal" };

export default async function ClientPortalPage() {
	await connection();
	const session = await requireSession();
	return <ClientPortal userName={session.user.name} />;
}
