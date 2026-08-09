"use client";

import { authClient } from "@crm/auth/client";
import { Button } from "@crm/ui/components/button";
import { Input } from "@crm/ui/components/input";
import { Label } from "@crm/ui/components/label";
import { useState } from "react";
import { toast } from "sonner";

export function ResetPasswordForm({ token }: { token: string }) {
	const [password, setPassword] = useState("");
	const [pending, setPending] = useState(false);
	const [done, setDone] = useState(false);

	if (done) {
		return (
			<Button onClick={() => window.location.assign("/sign-in")}>
				Return to sign in
			</Button>
		);
	}

	return (
		<form
			className="flex flex-col gap-4"
			onSubmit={async (event) => {
				event.preventDefault();
				setPending(true);
				const result = await authClient.resetPassword({
					newPassword: password,
					token,
				});
				setPending(false);
				if (result.error) {
					toast.error(result.error.message ?? "Password could not be reset.");
				} else {
					setDone(true);
				}
			}}
		>
			<div className="flex flex-col gap-2">
				<Label htmlFor="password">New password</Label>
				<Input
					id="password"
					type="password"
					minLength={10}
					value={password}
					onChange={(event) => setPassword(event.target.value)}
					required
				/>
			</div>
			<Button disabled={pending || !token}>
				{pending ? "Saving…" : "Save password"}
			</Button>
		</form>
	);
}
