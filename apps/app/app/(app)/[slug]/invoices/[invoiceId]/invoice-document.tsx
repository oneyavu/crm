import { Badge } from "@crm/ui/components/badge";
import { formatMoney } from "@crm/ui/lib/format";
import { VayuMark } from "@/components/vayu-brand";

type InvoiceDocumentData = {
	number: string;
	status: string;
	recipientName: string | null;
	recipientEmail: string | null;
	issueDate: string;
	dueDate: string;
	dueTime: string;
	currency: string;
	subtotalCents: number;
	taxCents: number;
	totalCents: number;
	amountPaidCents: number;
	notes: string | null;
	company: {
		name: string;
		city: string | null;
		stateCode: string | null;
		country: string | null;
		phone: string | null;
		email: string | null;
	};
	project: { name: string } | null;
	lines: Array<{
		id: string;
		description: string;
		quantity: number;
		unitPriceCents: number;
		amountCents: number;
	}>;
};

const TERMS = [
	[
		"Payment Terms",
		"All invoices are payable within 7 days of the invoice date unless otherwise stated in writing. Late payments may result in suspension of services.",
	],
	[
		"Deposits & Project Payments",
		"A non-refundable deposit is required before commencement of any project, automation setup, software development, or customization. Project timelines begin upon receipt of deposit.",
	],
	[
		"Subscription Services",
		"Subscription-based services are billed monthly or annually in advance. Failure to pay may result in service interruption or termination.",
	],
	[
		"Fees & Charges",
		"All prices are exclusive of applicable taxes, transaction fees, or third-party service costs unless otherwise stated.",
	],
	[
		"Refund Policy",
		"Payments made for services rendered, setup fees, discovery sessions, automation builds, integrations, or digital products are non-refundable.",
	],
	[
		"Scope of Work",
		"This invoice covers only the services outlined. Additional requests, changes, or enhancements outside the agreed scope may incur additional charges.",
	],
	[
		"Intellectual Property",
		"All systems, automations, software, workflows, and digital assets remain the property of VAYU Limited until full payment is received.",
	],
	[
		"Service Availability",
		"VAYU Limited is not liable for downtime caused by third-party platforms, hosting providers, APIs, telecom carriers, or force majeure events.",
	],
	[
		"Client Responsibilities",
		"The client is responsible for providing accurate information, access credentials, approvals, and content required for service delivery.",
	],
	[
		"Termination",
		"VAYU Limited reserves the right to suspend or terminate services for non-payment, misuse, or breach of agreement.",
	],
	[
		"Limitation of Liability",
		"VAYU Limited shall not be liable for indirect, incidental, or consequential damages arising from the use of its services or solutions.",
	],
	["Governing Law", "These terms are governed by the laws of Jamaica."],
] as const;

export function InvoiceDocument({ invoice }: { invoice: InvoiceDocumentData }) {
	const amountDue = Math.max(0, invoice.totalCents - invoice.amountPaidCents);
	const location = [
		invoice.company.city,
		invoice.company.stateCode,
		invoice.company.country,
	]
		.filter(Boolean)
		.join(", ");

	return (
		<article className="invoice-document mx-auto w-full max-w-[210mm] bg-white text-[#171717] shadow-2xl shadow-black/25 print:shadow-none">
			<section className="invoice-page min-h-[297mm] p-8 print:h-[297mm] print:overflow-hidden">
				<header className="flex items-start justify-between gap-8 border-[#171717]/15 border-b pb-6">
					<div className="flex items-center gap-3">
						<div className="flex size-11 items-center justify-center rounded-md bg-[#171717] text-white">
							<VayuMark className="size-8" />
						</div>
						<div>
							<p className="font-semibold text-lg tracking-tight">
								VAYU Limited
							</p>
							<p className="text-[#666] text-xs">
								Business control & digital infrastructure
							</p>
						</div>
					</div>
					<div className="text-right">
						<p className="font-semibold text-3xl tracking-tight">INVOICE</p>
						<p className="mt-1 font-medium text-[#555]"># {invoice.number}</p>
						<Badge className="mt-3 border-0 bg-[#ff6b6b]/15 text-[#d94343]">
							{invoice.status}
						</Badge>
					</div>
				</header>

				<div className="mt-7 grid gap-8 sm:grid-cols-2">
					<div>
						<p className="font-semibold text-xs uppercase tracking-[0.18em]">
							Bill to
						</p>
						<p className="mt-3 font-semibold text-lg">
							{invoice.recipientName ?? invoice.company.name}
						</p>
						<p className="text-[#555]">{invoice.company.name}</p>
						{location ? <p className="text-[#555]">{location}</p> : null}
						{invoice.company.phone ? (
							<p className="mt-3 text-[#555]">{invoice.company.phone}</p>
						) : null}
						<p className="text-[#555]">
							{invoice.recipientEmail ?? invoice.company.email}
						</p>
					</div>
					<div className="grid content-start grid-cols-[auto_1fr] gap-x-6 gap-y-2 sm:justify-self-end">
						<span className="text-[#666]">Invoice date</span>
						<span className="font-medium tabular-nums">
							{invoice.issueDate.slice(0, 10)}
						</span>
						<span className="text-[#666]">Due date</span>
						<span className="font-medium tabular-nums">
							{invoice.dueDate.slice(0, 10)} at {invoice.dueTime}
						</span>
						{invoice.project ? (
							<>
								<span className="text-[#666]">Project</span>
								<span className="max-w-56 font-medium">
									{invoice.project.name}
								</span>
							</>
						) : null}
					</div>
				</div>

				<div className="mt-7 overflow-hidden rounded-md border border-[#171717]/15">
					<div className="grid grid-cols-[2rem_1fr_4rem_6rem_6rem] gap-3 bg-[#171717] px-4 py-3 font-medium text-white text-xs uppercase tracking-wider">
						<span>#</span>
						<span>Item</span>
						<span className="text-right">Qty</span>
						<span className="text-right">Rate</span>
						<span className="text-right">Amount</span>
					</div>
					{invoice.lines.map((line, index) => (
						<div
							key={line.id}
							className="grid grid-cols-[2rem_1fr_4rem_6rem_6rem] gap-3 border-[#171717]/10 border-b px-4 py-3 text-sm last:border-b-0"
						>
							<span className="text-[#666]">{index + 1}</span>
							<p className="whitespace-pre-line font-medium">
								{line.description}
							</p>
							<span className="text-right tabular-nums">{line.quantity}</span>
							<span className="text-right tabular-nums">
								{formatMoney(line.unitPriceCents, invoice.currency)}
							</span>
							<span className="text-right font-medium tabular-nums">
								{formatMoney(line.amountCents, invoice.currency)}
							</span>
						</div>
					))}
				</div>

				<div className="mt-6 ml-auto grid w-full max-w-sm grid-cols-2 gap-y-2 text-sm">
					<span className="text-[#666]">Subtotal</span>
					<span className="text-right tabular-nums">
						{formatMoney(invoice.subtotalCents, invoice.currency)}
					</span>
					<span className="text-[#666]">Tax</span>
					<span className="text-right tabular-nums">
						{formatMoney(invoice.taxCents, invoice.currency)}
					</span>
					<span className="border-[#171717]/15 border-t pt-3 font-semibold">
						Total
					</span>
					<span className="border-[#171717]/15 border-t pt-3 text-right font-semibold tabular-nums">
						{formatMoney(invoice.totalCents, invoice.currency)}
					</span>
					<span className="rounded-l-md bg-[#ffd8c9] px-3 py-3 font-semibold">
						Amount due
					</span>
					<span className="rounded-r-md bg-gradient-to-r from-[#ffd8c9] to-[#d9d4ff] px-3 py-3 text-right font-semibold tabular-nums">
						{formatMoney(amountDue, invoice.currency)}
					</span>
				</div>
				{invoice.notes ? (
					<div className="mt-6 rounded-md bg-[#f2f2f0] p-4">
						<p className="font-semibold text-xs uppercase tracking-wider">
							Notes
						</p>
						<p className="mt-2 whitespace-pre-line text-[#555] text-sm">
							{invoice.notes}
						</p>
					</div>
				) : null}
			</section>

			<section className="invoice-page min-h-[297mm] border-[#171717]/15 border-t p-8 print:h-[297mm] print:break-before-page print:overflow-hidden print:border-0">
				<div>
					<div className="rounded-lg bg-[#f4f4f1] p-5">
						<p className="font-semibold text-xs uppercase tracking-[0.18em]">
							Offline payment
						</p>
						<p className="mt-2 font-semibold">USD Business Savings</p>
						<div className="mt-3 grid grid-cols-[auto_1fr_auto_1fr] gap-x-4 gap-y-1.5 text-xs">
							<span className="text-[#666]">Bank</span>
							<span>Scotiabank Jamaica</span>
							<span className="text-[#666]">Branch</span>
							<span>Junction Branch</span>
							<span className="text-[#666]">Account name</span>
							<span>VAYU LIMITED</span>
							<span className="text-[#666]">Account number</span>
							<span className="tabular-nums">000424765</span>
							<span className="text-[#666]">Account type</span>
							<span>Business Savings</span>
							<span className="text-[#666]">Currency</span>
							<span>USD</span>
							<span className="text-[#666]">SWIFT / BIC</span>
							<span>NOSCJMKNXXX</span>
							<span className="text-[#666]">Branch code</span>
							<span>22475</span>
						</div>
					</div>
					<div className="mt-6">
						<p className="font-semibold text-xs uppercase tracking-[0.18em]">
							Terms & conditions
						</p>
						<p className="mt-2 font-semibold">
							VAYU Limited Invoice Terms & Conditions
						</p>
						<div className="mt-4 grid grid-cols-2 gap-x-7 gap-y-3">
							{TERMS.map(([title, body]) => (
								<section key={title} className="break-inside-avoid">
									<h2 className="font-semibold text-xs">{title}</h2>
									<p className="mt-0.5 text-[#555] text-[11px] leading-[1.35]">
										{body}
									</p>
								</section>
							))}
						</div>
					</div>
				</div>
				<div className="mt-6 flex items-end justify-between border-[#171717]/15 border-t pt-4">
					<div>
						<p className="font-medium">Authorized by VAYU Limited</p>
						<p className="mt-1 text-[#666] text-xs">
							Digitally issued from V-OS · MSP by VAYU LIMITED
						</p>
					</div>
					<div className="flex items-center gap-2 text-[#171717]">
						<VayuMark className="size-7" />
						<span className="font-semibold">VAYU</span>
					</div>
				</div>
			</section>
		</article>
	);
}
