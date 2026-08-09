"use client";

import { signIn } from "@crm/auth/client";
import type { MailboxProviderId } from "@crm/auth/scopes";
import GoogleLogo from "@crm/ui/components/brand-logos/google";
import MicrosoftLogo from "@crm/ui/components/brand-logos/microsoft";
import { Button } from "@crm/ui/components/button";
import { Spinner } from "@crm/ui/components/spinner";
import { useState } from "react";
import { toast } from "sonner";

const PROVIDERS = {
	google: { label: "Continue with Google", Logo: GoogleLogo },
	microsoft: { label: "Continue with Microsoft", Logo: MicrosoftLogo },
} as const satisfies Record<MailboxProviderId, unknown>;

export function SocialSignIn({
	provider,
	callbackPath = "/",
}: {
	provider: MailboxProviderId;
	callbackPath?: string;
}) {
	const [pending, setPending] = useState(false);

	const { label, Logo } = PROVIDERS[provider];

	function fail(message?: string) {
		setPending(false);
		toast.error(message ?? "Could not reach the sign-in service.");
	}

	async function handleClick() {
		setPending(true);

		const origin = window.location.origin;
		const embedded = window.self !== window.top;
		const clientPortal = callbackPath.startsWith("/client");
		const publicPortalURL =
			process.env.NEXT_PUBLIC_CLIENT_PORTAL_URL ??
			"https://onevayu.com/service-portal/";
		const callbackURL =
			clientPortal && embedded ? publicPortalURL : `${origin}${callbackPath}`;
		const staffLoginPath =
			window.location.pathname === "/staff-login" ? "/staff-login" : "/sign-in";

		const { data, error } = await signIn.social({
			provider,
			callbackURL,
			errorCallbackURL:
				clientPortal && embedded
					? publicPortalURL
					: `${origin}${staffLoginPath}`,
			disableRedirect: embedded,
		});

		if (error) fail(error.message);
		else if (embedded && data?.url && window.top) {
			window.top.location.href = data.url;
		}
	}

	return (
		<Button
			className="w-full"
			disabled={pending}
			onClick={() => {
				handleClick().catch(() => fail());
			}}
			type="button"
			variant="outline"
		>
			{pending ? (
				<Spinner data-icon="inline-start" />
			) : (
				<Logo data-icon="inline-start" className="size-4" />
			)}
			{label}
		</Button>
	);
}
