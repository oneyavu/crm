import { z } from "zod";

export const notificationListInput = z.object({
	limit: z.number().int().min(1).max(100).default(30),
});

export const notificationIdInput = z.object({ id: z.string().min(1) });
