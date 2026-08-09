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
import { ProjectsWorkspace } from "./projects-workspace";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
	await requireSession();
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Projects</PageShellTitle>
					<PageShellDescription>
						Plan delivery, assign work and keep client outcomes moving.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>
			<PageShellContent>
				<ProjectsWorkspace />
			</PageShellContent>
		</PageShell>
	);
}
