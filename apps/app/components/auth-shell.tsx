import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { AuthShader } from "@/components/auth-shader";
import { VayuMark, VayuWordmark } from "@/components/vayu-brand";

export function AuthShell({
	children,
	variant = "staff",
}: {
	children: ReactNode;
	variant?: "staff" | "client";
}) {
	return (
		<main className="dark grid min-h-svh bg-background text-foreground lg:grid-cols-[minmax(0,1fr)_minmax(420px,520px)]">
			<section className="relative hidden min-h-svh overflow-hidden bg-[#071b17] p-8 lg:flex lg:flex-col lg:justify-between xl:p-12">
				{variant === "client" ? (
					<>
						<Image
							src="/brand/vayu-platform-engineering.webp"
							alt="Modular platform and operations environment"
							fill
							priority
							sizes="70vw"
							className="object-cover object-center"
						/>
						<div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,10,8,.94)_0%,rgba(5,10,8,.66)_48%,rgba(5,10,8,.18)_100%),linear-gradient(0deg,rgba(5,10,8,.78),transparent_55%)]" />
						<div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_35%,rgba(108,211,44,.18),transparent_34%)]" />
					</>
				) : (
					<AuthShader />
				)}

				<div className="relative flex gap-2 text-sm/5">
					<Link href="/" aria-label="Homepage" className="flex">
						<VayuWordmark className="text-white" />
					</Link>
				</div>

				<div className="relative flex max-w-lg flex-col gap-8">
					<div className="flex flex-col gap-4">
						<p className="font-mono text-xs/4 text-[#8df267] uppercase">
							{variant === "client" ? "CLIENT CONTROL" : "OPERATIONS"}
						</p>
						<h1 className="max-w-[14ch] text-5xl/14 font-semibold text-balance">
							{variant === "client"
								? "One secure view of every project, invoice and request."
								: "Data connected. Decisions visible. Work moving."}
						</h1>
						{variant === "client" ? (
							<div className="mt-3 grid max-w-xl grid-cols-3 gap-2 text-xs">
								<div className="rounded-xl border border-white/10 bg-black/30 p-3 backdrop-blur">
									<span className="text-[#8df267]">01</span>
									<p className="mt-2 text-white/65">Delivery status</p>
								</div>
								<div className="rounded-xl border border-white/10 bg-black/30 p-3 backdrop-blur">
									<span className="text-[#8df267]">02</span>
									<p className="mt-2 text-white/65">Billing control</p>
								</div>
								<div className="rounded-xl border border-white/10 bg-black/30 p-3 backdrop-blur">
									<span className="text-[#8df267]">03</span>
									<p className="mt-2 text-white/65">Service support</p>
								</div>
							</div>
						) : null}
					</div>
				</div>

				<p className="relative font-mono text-xs/4 text-muted-foreground">
					Jamaica · Caribbean · Latin America
				</p>
			</section>

			<section className="flex min-h-svh flex-col bg-background px-6 py-8 sm:px-10 lg:px-14">
				<div className="flex gap-2 text-sm/5 max-lg:hidden lg:invisible">
					<VayuMark className="size-7 shrink-0" />
				</div>

				<div className="flex flex-1 items-center justify-center py-12">
					<div className="flex w-full max-w-sm flex-col gap-8">{children}</div>
				</div>
			</section>
		</main>
	);
}

export function AuthHeading({
	title,
	description,
}: {
	title: string;
	description: ReactNode;
}) {
	return (
		<div className="flex flex-col gap-3 text-left">
			<Link href="/" aria-label="Homepage" className="flex">
				<VayuMark className="size-8 shrink-0" />
			</Link>
			<div className="flex flex-col gap-1">
				<h2 className="text-2xl/8 font-semibold tracking-tight text-balance">
					{title}
				</h2>
				<p className="max-w-[32ch] text-sm/5 text-muted-foreground text-pretty">
					{description}
				</p>
			</div>
		</div>
	);
}
