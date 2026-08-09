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
import { CatalogLibrary } from "./catalog-library";

export const metadata: Metadata = { title: "VAYU Catalog" };

export default async function CatalogPage() {
	await requireSession();
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>VAYU Catalog</PageShellTitle>
					<PageShellDescription>
						Products, platform capabilities, services and use cases sourced from
						the VAYU website.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>
			<PageShellContent>
				<CatalogLibrary />
			</PageShellContent>
		</PageShell>
	);
}
