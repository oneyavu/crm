import type { Metadata } from "next";
import {
	PageShell,
	PageShellContent,
	PageShellDescription,
	PageShellHeader,
	PageShellHeading,
	PageShellTitle,
} from "@/components/page-shell";
import { requireWorkspaceAdmin } from "@/lib/session";
import { PlatformOperationsCenter } from "./platform-operations-center";

export const metadata: Metadata = { title: "Platform Operations" };
export const instant = false;

export default async function PlatformOperationsPage() {
	await requireWorkspaceAdmin();
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Platform Operations</PageShellTitle>
					<PageShellDescription>
						Admin-only inquiry intake, product administration, connector health
						and Paperclip approvals.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>
			<PageShellContent>
				<PlatformOperationsCenter />
			</PageShellContent>
		</PageShell>
	);
}
