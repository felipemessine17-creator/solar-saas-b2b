"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, LoaderCircle, MessagesSquare, SendHorizontal, Sparkles, X } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };

interface Props {
  slug: string;
  companyName: string;
  consultantName: string;
  brand: string;
  brandText: string;
  simulation?: {
    billValue: number;
    city: string;
    state: string;
    propertyType: string;
    roofType: string;
  };
}

const SUGGESTIONS = [
  "Funciona em dias nublados?",
  "Precisa de manutenção?",
  "Quanto tempo leva a instalação?",
  "Quais as formas de pagamento?",
];

export default function ChatWidget({ slug, companyName, consultantName, brand, brandText, simulation }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Olá! Sou o assistente virtual da ${companyName}. Posso tirar suas dúvidas sobre energia solar, instalação, garantia e pagamento. O que você quer saber?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || loading) return;

    const nextMessages: Message[] = [...messages, { role: "user", content: question }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, messages: nextMessages, simulation }),
      });
      const data = (await res.json().catch(() => ({}))) as { reply?: string };
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            data.reply ||
            `Desculpe, não consegui responder agora. Fale com ${consultantName || "nossa equipe"} pelo WhatsApp!`,
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Estou com instabilidade no momento. Tente novamente em instantes." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="print:hidden">
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full py-3 pl-3 pr-4 text-sm font-semibold shadow-2xl ring-4 ring-white transition hover:scale-[1.02] sm:bottom-6 sm:right-6"
          style={{ backgroundColor: brand, color: brandText }}
          aria-label="Abrir assistente virtual"
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-white/20">
            <MessagesSquare className="h-4 w-4" />
          </span>
          <span className="hidden sm:inline">Dúvidas sobre Energia Solar? Pergunte à IA</span>
          <span className="sm:hidden">Pergunte à IA</span>
        </button>
      )}

      {open && (
        <div className="fixed inset-x-2 bottom-2 z-50 flex max-h-[80vh] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[380px]">
          <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: brand, color: brandText }}>
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-white/20">
                <Bot className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold leading-tight">Assistente {companyName}</p>
                <p className="flex items-center gap-1 text-[11px] opacity-85">
                  <Sparkles className="h-3 w-3" /> Responde na hora
                </p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-full p-1.5 hover:bg-white/20" aria-label="Fechar chat">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4" style={{ minHeight: 260 }}>
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === "user" ? "rounded-br-md" : "rounded-bl-md bg-white text-slate-700 shadow-sm ring-1 ring-slate-100"
                  }`}
                  style={m.role === "user" ? { backgroundColor: brand, color: brandText } : undefined}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-sm text-slate-500 shadow-sm ring-1 ring-slate-100">
                  <LoaderCircle className="h-4 w-4 animate-spin" /> Digitando...
                </div>
              </div>
            )}
            {messages.length === 1 && !loading && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200 hover:ring-slate-300"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 border-t border-slate-100 bg-white p-3"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Digite sua dúvida..."
              maxLength={500}
              className="flex-1 rounded-full border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-400"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="grid h-10 w-10 place-items-center rounded-full transition disabled:opacity-40"
              style={{ backgroundColor: brand, color: brandText }}
              aria-label="Enviar"
            >
              <SendHorizontal className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
