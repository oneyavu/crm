import { randomUUID } from "node:crypto";
import type { Db, Prisma } from "@crm/db";
import {
	Injectable,
	Logger,
	type NestMiddleware,
	Optional,
} from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { InjectDatabase } from "../database/database.constants";
import { type RequestContext, runInRequestContext } from "./request-context";

const REQUEST_ID_HEADER = "x-request-id";

const QUIET_PATHS = new Set(["/health"]);

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
	private readonly logger = new Logger("HTTP");
	constructor(@Optional() @InjectDatabase() private readonly db?: Db) {}

	use(request: Request, response: Response, next: NextFunction): void {
		const requestId = incomingRequestId(request) ?? randomUUID();
		response.setHeader(REQUEST_ID_HEADER, requestId);

		const context: RequestContext = {
			requestId,
			method: request.method,
			path: request.path,
		};
		const startedAt = process.hrtime.bigint();

		runInRequestContext(context, () => {
			response.on("finish", () => {
				runInRequestContext(context, () => {
					this.logCompleted(request, response, context, startedAt);
				});
			});

			next();
		});
	}

	private logCompleted(
		request: Request,
		response: Response,
		context: RequestContext,
		startedAt: bigint,
	): void {
		const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
		const { statusCode } = response;

		const userId = sessionUserId(request);

		if (userId) {
			context.userId = userId;
		}
		const actorId = context.userId;

		const payload = {
			message: `${context.method} ${context.path} ${statusCode} ${durationMs.toFixed(1)}ms`,
			method: context.method,
			path: context.path,
			statusCode,
			durationMs: Number(durationMs.toFixed(1)),
			ip: request.ip,
			userAgent: request.get("user-agent"),
		};
		if (actorId && this.db && !QUIET_PATHS.has(request.path)) {
			void this.persistActivity(
				request,
				context,
				statusCode,
				durationMs,
				actorId,
			);
		}

		if (statusCode >= 500) {
			this.logger.error(payload);
			return;
		}

		if (statusCode >= 400) {
			this.logger.warn(payload);
			return;
		}

		if (QUIET_PATHS.has(request.path)) {
			this.logger.verbose(payload);
			return;
		}

		this.logger.log(payload);
	}

	private async persistActivity(
		request: Request,
		context: RequestContext,
		statusCode: number,
		durationMs: number,
		actorId: string,
	) {
		try {
			const member = await this.db?.member.findFirst({
				where: { userId: actorId },
				select: { role: true },
			});
			await this.db?.auditEntry.create({
				data: {
					entityType: "PlatformActivity",
					entityId: context.requestId,
					action: `${context.method} ${request.path}`.slice(0, 500),
					actorId,
					summary:
						`${context.method} ${request.path} returned ${statusCode}`.slice(
							0,
							1000,
						),
					after: safeJson({
						role: member?.role ?? "unknown",
						statusCode,
						durationMs: Number(durationMs.toFixed(1)),
						ip: clientIp(request),
						location: requestLocation(request),
						userAgent: request.get("user-agent")?.slice(0, 1000) ?? null,
						requestBytes: requestSize(request),
					}),
				},
			});
		} catch (error) {
			this.logger.warn({
				message: "Could not persist activity audit",
				requestId: context.requestId,
				error: error instanceof Error ? error.message : "unknown",
			});
		}
	}
}

function incomingRequestId(request: Request): string | undefined {
	const header = request.get(REQUEST_ID_HEADER);

	if (!header || header.length > 200 || !/^[\w.:-]+$/.test(header)) {
		return undefined;
	}

	return header;
}

const sharedInstance = new RequestLoggerMiddleware();

export function logAuthRoute(
	request: Request,
	response: Response,
	next: NextFunction,
): void {
	sharedInstance.use(request, response, next);
}

function clientIp(request: Request): string | null {
	return (
		request.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ??
		request.get("cf-connecting-ip")?.trim() ??
		request.ip ??
		null
	);
}

function requestLocation(request: Request) {
	return {
		country: request.get("x-vercel-ip-country")?.slice(0, 80) ?? null,
		region: request.get("x-vercel-ip-country-region")?.slice(0, 160) ?? null,
		city: request.get("x-vercel-ip-city")?.slice(0, 160) ?? null,
		timezone: request.get("x-vercel-ip-timezone")?.slice(0, 160) ?? null,
	};
}

function requestSize(request: Request): number | null {
	const value = request.get("content-length");
	const parsed = value ? Number(value) : Number.NaN;
	return Number.isFinite(parsed) ? parsed : null;
}

function safeJson(value: unknown): Prisma.InputJsonValue {
	return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function sessionUserId(request: Request): string | undefined {
	const { session } = request as Request & {
		session?: { user?: { id?: string } };
	};

	return session?.user?.id;
}
