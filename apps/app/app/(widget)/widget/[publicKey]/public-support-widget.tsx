"use client";

import Chat from "@carbon/icons-react/es/Chat";
import Close from "@carbon/icons-react/es/Close";
import Send from "@carbon/icons-react/es/Send";
import { useEffect, useState } from "react";
import { VayuMark } from "@/components/vayu-brand";

type Config = {
	name: string;
	welcomeMessage: string;
	accentColor: string;
	requireEmail: boolean;
	quickActions: string[];
	aiEnabled: boolean;
	liveSupportEnabled: boolean;
};
type Message = {
	id: string;
	role: "VISITOR" | "ASSISTANT" | "AGENT" | "SYSTEM";
	content: string;
};

export function PublicSupportWidget({
	publicKey,
	host,
}: {
	publicKey: string;
	host: string;
}) {
	const [config, setConfig] = useState<Config | null>(null);
	const [open, setOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState("");
	const [messages, setMessages] = useState<Message[]>([]);
	const [sessionToken, setSessionToken] = useState<string | undefined>();
	const [error, setError] = useState("");

	useEffect(() => {
		fetch(
			`/api/public/support/widgets/${encodeURIComponent(publicKey)}?host=${encodeURIComponent(host)}`,
		)
			.then((response) =>
				response.ok
					? response.json()
					: Promise.reject(new Error("Widget unavailable")),
			)
			.then((value: Config) => setConfig(value))
			.catch(() => setError("Support is unavailable."));
	}, [publicKey, host]);

	async function send(text: string) {
		if (!text.trim() || loading) return;
		setLoading(true);
		setMessage("");
		setError("");
		try {
			const response = await fetch(
				`/api/public/support/widgets/${encodeURIComponent(publicKey)}/chat`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ sessionToken, message: text, host }),
				},
			);
			if (!response.ok) throw new Error("Could not send message");
			const body = (await response.json()) as {
				sessionToken: string;
				messages: Message[];
			};
			setSessionToken(body.sessionToken);
			setMessages(body.messages);
		} catch {
			setError("We couldn’t send that. Please try again.");
		} finally {
			setLoading(false);
		}
	}

	if (!config)
		return error ? null : <div className="h-screen w-full bg-transparent" />;
	return (
		<div className="flex h-screen w-full items-end justify-end bg-transparent p-3 text-white">
			{open ? (
				<section className="flex max-h-[600px] min-h-[480px] w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#111212] shadow-2xl">
					<header className="flex items-center gap-3 border-white/10 border-b p-4">
						<div
							className="flex size-9 items-center justify-center rounded-xl text-black"
							style={{ backgroundColor: config.accentColor }}
						>
							<VayuMark className="size-6" />
						</div>
						<div>
							<p className="text-sm font-medium">{config.name}</p>
							<p className="text-[10px] text-white/40">
								{config.aiEnabled ? "AI assistant" : "Live support"}
								{config.liveSupportEnabled ? " · Live support" : ""}
							</p>
						</div>
						<button
							type="button"
							className="ml-auto p-2 text-white/50"
							onClick={() => setOpen(false)}
							aria-label="Close chat"
						>
							<Close />
						</button>
					</header>
					<div className="flex-1 space-y-3 overflow-y-auto p-4">
						<div className="max-w-[85%] rounded-xl bg-white/[0.07] p-3 text-sm text-white/70">
							{config.welcomeMessage}
						</div>
						{messages.map((item) => (
							<div
								key={item.id}
								className={`flex ${item.role === "VISITOR" ? "justify-end" : "justify-start"}`}
							>
								<div
									className={`max-w-[85%] rounded-xl px-3 py-2.5 text-sm ${item.role === "VISITOR" ? "text-black" : "bg-white/[0.07] text-white/70"}`}
									style={
										item.role === "VISITOR"
											? { backgroundColor: config.accentColor }
											: undefined
									}
								>
									{item.content}
								</div>
							</div>
						))}
						{messages.length === 0 ? (
							<div className="flex flex-wrap gap-1.5">
								{config.quickActions.map((action) => (
									<button
										key={action}
										type="button"
										className="rounded-lg border border-white/10 px-2.5 py-2 text-xs text-white/55"
										onClick={() => send(action)}
									>
										{action}
									</button>
								))}
							</div>
						) : null}
						{loading ? (
							<p className="text-xs text-white/35">Responding…</p>
						) : null}
						{error ? <p className="text-xs text-[#ff6b6b]">{error}</p> : null}
					</div>
					<form
						className="flex gap-2 border-white/10 border-t p-3"
						onSubmit={(event) => {
							event.preventDefault();
							send(message);
						}}
					>
						<input
							value={message}
							onChange={(event) => setMessage(event.target.value)}
							placeholder="Type your message…"
							className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm outline-none focus:border-white/30"
						/>
						<button
							type="submit"
							disabled={!message.trim() || loading}
							className="flex size-10 items-center justify-center rounded-xl text-black disabled:opacity-40"
							style={{ backgroundColor: config.accentColor }}
							aria-label="Send message"
						>
							<Send />
						</button>
					</form>
					<p className="pb-2 text-center text-[9px] text-white/25">
						MSP by VAYU LIMITED
					</p>
				</section>
			) : (
				<button
					type="button"
					onClick={() => setOpen(true)}
					className="flex size-14 items-center justify-center rounded-full text-black shadow-2xl"
					style={{ backgroundColor: config.accentColor }}
					aria-label="Open support chat"
				>
					<Chat />
				</button>
			)}
		</div>
	);
}
