import { defineTool } from "eve/tools";
import { z } from "zod";
import { listRunProjects } from "../../../lib/run-runtime";
import { requireTeamAgentAttribute } from "../../../lib/session-purpose";

export default defineTool({
	description:
		"List V-OS projects in this deployed agent version's approved workspace scope. Returns project ids for read_project. Read-only.",
	inputSchema: z.object({
		query: z.string().trim().max(160).optional(),
		status: z.string().trim().max(40).default("all"),
		limit: z.number().int().min(1).max(100).default(50),
	}),
	async execute(input, ctx) {
		return listRunProjects(requireTeamAgentAttribute(ctx, "runId"), input);
	},
});
