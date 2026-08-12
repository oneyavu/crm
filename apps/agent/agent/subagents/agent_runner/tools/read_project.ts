import { defineTool } from "eve/tools";
import { z } from "zod";
import { readRunProject } from "../../../lib/run-runtime";
import { requireTeamAgentAttribute } from "../../../lib/session-purpose";

export default defineTool({
	description:
		"Read the complete V-OS dossier for a project in this deployed agent version's approved workspace scope, including project work and AI usage. Read-only.",
	inputSchema: z.object({ projectId: z.string().min(1) }),
	async execute(input, ctx) {
		return readRunProject(
			requireTeamAgentAttribute(ctx, "runId"),
			input.projectId,
		);
	},
});
