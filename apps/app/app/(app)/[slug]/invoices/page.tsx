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
import { InvoicesWorkspace } from "./invoices-workspace";

export const metadata: Metadata = { title: "Invoices" };
export const instant = false;

export default async function InvoicesPage() {
	await requireSession();
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Invoices</PageShellTitle>
					<PageShellDescription>
						Create, send and track client invoices from the same delivery
						system.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>
			<PageShellContent>
				<InvoicesWorkspace />
			</PageShellContent>
		</PageShell>
	);
}
