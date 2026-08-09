"use client";

import { authClient } from "@crm/auth/client";
import { Button } from "@crm/ui/components/button";
import { Input } from "@crm/ui/components/input";
import { Label } from "@crm/ui/components/label";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

export function CredentialsForm({
	callbackPath = "/",
	invitedEmail,
}: {
	callbackPath?: string;
	invitedEmail?: string;
}) {
	const [email, setEmail] = useState(invitedEmail ?? "");
	const [password, setPassword] = useState("");
	const [pending, setPending] = useState(false);
	return (
		<form
			className="flex flex-col gap-4"
			onSubmit={async (event) => {
				event.preventDefault();
				setPending(true);
				const result = await authClient.signIn.email({
					email,
					password,
					callbackURL: callbackPath,
				});
				setPending(false);
				if (result.error)
					toast.error(result.error.message ?? "Sign in failed.");
			}}
		>
			<div className="flex flex-col gap-2">
				<Label htmlFor="email">Email</Label>
				<Input
					id="email"
					type="email"
					autoComplete="email"
					value={email}
					onChange={(event) => setEmail(event.target.value)}
					required
					readOnly={Boolean(invitedEmail)}
				/>
			</div>
			<div className="flex flex-col gap-2">
				<div className="flex justify-between">
					<Label htmlFor="password">Password</Label>
					<Link
						className="text-xs text-primary hover:underline"
						href="/forgot-password"
					>
						Forgot password?
					</Link>
				</div>
				<Input
					id="password"
					type="password"
					autoComplete="current-password"
					value={password}
					onChange={(event) => setPassword(event.target.value)}
					required
				/>
			</div>
			<Button type="submit" disabled={pending}>
				{pending ? "Signing in…" : "Sign in with email"}
			</Button>
		</form>
	);
}

export function SignUpForm({
	email,
	callbackPath,
}: {
	email: string;
	callbackPath: string;
}) {
	const [name, setName] = useState("");
	const [password, setPassword] = useState("");
	const [pending, setPending] = useState(false);
	return (
		<form
			className="flex flex-col gap-4"
			onSubmit={async (event) => {
				event.preventDefault();
				setPending(true);
				const result = await authClient.signUp.email({
					name,
					email,
					password,
					callbackURL: callbackPath,
				});
				setPending(false);
				if (result.error)
					toast.error(result.error.message ?? "Account creation failed.");
			}}
		>
			<div className="flex flex-col gap-2">
				<Label htmlFor="name">Full name</Label>
				<Input
					id="name"
					value={name}
					onChange={(event) => setName(event.target.value)}
					autoComplete="name"
					required
				/>
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor="invite-email">Invited email</Label>
				<Input id="invite-email" type="email" value={email} readOnly />
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor="new-password">Create password</Label>
				<Input
					id="new-password"
					type="password"
					minLength={10}
					value={password}
					onChange={(event) => setPassword(event.target.value)}
					autoComplete="new-password"
					required
				/>
				<p className="text-xs text-muted-foreground">At least 10 characters.</p>
			</div>
			<Button type="submit" disabled={pending}>
				{pending ? "Creating account…" : "Create account"}
			</Button>
		</form>
	);
}
