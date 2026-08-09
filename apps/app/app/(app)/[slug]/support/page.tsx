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
import { WidgetStudio } from "./widget-studio";

export const metadata: Metadata = { title: "Widget Studio" };
export const instant = false;

export default async function SupportPage() {
	await requireSession();
	return (
		<PageShell className="max-w-[100rem]">
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Widget Studio</PageShellTitle>
					<PageShellDescription>
						Build, preview and publish GPT-5.5 client support anywhere.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>
			<PageShellContent>
				<WidgetStudio />
			</PageShellContent>
		</PageShell>
	);
}
