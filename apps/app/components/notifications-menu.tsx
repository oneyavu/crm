"use client";

import Notification from "@carbon/icons-react/es/Notification";
import { Button } from "@crm/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

export function NotificationsMenu() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const workspaceUrl = useWorkspaceUrl();
	const notifications = useQuery({
		...trpc.notifications.list.queryOptions({ limit: 12 }),
		refetchInterval: 60_000,
	});
	const markAll = useMutation(
		trpc.notifications.markAllRead.mutationOptions({
			onSuccess: () =>
				queryClient.invalidateQueries({
					queryKey: trpc.notifications.list.queryKey(),
				}),
		}),
	);
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="relative"
					aria-label={`Notifications${notifications.data?.unread ? `, ${notifications.data.unread} unread` : ""}`}
				>
					<Notification />
					{notifications.data?.unread ? (
						<span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] text-primary-foreground">
							{Math.min(notifications.data.unread, 9)}
						</span>
					) : null}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-80">
				<div className="flex items-center justify-between px-2 py-1.5">
					<DropdownMenuLabel className="p-0">Updates</DropdownMenuLabel>
					{notifications.data?.unread ? (
						<button
							type="button"
							className="text-primary text-xs hover:underline"
							onClick={() => markAll.mutate()}
						>
							Mark all read
						</button>
					) : null}
				</div>
				<DropdownMenuSeparator />
				{(notifications.data?.rows ?? []).map((item) => (
					<DropdownMenuItem key={item.id} asChild>
						<Link
							href={workspaceUrl(item.href ?? "/")}
							className="flex-col items-start gap-1 py-2"
						>
							<span className="font-medium text-xs">{item.title}</span>
							<span className="line-clamp-2 text-muted-foreground text-xs">
								{item.body}
							</span>
						</Link>
					</DropdownMenuItem>
				))}
				{notifications.data?.rows.length === 0 ? (
					<p className="p-6 text-center text-muted-foreground text-xs">
						No updates yet.
					</p>
				) : null}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
