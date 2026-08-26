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
import { requireWorkspaceAdmin } from "@/lib/session";

const SCOTIABANK_SMALL_BUSINESS =
	"https://jm.scotiabank.com/small-business.html";
const SENDANA_SIGN_IN = "https://app.usesendana.com/signin";

export const metadata: Metadata = { title: "Banking" };
export const instant = false;

export default async function BankingPage() {
	await requireWorkspaceAdmin();

	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Banking & payment platforms</PageShellTitle>
					<PageShellDescription>
						Admin-only access to VAYU&apos;s approved financial workspaces.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>

			<PageShellContent>
				<section className="mx-auto flex w-full max-w-6xl flex-col gap-8 py-4">
					<div className="overflow-hidden rounded-2xl border border-border bg-card">
						<div className="border-b border-border bg-[linear-gradient(120deg,rgba(123,255,90,0.16),rgba(85,217,189,0.09))] px-6 py-6 sm:px-9">
							<p className="text-sm font-medium text-emerald-400">Sendana</p>
							<h2 className="mt-2 font-medium text-2xl tracking-tight">
								Payment operations
							</h2>
							<p className="mt-2 max-w-3xl text-muted-foreground text-sm leading-6">
								Sign in and work in Sendana without leaving the V-OS banking
								section. Credentials remain controlled by Sendana and are never
								stored by the CRM.
							</p>
						</div>
						<iframe
							title="Sendana payment platform"
							src={SENDANA_SIGN_IN}
							className="h-[72svh] min-h-[620px] w-full bg-white"
							allow="clipboard-read; clipboard-write"
							sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads"
							referrerPolicy="strict-origin-when-cross-origin"
						/>
						<div className="flex flex-col gap-3 border-t border-border px-6 py-4 text-muted-foreground text-xs sm:flex-row sm:items-center sm:justify-between sm:px-9">
							<p>
								If Sendana blocks the embedded session, use its official secure
								sign-in in a new tab.
							</p>
							<Button asChild variant="outline" size="sm">
								<a
									href={SENDANA_SIGN_IN}
									target="_blank"
									rel="noopener noreferrer"
								>
									Open Sendana securely <Icon icon={Launch} />
								</a>
							</Button>
						</div>
					</div>

					<div className="overflow-hidden rounded-2xl border border-border bg-card">
						<div className="border-b border-border bg-[linear-gradient(120deg,rgba(123,255,90,0.16),rgba(85,217,189,0.09))] px-6 py-8 sm:px-9">
							<p className="text-sm font-medium text-muted-foreground">
								Scotiabank Jamaica
							</p>
							<h2 className="mt-2 max-w-2xl text-balance font-medium text-3xl tracking-tight sm:text-4xl">
								Scotiabank business banking
							</h2>
							<p className="mt-4 max-w-2xl text-pretty text-muted-foreground leading-6">
								Review Scotiabank small-business services, follow its links and
								sign in through the bank&apos;s official website. Scotiabank
								opens in a separate tab while this VAYU banking workspace stays
								open.
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
								<a
									href={SCOTIABANK_SMALL_BUSINESS}
									target="_blank"
									rel="noopener noreferrer"
								>
									Continue to Scotiabank
									<Icon icon={Launch} />
								</a>
							</Button>
						</div>
					</div>

					<p className="max-w-3xl text-muted-foreground text-sm leading-6">
						Scotiabank permits its pages to be framed only by Scotiabank-owned
						domains. For your security, the bank page cannot remain inside the
						CRM frame. The official bank site opens separately, and this VAYU
						workspace remains available here.
					</p>
				</section>
			</PageShellContent>
		</PageShell>
	);
}
