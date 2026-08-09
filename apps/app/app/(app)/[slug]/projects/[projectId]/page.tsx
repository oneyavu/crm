import { requireSession } from "@/lib/session";
import { ProjectBoard } from "./project-board";

export const instant = false;

export default async function ProjectPage({
	params,
}: {
	params: Promise<{ projectId: string }>;
}) {
	await requireSession();
	const { projectId } = await params;
	return <ProjectBoard projectId={projectId} />;
}
