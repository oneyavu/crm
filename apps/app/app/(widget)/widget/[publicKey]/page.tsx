import { PublicSupportWidget } from "./public-support-widget";

export const instant = false;

export default async function WidgetPage({
	params,
	searchParams,
}: PageProps<"/widget/[publicKey]">) {
	const [{ publicKey }, query] = await Promise.all([params, searchParams]);
	return (
		<PublicSupportWidget
			publicKey={publicKey}
			host={typeof query.host === "string" ? query.host : ""}
		/>
	);
}
