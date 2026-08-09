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
import { RecordsWorkspace } from "./records-workspace";

export const metadata: Metadata = { title: "Records" };
export const instant = false;

export default async function RecordsPage() {
	await requireSession();
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Records</PageShellTitle>
					<PageShellDescription>
						Manage estimates, expenses, contracts, tickets, staff, tasks and
						notes.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>
			<PageShellContent>
				<RecordsWorkspace />
			</PageShellContent>
		</PageShell>
	);
}
