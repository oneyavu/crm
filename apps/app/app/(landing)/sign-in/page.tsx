import type { MailboxProviderId } from "@crm/auth/scopes";
import type { Metadata } from "next";
import { redirect, unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AuthHeading, AuthShell } from "@/components/auth-shell";
import { getSession } from "@/lib/session";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";
import { CredentialsForm } from "./credentials-form";
import { SocialSignIn } from "./social-sign-in";
import { type SsoProvider, SsoSignIn } from "./sso-sign-in";

export const metadata: Metadata = {
	title: "Sign in",
};

type SignInOptions = {
	google: boolean;
	microsoft: boolean;
	providers: SsoProvider[];
};

async function signInOptions(): Promise<SignInOptions | null> {
	try {
		return await getServerQueryClient().fetchQuery(
			getServerTrpc().sso.signInOptions.queryOptions(),
		);
	} catch (error) {
		unstable_rethrow(error);
		console.error("Sign-in: could not read the sign-in options.", error);
		return null;
	}
}

export default async function SignInPage({
	searchParams,
}: PageProps<"/sign-in">) {
	await connection();
	const { callbackURL } = await searchParams;
	const clientPortal =
		typeof callbackURL === "string" && callbackURL.startsWith("/client");
	return (
		<AuthShell variant={clientPortal ? "client" : "staff"}>
			<Suspense
				fallback={
					<AuthHeading
						title="Welcome back"
						description="Sign in with your account to continue."
					/>
				}
			>
				<SignIn searchParams={searchParams} />
			</Suspense>
		</AuthShell>
	);
}

async function SignIn({
	searchParams,
}: Pick<PageProps<"/sign-in">, "searchParams">) {
	const [session, options, { method, callbackURL }] = await Promise.all([
		getSession().catch((error: unknown) => {
			unstable_rethrow(error);
			console.error("Sign-in: could not read the session.", error);
			return null;
		}),
		signInOptions(),
		searchParams,
	]);

	if (session) {
		redirect("/");
	}

	const configured: MailboxProviderId[] = [];
	if (options?.google ?? true) configured.push("google");
	if (options?.microsoft ?? false) configured.push("microsoft");

	const providers = options?.providers ?? [];
	const callbackPath =
		typeof callbackURL === "string" &&
		(callbackURL.startsWith("/client") ||
			callbackURL.startsWith("/accept-invite"))
			? callbackURL
			: "/";

	const insisted = configured.find((provider) => provider === method);
	const clientPortal = callbackPath.startsWith("/client");
	const showSso =
		!clientPortal && providers.length > 0 && insisted === undefined;
	const social = clientPortal
		? configured
		: insisted !== undefined
			? [insisted]
			: providers.length === 0
				? configured
				: [];

	if (process.env.NEXT_PUBLIC_DISABLE_PASSWORD_AUTH === "true") {
		return (
			<>
				<AuthHeading
					title="No way in yet"
					description="This CRM has no sign-in method configured, so nobody can get in — including you."
				/>

				<p className="text-center text-muted-foreground text-sm/5">
					Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET — or MICROSOFT_CLIENT_ID
					and MICROSOFT_CLIENT_SECRET — in the root .env file and restart. Your
					own identity provider can be added from Settings once somebody is
					signed in.
				</p>
			</>
		);
	}

	return (
		<>
			<AuthHeading
				title={clientPortal ? "Client portal" : "Welcome back"}
				description={
					clientPortal
						? "Sign in to manage projects, invoices, service requests and account updates."
						: "Sign in with your account to continue."
				}
			/>
			<CredentialsForm callbackPath={callbackPath} />
			{showSso || social.length > 0 ? (
				<div className="flex items-center gap-3 text-xs text-muted-foreground">
					<span className="h-px flex-1 bg-border" />
					or continue with
					<span className="h-px flex-1 bg-border" />
				</div>
			) : null}

			{showSso ? (
				<SsoSignIn providers={providers} callbackPath={callbackPath} />
			) : null}
			{social.map((provider) => (
				<SocialSignIn
					key={provider}
					provider={provider}
					callbackPath={callbackPath}
				/>
			))}
		</>
	);
}
