import { AuthHeading, AuthShell } from "@/components/auth-shell";
import { InviteAcceptance } from "./invite-acceptance";

export const instant = false;

export default async function AcceptInvitePage({
	searchParams,
}: PageProps<"/accept-invite">) {
	const { type, token, email } = await searchParams;
	return (
		<AuthShell>
			<AuthHeading
				title="Accept your invitation"
				description="Create a password or sign in with the invited email address."
			/>
			<InviteAcceptance
				type={type === "client" ? "client" : "staff"}
				token={typeof token === "string" ? token : ""}
				email={typeof email === "string" ? email : ""}
			/>
		</AuthShell>
	);
}
