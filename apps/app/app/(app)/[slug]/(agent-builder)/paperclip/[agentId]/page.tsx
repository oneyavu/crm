import type { Metadata } from "next";
import { PaperclipAgentDetail } from "@/components/agent-builder/paperclip-agent-detail";

export const metadata: Metadata = { title: "Paperclip agent" };
export const instant = false;

export default async function PaperclipAgentPage({
	params,
}: {
	params: Promise<{ agentId: string }>;
}) {
	const { agentId } = await params;
	return <PaperclipAgentDetail agentId={agentId} />;
}
