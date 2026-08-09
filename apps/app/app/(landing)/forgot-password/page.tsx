"use client";

import { authClient } from "@crm/auth/client";
import { Button } from "@crm/ui/components/button";
import { Input } from "@crm/ui/components/input";
import { Label } from "@crm/ui/components/label";
import { useState } from "react";
import { toast } from "sonner";
import { AuthHeading, AuthShell } from "@/components/auth-shell";

export default function ForgotPasswordPage() {
	const [email, setEmail] = useState("");
	const [pending, setPending] = useState(false);
	const [sent, setSent] = useState(false);
	return (
		<AuthShell>
			<AuthHeading
				title="Reset your password"
				description="We will email you a secure password reset link."
			/>
			{sent ? (
				<p className="text-sm text-muted-foreground">
					If an account exists for that email, a reset link is on its way.
				</p>
			) : (
				<form
					className="flex flex-col gap-4"
					onSubmit={async (event) => {
						event.preventDefault();
						setPending(true);
						const result = await authClient.requestPasswordReset({
							email,
							redirectTo: "/reset-password",
						});
						setPending(false);
						if (result.error)
							toast.error(
								result.error.message ?? "Reset email could not be sent.",
							);
						else setSent(true);
					}}
				>
					<div className="flex flex-col gap-2">
						<Label htmlFor="email">Email</Label>
						<Input
							id="email"
							type="email"
							value={email}
							onChange={(event) => setEmail(event.target.value)}
							required
						/>
					</div>
					<Button disabled={pending}>
						{pending ? "Sending…" : "Send reset link"}
					</Button>
				</form>
			)}
		</AuthShell>
	);
}
