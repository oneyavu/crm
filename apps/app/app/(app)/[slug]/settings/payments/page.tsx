import type { Metadata } from "next";
import { Suspense } from "react";
import {
	PageShell,
	PageShellContent,
	PageShellDescription,
	PageShellHeader,
	PageShellHeading,
	PageShellLoading,
	PageShellTitle,
} from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { HydrateClient } from "@/lib/trpc/hydrate";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";
import { PaymentOptions } from "./payment-options";

export const metadata: Metadata = { title: "Payment options" };

export default function PaymentOptionsPage() {
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Payment options</PageShellTitle>
					<PageShellDescription>
						Manage the bank instructions clients see after choosing Pay Now.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>
			<PageShellContent>
				<Suspense fallback={<PageShellLoading />}>
					<PaymentSettings />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function PaymentSettings() {
	await requireSession();
	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();
	await queryClient.prefetchQuery(trpc.settings.paymentAccounts.queryOptions());
	return (
		<HydrateClient>
			<PaymentOptions />
		</HydrateClient>
	);
}
