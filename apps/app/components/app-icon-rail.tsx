"use client";

import Building from "@carbon/icons-react/es/Building";
import type { CarbonIconType } from "@carbon/icons-react/es/CarbonIcon";
import Catalog from "@carbon/icons-react/es/Catalog";
import Chat from "@carbon/icons-react/es/Chat";
import Close from "@carbon/icons-react/es/Close";
import Dashboard from "@carbon/icons-react/es/Dashboard";
import DataBase from "@carbon/icons-react/es/DataBase";
import Partnership from "@carbon/icons-react/es/Partnership";
import Receipt from "@carbon/icons-react/es/Receipt";
import Settings from "@carbon/icons-react/es/Settings";
import Task from "@carbon/icons-react/es/Task";
import UserMultiple from "@carbon/icons-react/es/UserMultiple";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@crm/ui/components/sheet";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@crm/ui/components/tooltip";
import { cn } from "@crm/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { AgentBuilderSidebar } from "@/components/agent-builder/agent-builder-sidebar";
import { usePrefetchSection } from "@/components/crm/section-prefetch";
import { useMobileNav } from "@/components/mobile-nav";
import { VayuWordmark } from "@/components/vayu-brand";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

type RailItem = {
	title: string;
	href: string;
	icon: CarbonIconType;
	match: "exact" | "prefix";
	related?: string[];
	external?: boolean;
	nested?: boolean;
	adminOnly?: boolean;
};

const ITEMS: RailItem[] = [
	{ title: "Overview", href: "/", icon: Dashboard, match: "exact" },
	{
		title: "Chat",
		href: "/chat",
		icon: Chat,
		match: "prefix",
		related: ["/agents"],
	},
	{
		title: "Client Management",
		href: "/clients",
		icon: Building,
		match: "prefix",
	},
	{
		title: "Contacts",
		href: "/contacts",
		icon: UserMultiple,
		match: "prefix",
	},
	{ title: "Deals", href: "/deals", icon: Partnership, match: "prefix" },
	{ title: "Projects", href: "/projects", icon: Task, match: "prefix" },
	{
		title: "Invoices & AI Builder",
		href: "/invoices",
		icon: Receipt,
		match: "prefix",
	},
	{
		title: "BNS Online Banking",
		href: "/banking",
		icon: Receipt,
		match: "prefix",
		nested: true,
		adminOnly: true,
	},
	{ title: "Records", href: "/records", icon: DataBase, match: "prefix" },
	{
		title: "Business Operations",
		href: "/operations",
		icon: Dashboard,
		match: "prefix",
		adminOnly: true,
	},
	{ title: "Widget Studio", href: "/support", icon: Chat, match: "prefix" },
	{
		title: "Service Portfolio",
		href: "/catalog",
		icon: Catalog,
		match: "prefix",
	},
	{
		title: "Settings",
		href: "/settings",
		icon: Settings,
		match: "prefix",
		adminOnly: true,
	},
];

function isActive(item: RailItem, pathname: string): boolean {
	if (item.external) return false;
	return (
		pathname === item.href ||
		(item.match === "prefix" && pathname.startsWith(item.href)) ||
		Boolean(item.related?.some((prefix) => pathname.startsWith(prefix)))
	);
}

function RailLink({
	item,
	active,
	onPrefetch,
}: {
	item: RailItem;
	active: boolean;
	onPrefetch: () => void;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					asChild
					variant="ghost"
					className={cn(
						"w-full justify-start gap-3 px-3 text-muted-foreground",
						item.nested && "ml-5 w-[calc(100%-1.25rem)] text-xs",
						active &&
							"bg-muted text-foreground hover:bg-muted hover:text-foreground",
					)}
				>
					<Link
						href={item.href}
						prefetch={!item.external}
						target={item.external ? "_blank" : undefined}
						rel={item.external ? "noreferrer" : undefined}
						onMouseEnter={onPrefetch}
						onFocus={onPrefetch}
						aria-current={active ? "page" : undefined}
						transitionTypes={["nav-lateral"]}
					>
						<Icon icon={item.icon} />
						<span>{item.title}</span>
					</Link>
				</Button>
			</TooltipTrigger>
			<TooltipContent side="right">{item.title}</TooltipContent>
		</Tooltip>
	);
}

function MobileRailLink({
	item,
	active,
	onNavigate,
	onPrefetch,
}: {
	item: RailItem;
	active: boolean;
	onNavigate: () => void;
	onPrefetch: () => void;
}) {
	return (
		<Button
			asChild
			variant="ghost"
			className={cn(
				"justify-start gap-3 text-muted-foreground",
				item.nested && "ml-5 text-xs",
				active &&
					"bg-muted text-foreground hover:bg-muted hover:text-foreground",
			)}
		>
			<Link
				href={item.href}
				prefetch={!item.external}
				target={item.external ? "_blank" : undefined}
				rel={item.external ? "noreferrer" : undefined}
				onMouseEnter={onPrefetch}
				onFocus={onPrefetch}
				aria-current={active ? "page" : undefined}
				onClick={onNavigate}
				transitionTypes={[
					item.title === "Chat" ? "nav-forward" : "nav-lateral",
				]}
			>
				<Icon icon={item.icon} />
				<span>{item.title}</span>
			</Link>
		</Button>
	);
}

function MobileRailIconLink({
	item,
	active,
	onNavigate,
	onPrefetch,
}: {
	item: RailItem;
	active: boolean;
	onNavigate: () => void;
	onPrefetch: () => void;
}) {
	return (
		<Button
			asChild
			variant="ghost"
			size="icon"
			className={cn(
				"text-muted-foreground",
				active &&
					"bg-muted text-foreground hover:bg-muted hover:text-foreground",
			)}
		>
			<Link
				href={item.href}
				prefetch={!item.external}
				target={item.external ? "_blank" : undefined}
				rel={item.external ? "noreferrer" : undefined}
				onMouseEnter={onPrefetch}
				onFocus={onPrefetch}
				aria-current={active ? "page" : undefined}
				onClick={onNavigate}
			>
				<Icon icon={item.icon} />
				<span className="sr-only">{item.title}</span>
			</Link>
		</Button>
	);
}

export function AppIconRailFallback() {
	return (
		<nav
			aria-label="Primary"
			aria-busy="true"
			className="hidden w-52 shrink-0 flex-col gap-1 border-r bg-sidebar p-3 md:flex [view-transition-name:app-rail]"
		>
			<div className="mb-4 flex h-9 items-center px-2">
				<VayuWordmark />
			</div>
			{ITEMS.map((item) => (
				<Button
					key={item.href}
					variant="ghost"
					disabled
					className="w-full justify-start gap-3 px-3 text-muted-foreground"
				>
					<Icon icon={item.icon} />
					<span>{item.title}</span>
				</Button>
			))}
		</nav>
	);
}

export function AppIconRail() {
	const pathname = usePathname();
	const workspaceUrl = useWorkspaceUrl();
	const { open, setOpen } = useMobileNav();
	const prefetchSection = usePrefetchSection();
	const trpc = useTRPC();
	const workspace = useQuery(trpc.workspace.get.queryOptions());

	const items = useMemo(
		() =>
			ITEMS.filter(
				(item) =>
					!item.adminOnly || workspace.data?.permissions.manageWorkspace,
			).map((item) => ({
				...item,
				section: item.href,
				href: item.external ? item.href : workspaceUrl(item.href),
				related: item.related?.map((path) => workspaceUrl(path)),
			})),
		[workspaceUrl, workspace.data?.permissions.manageWorkspace],
	);
	const inChat = items.some(
		(item) => item.title === "Chat" && isActive(item, pathname),
	);

	return (
		<>
			<nav
				aria-label="Primary"
				className="hidden w-52 shrink-0 flex-col gap-1 border-r bg-sidebar p-3 md:flex [view-transition-name:app-rail]"
			>
				<div className="mb-4 flex h-9 items-center px-2">
					<VayuWordmark />
				</div>
				{items.map((item) => (
					<RailLink
						key={item.href}
						item={item}
						active={isActive(item, pathname)}
						onPrefetch={() => prefetchSection(item.section)}
					/>
				))}
				<div className="mt-auto border-t px-2 pt-3 text-[9px] leading-4 tracking-[0.1em] text-muted-foreground uppercase">
					V-OS
					<br />
					MSP by VAYU LIMITED
				</div>
			</nav>

			<Sheet open={open} onOpenChange={setOpen}>
				{inChat ? (
					<SheetContent
						side="left"
						showCloseButton={false}
						className="w-5/6 max-w-sm flex-row gap-0 p-0"
					>
						<SheetHeader className="sr-only">
							<SheetTitle>Navigation and agent chats</SheetTitle>
						</SheetHeader>
						<nav
							aria-label="Primary"
							className="flex w-14 shrink-0 flex-col items-center gap-1 border-r py-3"
						>
							<Button
								variant="ghost"
								size="icon"
								aria-label="Close navigation"
								onClick={() => setOpen(false)}
							>
								<Icon icon={Close} />
							</Button>
							<div className="my-1 h-px w-5 bg-border" />
							{items.map((item) => (
								<MobileRailIconLink
									key={item.href}
									item={item}
									active={isActive(item, pathname)}
									onNavigate={() => setOpen(false)}
									onPrefetch={() => prefetchSection(item.section)}
								/>
							))}
						</nav>
						<AgentBuilderSidebar
							className="flex flex-1"
							onNavigate={() => setOpen(false)}
						/>
					</SheetContent>
				) : (
					<SheetContent side="left" className="w-64 gap-0 p-0">
						<SheetHeader>
							<SheetTitle>Navigation</SheetTitle>
						</SheetHeader>
						<nav
							aria-label="Primary"
							className="flex flex-1 flex-col gap-1 p-2"
						>
							{items.map((item) => (
								<MobileRailLink
									key={item.href}
									item={item}
									active={isActive(item, pathname)}
									onNavigate={() => setOpen(false)}
									onPrefetch={() => prefetchSection(item.section)}
								/>
							))}
						</nav>
					</SheetContent>
				)}
			</Sheet>
		</>
	);
}
