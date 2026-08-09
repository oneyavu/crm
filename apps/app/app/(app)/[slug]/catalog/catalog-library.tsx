"use client";

import { Badge } from "@crm/ui/components/badge";
import { Input } from "@crm/ui/components/input";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTRPC } from "@/lib/trpc/client";

const KINDS = [
	["", "All"],
	["DIGITAL_TOOL", "Digital tools"],
	["PLATFORM_CAPABILITY", "Platform"],
	["SERVICE", "Services"],
	["USE_CASE", "Use cases"],
	["AUTOMATION_PLAN", "Plans"],
] as const;

export function CatalogLibrary() {
	const trpc = useTRPC();
	const [q, setQ] = useState("");
	const [kind, setKind] = useState("");
	const catalog = useQuery(
		trpc.catalog.list.queryOptions({ q, kind: (kind || null) as never }),
	);
	return (
		<div className="flex flex-col gap-5">
			<div className="grid gap-3 md:grid-cols-[1fr_auto]">
				<Input
					type="search"
					value={q}
					onChange={(event) => setQ(event.target.value)}
					placeholder="Search VAYU offerings, outcomes or categories"
					aria-label="Search catalog"
				/>
				<div className="flex flex-wrap gap-2">
					{KINDS.map(([value, label]) => (
						<button
							key={value}
							type="button"
							onClick={() => setKind(value)}
							className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${kind === value ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
						>
							{label}
						</button>
					))}
				</div>
			</div>
			<div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
				{(catalog.data ?? []).map((item) => (
					<article
						key={item.id}
						className="flex flex-col gap-4 rounded-lg border bg-card p-5"
					>
						<div className="flex items-start justify-between gap-3">
							<div>
								<p className="font-mono text-primary text-xs">{item.code}</p>
								<h2 className="mt-1 font-medium">{item.name}</h2>
							</div>
							<Badge variant="outline">{item.category}</Badge>
						</div>
						<p className="text-muted-foreground text-sm/relaxed">
							{item.summary}
						</p>
						{item.operatingProblem ? (
							<div className="rounded-md bg-muted/60 p-3">
								<p className="font-medium text-xs">Operating problem</p>
								<p className="mt-1 text-muted-foreground text-xs/relaxed">
									{item.operatingProblem}
								</p>
							</div>
						) : null}
						{item.capabilities.length > 0 ? (
							<div className="flex flex-wrap gap-1.5">
								{item.capabilities.map((capability) => (
									<Badge key={capability} variant="secondary">
										{capability}
									</Badge>
								))}
							</div>
						) : null}
						{item.measures.length > 0 ? (
							<p className="mt-auto text-muted-foreground text-xs">
								<span className="font-medium text-foreground">Measures:</span>{" "}
								{item.measures.join(" · ")}
							</p>
						) : null}
						{item.investmentPath ? (
							<p className="text-xs">
								<span className="text-muted-foreground">Investment path:</span>{" "}
								{item.investmentPath}
							</p>
						) : null}
					</article>
				))}
			</div>
		</div>
	);
}
