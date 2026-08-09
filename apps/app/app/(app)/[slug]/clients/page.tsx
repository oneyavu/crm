import type { Metadata } from "next";
import {
	PageShell,
	PageShellContent,
	PageShellDescription,
	PageShellHeader,
	PageShellHeading,
	PageShellTitle,
} from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { ClientManager } from "./client-manager";

export const metadata: Metadata = { title: "Client Management" };
export const instant = false;
export default async function ClientsPage() {
	await requireSession();
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Client Management</PageShellTitle>
					<PageShellDescription>
						Company accounts, decision contacts, portal access, opportunities,
						projects, invoices and service history.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>
			<PageShellContent>
				<ClientManager />
			</PageShellContent>
		</PageShell>
	);
}
