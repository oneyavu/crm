"use client";

import { authClient } from "@crm/auth/client";
import { Button } from "@crm/ui/components/button";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import { CredentialsForm, SignUpForm } from "../sign-in/credentials-form";

export function InviteAcceptance({
	type,
	token,
	email,
}: {
	type: "staff" | "client";
	token: string;
	email: string;
}) {
	const session = authClient.useSession();
	const [mode, setMode] = useState<"signup" | "signin">("signup");
	const trpc = useTRPC();
	const staff = useMutation(trpc.workspace.acceptInvitation.mutationOptions());
	const client = useMutation(trpc.portal.acceptInvite.mutationOptions());
	const callbackPath = `/accept-invite?type=${type}&token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
	if (!token || !email)
		return (
			<p className="text-sm text-destructive">
				This invitation link is incomplete.
			</p>
		);
	if (session.isPending)
		return (
			<p className="text-sm text-muted-foreground">Checking your account…</p>
		);
	if (!session.data)
		return (
			<div className="flex flex-col gap-4">
				{mode === "signup" ? (
					<SignUpForm email={email} callbackPath={callbackPath} />
				) : (
					<CredentialsForm invitedEmail={email} callbackPath={callbackPath} />
				)}
				<Button
					variant="ghost"
					onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
				>
					{mode === "signup"
						? "Already have an account? Sign in"
						: "New here? Create account"}
				</Button>
			</div>
		);
	return (
		<div className="flex flex-col gap-3">
			<p className="text-sm text-muted-foreground">
				Signed in as {session.data.user.email}
			</p>
			<Button
				disabled={staff.isPending || client.isPending}
				onClick={async () => {
					try {
						if (type === "staff") await staff.mutateAsync({ id: token });
						else await client.mutateAsync({ token });
						window.location.assign(type === "staff" ? "/" : "/client");
					} catch (error) {
						toast.error(
							error instanceof Error
								? error.message
								: "Invitation could not be accepted.",
						);
					}
				}}
			>
				Accept and continue
			</Button>
		</div>
	);
}
