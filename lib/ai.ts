import Anthropic from "@anthropic-ai/sdk";

export const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

export type ChatMessage = { role: "user" | "assistant"; content: string };

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new Anthropic({ apiKey, maxRetries: 1, timeout: 25_000 });
  return client;
}

export function isAIConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Chama o Claude. Retorna null se a chave não estiver configurada ou se der
 * qualquer erro — quem chama usa o fallback e o sistema nunca quebra.
 */
export async function askClaude(options: {
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}): Promise<string | null> {
  const anthropic = getClient();
  if (!anthropic) return null;

  try {
    const response = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: options.maxTokens ?? 500,
      //temperature: options.temperature ?? 0.5,
      system: options.system,
      messages: options.messages,
    });

    const text = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();

    return text || null;
  } catch (error) {
    console.error("[ai] falha ao chamar Anthropic:", error instanceof Error ? error.message : error);
    return null;
  }
}
