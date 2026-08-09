import { cn } from "@crm/ui/lib/utils";
import Image from "next/image";

export function VayuMark({ className }: { className?: string }) {
	return (
		<Image
			src="/vayu-site-icon-512.png"
			alt="Company logo"
			width={512}
			height={512}
			className={cn("rounded-[22%]", className)}
			priority
		/>
	);
}

export function VayuWordmark({ className }: { className?: string }) {
	return <VayuMark className={cn("size-8", className)} />;
}
