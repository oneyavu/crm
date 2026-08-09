import { z } from "zod";

export const paperclipAgentInput = z.object({ agentId: z.string().uuid() });
export const paperclipInstructionInput = paperclipAgentInput.extend({
	message: z.string().trim().min(1).max(8000),
});
export const paperclipApprovalInput = z.object({
	approvalId: z.string().uuid(),
	action: z.enum(["approve", "reject", "request-revision"]),
	note: z.string().trim().max(2000).optional(),
});
export const paperclipWorkflowInput = z.object({
	routineId: z.string().uuid(),
	payload: z.record(z.string(), z.unknown()).default({}),
});
