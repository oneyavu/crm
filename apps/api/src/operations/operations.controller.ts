import type { auth } from "@crm/auth";
import { Controller, Get, Param, Res, StreamableFile } from "@nestjs/common";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import type { Response } from "express";
import { OperationsService } from "./operations.service";

type CrmSession = UserSession<typeof auth>;

@Controller("api/operations/documents")
export class OperationsController {
	constructor(private readonly operations: OperationsService) {}
	@Get(":id")
	async download(
		@Param("id") id: string,
		@Session() _session: CrmSession,
		@Res({ passthrough: true }) response: Response,
	) {
		const document = await this.operations.documentContent(id);
		const content = Buffer.from(document.content);
		response.setHeader("Cache-Control", "private, no-store");
		response.setHeader("Content-Length", content.byteLength.toString());
		response.setHeader(
			"Content-Type",
			document.mediaType || "application/octet-stream",
		);
		response.setHeader(
			"Content-Disposition",
			`attachment; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
		);
		response.setHeader("X-Content-Type-Options", "nosniff");
		return new StreamableFile(content);
	}
}
