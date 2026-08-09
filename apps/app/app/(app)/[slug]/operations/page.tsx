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
import { OperationsCenter } from "./operations-center";

export const metadata: Metadata = { title: "Business Operations" };
export const instant = false;

export default async function OperationsPage() {
	await requireSession();
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Business Operations</PageShellTitle>
					<PageShellDescription>
						Financial control, people operations, pricing, compliance, templates
						and AI-assisted deal review.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>
			<PageShellContent>
				<OperationsCenter />
			</PageShellContent>
		</PageShell>
	);
}
