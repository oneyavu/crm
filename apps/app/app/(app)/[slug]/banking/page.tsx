import Launch from "@carbon/icons-react/es/Launch";
import Security from "@carbon/icons-react/es/Security";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
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

const SCOTIABANK_SMALL_BUSINESS =
	"https://jm.scotiabank.com/small-business.html";

export const metadata: Metadata = { title: "BNS Online Banking" };
export const instant = false;

export default async function BankingPage() {
	await requireSession();

	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>BNS Online Banking</PageShellTitle>
					<PageShellDescription>
						A secure same-tab handoff to Scotiabank Jamaica Small Business.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>

			<PageShellContent>
				<section className="mx-auto flex w-full max-w-4xl flex-col gap-8 py-4">
					<div className="overflow-hidden rounded-2xl border border-border bg-card">
						<div className="border-b border-border bg-[linear-gradient(120deg,rgba(255,111,97,0.16),rgba(97,255,183,0.08))] px-6 py-8 sm:px-9">
							<p className="text-sm font-medium text-muted-foreground">
								Scotiabank Jamaica
							</p>
							<h2 className="mt-2 max-w-2xl text-balance font-medium text-3xl tracking-tight sm:text-4xl">
								Business banking from your VAYU workflow
							</h2>
							<p className="mt-4 max-w-2xl text-pretty text-muted-foreground leading-6">
								Review Scotiabank small-business services, follow its links and
								sign in through the bank&apos;s official website. The handoff
								stays in this browser tab; no popup or additional window is
								opened.
							</p>
						</div>

						<div className="grid gap-6 px-6 py-7 sm:grid-cols-[1fr_auto] sm:items-end sm:px-9">
							<div className="flex gap-3">
								<div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
									<Icon icon={Security} />
								</div>
								<div>
									<h3 className="font-medium">Bank-controlled sign-in</h3>
									<p className="mt-1 max-w-xl text-muted-foreground text-sm leading-6">
										VAYU does not request, proxy, read or store your banking
										credentials. Scotiabank controls the entire authenticated
										session.
									</p>
								</div>
							</div>

							<Button asChild className="min-w-56">
								<a href={SCOTIABANK_SMALL_BUSINESS}>
									Continue to Scotiabank
									<Icon icon={Launch} />
								</a>
							</Button>
						</div>
					</div>

					<p className="max-w-3xl text-muted-foreground text-sm leading-6">
						Scotiabank permits its pages to be framed only by Scotiabank-owned
						domains. For your security, the bank page cannot remain inside the
						CRM frame. Use your browser&apos;s Back button to return to VAYU
						after banking.
					</p>
				</section>
			</PageShellContent>
		</PageShell>
	);
}
