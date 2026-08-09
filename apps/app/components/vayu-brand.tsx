import { cn } from "@crm/ui/lib/utils";
import Image from "next/image";

export function VayuMark({ className }: { className?: string }) {
	return (
		<Image
			src="/vayu-site-icon-512.png"
			alt="VAYU"
			width={512}
			height={512}
			className={cn("rounded-[22%]", className)}
			priority
		/>
	);
}

export function VayuWordmark({ className }: { className?: string }) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-2 font-semibold tracking-[0.18em]",
				className,
			)}
		>
			<VayuMark className="size-6" />
			<span>VAYU</span>
		</span>
	);
}
