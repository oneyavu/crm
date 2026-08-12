import { defineTool } from "eve/tools";
import { z } from "zod";
import { readProjectForAgent } from "../lib/projects";
import { assertResearchPurpose } from "../lib/session-purpose";

export default defineTool({
	description:
		"Read a complete V-OS project dossier: manager and team, phases, tasks, dependencies, comments, milestones, time, meetings, requests, documents, invoices, and AI token/cost usage. Free and read-only.",
	inputSchema: z.object({ projectId: z.string().min(1) }),
	async execute({ projectId }, ctx) {
		assertResearchPurpose(ctx);
		const project = await readProjectForAgent(projectId);
		return project ?? { error: "Project not found." };
	},
});
