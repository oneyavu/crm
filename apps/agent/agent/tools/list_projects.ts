import { defineTool } from "eve/tools";
import { z } from "zod";
import { listProjectsForAgent } from "../lib/projects";
import { assertResearchPurpose } from "../lib/session-purpose";

export default defineTool({
	description:
		"List V-OS projects with client, project manager, status, progress, and work counts. Use this before read_project when the user names a project but its id is unknown. Free and read-only.",
	inputSchema: z.object({
		query: z.string().trim().max(160).optional(),
		status: z.string().trim().max(40).default("all"),
		limit: z.number().int().min(1).max(100).default(50),
	}),
	async execute(input, ctx) {
		assertResearchPurpose(ctx);
		return listProjectsForAgent(input);
	},
});
