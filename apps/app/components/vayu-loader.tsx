import { cn } from "@crm/ui/lib/utils";
import { VayuMark } from "@/components/vayu-brand";

export function VayuLoader({ className }: { className?: string }) {
	return (
		<div
			role="status"
			aria-label="Loading"
			className={cn("flex flex-col items-center gap-4", className)}
		>
			<div className="relative grid size-20 place-items-center">
				<div className="absolute inset-0 animate-spin rounded-full border-2 border-[#c9a227]/20 border-r-[#f2d675] border-t-[#c9a227] shadow-[0_0_24px_rgba(201,162,39,.18)] [animation-duration:1.15s]" />
				<div className="absolute inset-2 rounded-full border border-[#f2d675]/15 bg-[#090a0a]" />
				<VayuMark className="relative size-11" />
			</div>
			<span className="sr-only">Loading interface</span>
		</div>
	);
}
