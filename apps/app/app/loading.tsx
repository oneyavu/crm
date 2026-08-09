import { VayuLoader } from "@/components/vayu-loader";

export default function Loading() {
	return (
		<div className="grid min-h-svh place-items-center bg-[#090a0a]">
			<VayuLoader />
		</div>
	);
}
