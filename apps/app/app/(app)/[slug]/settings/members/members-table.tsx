"use client";

import OverflowMenuHorizontal from "@carbon/icons-react/es/OverflowMenuHorizontal";
import TrashCan from "@carbon/icons-react/es/TrashCan";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@crm/ui/components/alert-dialog";
import { Button } from "@crm/ui/components/button";
import {
	DataTable,
	type DataTableColumn,
	type DataTableFacet,
} from "@crm/ui/components/data-table";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import { Label } from "@crm/ui/components/label";
import { PersonAvatar } from "@crm/ui/components/person-avatar";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ListSearch } from "@/components/data-table/list-search";
import { useTableQuery } from "@/components/data-table/use-table-query";
import { LocalRelativeTime } from "@/components/local-date-time";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { membersSearchParams } from "./members-search-params";

const ROLE_LABEL = {
	owner: "Owner",
	admin: "Admin",
	member: "Member",
} as const;

type Role = keyof typeof ROLE_LABEL;

type MemberRow = RouterOutputs["workspace"]["members"]["rows"][number];

function columns(
	canChangeRoles: boolean,
	onChangeRole: (member: MemberRow, role: Role) => void,
	onRemove: (member: MemberRow) => void,
	pending: boolean,
): DataTableColumn<MemberRow>[] {
	return [
		{
			id: "name",
			header: "Name",
			sortable: true,
			hideable: false,
			width: "w-[34%]",
			cell: (row) => (
				<span className="flex min-w-0 items-center gap-2">
					<PersonAvatar
						size="sm"
						src={row.image}
						name={row.name}
						email={row.email}
					/>
					<span className="truncate font-medium">{row.name}</span>
					{row.isViewer ? (
						<span className="text-muted-foreground text-xs">You</span>
					) : null}
				</span>
			),
		},
		{
			id: "email",
			header: "Email",
			sortable: true,
			width: "w-[32%]",
			hideBelow: "md",
			cell: (row) => (
				<span className="truncate text-muted-foreground">{row.email}</span>
			),
		},
		{
			id: "role",
			header: "Role",
			sortable: true,
			width: "w-[14%]",
			cell: (row) => (
				<span className="text-muted-foreground">{ROLE_LABEL[row.role]}</span>
			),
		},
		{
			id: "joinedAt",
			header: "Joined",
			label: "Joined date",
			sortable: true,
			align: "right",
			width: "w-[14%]",
			hideBelow: "sm",
			cell: (row) => (
				<span className="text-muted-foreground">
					<LocalRelativeTime date={row.joinedAt} />
				</span>
			),
		},
		{
			id: "actions",
			header: <span className="sr-only">Actions</span>,
			label: "Actions",
			hideable: false,
			align: "right",
			width: "w-[6%]",
			cell: (row) =>
				canChangeRoles ? (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon" disabled={pending}>
								<Icon icon={OverflowMenuHorizontal} />
								<span className="sr-only">Change {row.name}'s role</span>
							</Button>
						</DropdownMenuTrigger>

						<DropdownMenuContent align="end">
							{(Object.keys(ROLE_LABEL) as Role[]).map((role) => (
								<DropdownMenuItem
									key={role}
									data-checked={row.role === role}
									onSelect={() => {
										if (row.role === role) return;
										onChangeRole(row, role);
									}}
								>
									{ROLE_LABEL[role]}
								</DropdownMenuItem>
							))}
							{!row.isViewer ? (
								<DropdownMenuItem
									variant="destructive"
									onSelect={() => onRemove(row)}
								>
									<TrashCan /> Remove staff access
								</DropdownMenuItem>
							) : null}
						</DropdownMenuContent>
					</DropdownMenu>
				) : null,
		},
	];
}

export function MembersTable() {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const { query, input } = useTableQuery(membersSearchParams);

	const workspace = useQuery(trpc.workspace.get.queryOptions());
	const members = useQuery({
		...trpc.workspace.members.queryOptions(input),
		placeholderData: (previous) => previous,
	});
	const invitations = useQuery({
		...trpc.workspace.invitations.queryOptions(),
		enabled: workspace.data?.canChangeRoles ?? false,
	});
	const [inviteEmail, setInviteEmail] = useState("");
	const [inviteRole, setInviteRole] = useState<Role>("member");
	const [removingMember, setRemovingMember] = useState<MemberRow | null>(null);
	const invite = useMutation(
		trpc.workspace.inviteMember.mutationOptions({
			onSuccess: async (result) => {
				setInviteEmail("");
				await cache.workspace();
				await invitations.refetch();
				toast.success(
					result.delivery.sent
						? "Invitation emailed."
						: "Invitation created, but email delivery is not configured.",
				);
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const revokeInvite = useMutation(
		trpc.workspace.revokeInvitation.mutationOptions({
			onSuccess: async () => {
				await invitations.refetch();
				toast.success("Invitation revoked.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const setRole = useMutation(
		trpc.workspace.setMemberRole.mutationOptions({
			onSuccess: async () => {
				await cache.workspace();
				toast.success("Role changed.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const removeMember = useMutation(
		trpc.workspace.removeMember.mutationOptions({
			onSuccess: async (removed) => {
				setRemovingMember(null);
				await cache.workspace();
				await members.refetch();
				toast.success(`${removed.name}'s staff access was removed.`);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const facetCounts = members.data?.facetCounts;

	const facets: DataTableFacet[] = [
		{
			id: "role",
			label: "Role",
			options: (Object.keys(ROLE_LABEL) as Role[]).flatMap((role) =>
				(facetCounts?.role?.[role] ?? 0) > 0
					? [{ value: role, label: ROLE_LABEL[role] }]
					: [],
			),
		},
	];

	return (
		<div className="flex min-h-0 flex-col gap-4">
			{workspace.data?.canChangeRoles ? (
				<form
					className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-[1fr_160px_auto] md:items-end"
					onSubmit={(event) => {
						event.preventDefault();
						invite.mutate({ email: inviteEmail, role: inviteRole });
					}}
				>
					<div className="flex flex-col gap-2">
						<Label htmlFor="staff-email">Invite staff by email</Label>
						<Input
							id="staff-email"
							type="email"
							placeholder="name@company.com"
							value={inviteEmail}
							onChange={(event) => setInviteEmail(event.target.value)}
							required
						/>
					</div>
					<div className="flex flex-col gap-2">
						<Label htmlFor="staff-role">Role</Label>
						<select
							id="staff-role"
							className="h-8 rounded-md border border-input bg-background px-2.5 text-xs"
							value={inviteRole}
							onChange={(event) => setInviteRole(event.target.value as Role)}
						>
							{(Object.keys(ROLE_LABEL) as Role[]).map((role) => (
								<option key={role} value={role}>
									{ROLE_LABEL[role]}
								</option>
							))}
						</select>
					</div>
					<Button type="submit" disabled={invite.isPending}>
						{invite.isPending ? "Sending…" : "Send invitation"}
					</Button>
				</form>
			) : null}
			{(invitations.data?.length ?? 0) > 0 ? (
				<div className="rounded-lg border bg-card p-4">
					<p className="mb-3 font-medium text-sm">Pending invitations</p>
					<div className="flex flex-col gap-2">
						{invitations.data?.map((item) => (
							<div key={item.id} className="flex items-center gap-3 text-xs">
								<span className="min-w-0 flex-1 truncate">{item.email}</span>
								<span className="text-muted-foreground">
									{ROLE_LABEL[item.role]}
								</span>
								<Button
									type="button"
									size="sm"
									variant="ghost"
									disabled={revokeInvite.isPending}
									onClick={() => revokeInvite.mutate({ id: item.id })}
								>
									Revoke
								</Button>
							</div>
						))}
					</div>
				</div>
			) : null}
			<DataTable
				query={query}
				search={<ListSearch placeholder="Search by name or email…" />}
				columns={columns(
					workspace.data?.canChangeRoles ?? false,
					(member, role) => setRole.mutate({ memberId: member.id, role }),
					setRemovingMember,
					setRole.isPending || removeMember.isPending,
				)}
				rows={members.data?.rows ?? []}
				total={members.data?.total ?? 0}
				facetCounts={facetCounts}
				facets={facets}
				getRowId={(row) => row.id}
				loading={members.isFetching}
				empty="Nobody matches this view."
			/>
			<AlertDialog
				open={Boolean(removingMember)}
				onOpenChange={(open) => !open && setRemovingMember(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Remove staff access?</AlertDialogTitle>
						<AlertDialogDescription>
							{removingMember?.name} will immediately lose internal CRM access
							and project assignments. Their client contact or portal record, if
							one exists, will remain separate and unchanged.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							disabled={removeMember.isPending}
							onClick={() =>
								removingMember &&
								removeMember.mutate({ memberId: removingMember.id })
							}
						>
							Remove staff access
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
