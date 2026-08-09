import { AuthHeading, AuthShell } from "@/components/auth-shell";
import { ResetPasswordForm } from "./reset-password-form";

export const instant = false;

export default async function ResetPasswordPage({
	searchParams,
}: PageProps<"/reset-password">) {
	const { token } = await searchParams;
	return (
		<AuthShell>
			<AuthHeading
				title="Choose a new password"
				description="Use at least 10 characters."
			/>
			<ResetPasswordForm token={typeof token === "string" ? token : ""} />
		</AuthShell>
	);
}
