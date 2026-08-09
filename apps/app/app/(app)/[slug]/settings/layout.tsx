import { Suspense } from "react";
import { requireWorkspaceAdmin } from "@/lib/session";
import { SettingsSidebar, SettingsSidebarFallback } from "./settings-sidebar";

export default async function SettingsLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	await requireWorkspaceAdmin();
	return (
		<div className="flex min-h-0 min-w-0 flex-1 flex-col md:flex-row">
			<Suspense fallback={<SettingsSidebarFallback />}>
				<SettingsSidebar />
			</Suspense>
			{children}
		</div>
	);
}
