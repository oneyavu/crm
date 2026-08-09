import { requireSession } from "@/lib/session";
import { InvoiceDetail } from "./invoice-detail";

export default async function InvoicePage({
	params,
}: {
	params: Promise<{ invoiceId: string }>;
}) {
	await requireSession();
	const { invoiceId } = await params;
	return <InvoiceDetail invoiceId={invoiceId} />;
}
