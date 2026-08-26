"use client";

import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import { Input } from "@crm/ui/components/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";

type Currency = "USD" | "JMD";
type Account = {
	id?: string;
	currency: Currency;
	label: string;
	bankName: string;
	bankAddress: string | null;
	branchName: string | null;
	accountName: string;
	accountNumber: string;
	accountType: string | null;
	swiftCode: string | null;
	branchCode: string | null;
	routingNumber: string | null;
	conversion: string | null;
	destination: string | null;
	active: boolean;
};

const blank = (currency: Currency): Account => ({
	currency,
	label: `${currency} bank account`,
	bankName: "",
	bankAddress: "",
	branchName: "",
	accountName: "VAYU LIMITED",
	accountNumber: "",
	accountType: "",
	swiftCode: "",
	branchCode: "",
	routingNumber: "",
	conversion: "",
	destination: "",
	active: true,
});

export function PaymentOptions() {
	const trpc = useTRPC();
	const accounts = useQuery(trpc.settings.paymentAccounts.queryOptions());
	const [creating, setCreating] = useState<Currency | null>(null);
	return (
		<div className="flex max-w-4xl flex-col gap-6">
			<Card className="overflow-hidden border-[#7bff5a]/20">
				<div className="h-1 bg-gradient-to-r from-[#7bff5a] via-[#71ed75] to-[#55d9bd]" />
				<CardHeader>
					<CardTitle>Client payment instructions</CardTitle>
					<CardDescription>
						Only active accounts appear in the client portal. Save each currency
						separately; changes are reflected immediately.
					</CardDescription>
				</CardHeader>
			</Card>
			{accounts.data?.map((account) => (
				<PaymentAccountForm
					key={account.id}
					currency={account.currency as Currency}
					account={account as Account}
				/>
			))}
			{creating ? (
				<PaymentAccountForm
					key={`new-${creating}`}
					currency={creating}
					account={null}
					onCreated={() => setCreating(null)}
				/>
			) : null}
			<div className="flex flex-wrap gap-3">
				<Button
					type="button"
					variant="outline"
					onClick={() => setCreating("USD")}
					disabled={creating !== null}
				>
					Add USD receiving account
				</Button>
				<Button
					type="button"
					variant="outline"
					onClick={() => setCreating("JMD")}
					disabled={creating !== null}
				>
					Add JMD receiving account
				</Button>
			</div>
		</div>
	);
}

function PaymentAccountForm({
	currency,
	account,
	onCreated,
}: {
	currency: Currency;
	account: Account | null;
	onCreated?: () => void;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [draft, setDraft] = useState<Account>(() => account ?? blank(currency));
	useEffect(() => setDraft(account ?? blank(currency)), [account, currency]);
	const save = useMutation(
		trpc.settings.upsertPaymentAccount.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: trpc.settings.paymentAccounts.queryKey(),
				});
				toast.success(`${currency} payment instructions saved.`);
				onCreated?.();
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const remove = useMutation(
		trpc.settings.removePaymentAccount.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: trpc.settings.paymentAccounts.queryKey(),
				});
				toast.success("Payment account removed.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const set = (field: keyof Account, value: string | boolean) =>
		setDraft((current) => ({ ...current, [field]: value }));

	return (
		<Card>
			<CardHeader>
				<div className="flex items-start justify-between gap-4">
					<div>
						<CardTitle>
							{account?.label ?? `New ${currency} direct transfer`}
						</CardTitle>
						<CardDescription>
							{account ? "Configured" : "Not configured yet"}
						</CardDescription>
					</div>
					<label className="flex items-center gap-2 text-sm">
						<input
							type="checkbox"
							checked={draft.active}
							onChange={(event) => set("active", event.target.checked)}
							className="accent-[#7bff5a]"
						/>{" "}
						Show to clients
					</label>
				</div>
			</CardHeader>
			<CardContent>
				<form
					className="grid gap-4 sm:grid-cols-2"
					onSubmit={(event) => {
						event.preventDefault();
						save.mutate(draft);
					}}
				>
					<PaymentField
						label="Display label"
						value={draft.label}
						onChange={(value) => set("label", value)}
						required
					/>
					<PaymentField
						label="Bank name"
						value={draft.bankName}
						onChange={(value) => set("bankName", value)}
						required
					/>
					<PaymentField
						label="Bank address"
						value={draft.bankAddress ?? ""}
						onChange={(value) => set("bankAddress", value)}
					/>
					<PaymentField
						label="Branch name"
						value={draft.branchName ?? ""}
						onChange={(value) => set("branchName", value)}
					/>
					<PaymentField
						label="Account name"
						value={draft.accountName}
						onChange={(value) => set("accountName", value)}
						required
					/>
					<PaymentField
						label="Account number"
						value={draft.accountNumber}
						onChange={(value) => set("accountNumber", value)}
						required
					/>
					<PaymentField
						label="Account type"
						value={draft.accountType ?? ""}
						onChange={(value) => set("accountType", value)}
					/>
					<PaymentField
						label="SWIFT / BIC"
						value={draft.swiftCode ?? ""}
						onChange={(value) => set("swiftCode", value)}
					/>
					<PaymentField
						label="Branch code"
						value={draft.branchCode ?? ""}
						onChange={(value) => set("branchCode", value)}
					/>
					<PaymentField
						label="Routing number"
						value={draft.routingNumber ?? ""}
						onChange={(value) => set("routingNumber", value)}
					/>
					<PaymentField
						label="Conversion / settlement"
						value={draft.conversion ?? ""}
						onChange={(value) => set("conversion", value)}
					/>
					<PaymentField
						label="Destination reference"
						value={draft.destination ?? ""}
						onChange={(value) => set("destination", value)}
					/>
					<div className="flex items-end gap-3 sm:col-span-2">
						<Button
							type="submit"
							disabled={
								save.isPending ||
								!draft.bankName ||
								!draft.accountName ||
								!draft.accountNumber
							}
							className="bg-[#7bff5a] text-black hover:bg-[#71ed75]"
						>
							{save.isPending ? "Saving…" : `Save ${currency} instructions`}
						</Button>
						{account?.id ? (
							<Button
								type="button"
								variant="destructive"
								disabled={remove.isPending}
								onClick={() => {
									if (window.confirm(`Permanently remove ${account.label}?`))
										remove.mutate({ id: account.id as string });
								}}
							>
								Delete account
							</Button>
						) : null}
					</div>
				</form>
			</CardContent>
		</Card>
	);
}

function PaymentField({
	label,
	value,
	onChange,
	required = false,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	required?: boolean;
}) {
	const id = useId();
	return (
		<label className="grid gap-1.5 text-sm" htmlFor={id}>
			{label}
			<Input
				id={id}
				value={value}
				onChange={(event) => onChange(event.target.value)}
				required={required}
			/>
		</label>
	);
}
