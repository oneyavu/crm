"use client";

import Add from "@carbon/icons-react/es/Add";
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
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import { Field, FieldGroup, FieldLabel } from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { Textarea } from "@crm/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
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
	const [open, setOpen] = useState(false);
	const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(
		null,
	);
	const [code, setCode] = useState("");
	const [name, setName] = useState("");
	const [category, setCategory] = useState("");
	const [summary, setSummary] = useState("");
	const [newKind, setNewKind] = useState("SERVICE");
	const queryClient = useQueryClient();
	const catalog = useQuery(
		trpc.catalog.list.queryOptions({ q, kind: (kind || null) as never }),
	);
	const create = useMutation(
		trpc.catalog.create.mutationOptions({
			onSuccess: async (item) => {
				await queryClient.invalidateQueries({
					queryKey: trpc.catalog.list.queryKey(),
				});
				setOpen(false);
				setCode("");
				setName("");
				setCategory("");
				setSummary("");
				toast.success(`${item.name} added.`);
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const remove = useMutation(
		trpc.catalog.delete.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: trpc.catalog.list.queryKey(),
				});
				setDeleting(null);
				toast.success("Catalog item deleted.");
			},
			onError: (error) => toast.error(error.message),
		}),
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
						<Button
							key={value}
							type="button"
							onClick={() => setKind(value)}
							variant={kind === value ? "default" : "outline"}
							size="sm"
						>
							{label}
						</Button>
					))}
					<Button onClick={() => setOpen(true)}>
						<Add data-icon="inline-start" /> Add item
					</Button>
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
							<div className="flex items-center gap-1">
								<Badge variant="outline">{item.category}</Badge>
								<Button
									variant="ghost"
									size="icon-sm"
									aria-label={`Delete ${item.name}`}
									onClick={() => setDeleting({ id: item.id, name: item.name })}
								>
									<TrashCan />
								</Button>
							</div>
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
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Add catalog item</DialogTitle>
						<DialogDescription>
							Add a product, service, use case or VAYU capability.
						</DialogDescription>
					</DialogHeader>
					<form
						onSubmit={(event) => {
							event.preventDefault();
							create.mutate({
								code,
								name,
								kind: newKind as never,
								category,
								summary,
								sourceUrl: "https://onevayu.com",
							});
						}}
					>
						<FieldGroup>
							<div className="grid grid-cols-2 gap-4">
								<Field>
									<FieldLabel htmlFor="catalog-code">Code</FieldLabel>
									<Input
										id="catalog-code"
										required
										value={code}
										onChange={(event) => setCode(event.target.value)}
									/>
								</Field>
								<Field>
									<FieldLabel>Kind</FieldLabel>
									<Select value={newKind} onValueChange={setNewKind}>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectGroup>
												{KINDS.slice(1).map(([value, label]) => (
													<SelectItem key={value} value={value}>
														{label}
													</SelectItem>
												))}
											</SelectGroup>
										</SelectContent>
									</Select>
								</Field>
							</div>
							<Field>
								<FieldLabel htmlFor="catalog-name">Name</FieldLabel>
								<Input
									id="catalog-name"
									required
									value={name}
									onChange={(event) => setName(event.target.value)}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="catalog-category">Category</FieldLabel>
								<Input
									id="catalog-category"
									required
									value={category}
									onChange={(event) => setCategory(event.target.value)}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="catalog-summary">Summary</FieldLabel>
								<Textarea
									id="catalog-summary"
									required
									value={summary}
									onChange={(event) => setSummary(event.target.value)}
								/>
							</Field>
						</FieldGroup>
						<DialogFooter className="mt-5">
							<Button
								type="submit"
								disabled={
									!code.trim() ||
									!name.trim() ||
									!category.trim() ||
									!summary.trim() ||
									create.isPending
								}
							>
								Add item
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
			<AlertDialog
				open={Boolean(deleting)}
				onOpenChange={(value) => !value && setDeleting(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete this catalog item?</AlertDialogTitle>
						<AlertDialogDescription>
							{deleting?.name} will be removed from the catalog. Existing
							invoice lines will keep their descriptions.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							disabled={remove.isPending}
							onClick={() => deleting && remove.mutate({ id: deleting.id })}
						>
							Delete item
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
