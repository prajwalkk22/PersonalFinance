import { FormEvent, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { api } from "@shared/routes";
import { Loader2, Send } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function Advisor() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I can help with budgeting, tax planning, and spending insights. Ask me anything.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const nextMessages = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(api.ai.chat.path, {
        method: api.ai.chat.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: trimmed }),
      });

      if (!res.ok) {
        throw new Error(`Failed to get advisor response (${res.status})`);
      }

      const parsed = api.ai.chat.responses[200].parse(await res.json());
      setMessages((prev) => [...prev, { role: "assistant", content: parsed.response }]);
    } catch (err: any) {
      setError(err?.message || "Unable to reach advisor");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 lg:ml-72 p-4 md:p-8">
        <header className="mb-6">
          <h1 className="text-3xl font-display font-bold">AI Advisor</h1>
          <p className="text-muted-foreground mt-1">Get personalized guidance from your finance assistant.</p>
        </header>

        <Card className="h-[calc(100vh-11rem)] flex flex-col">
          <CardHeader>
            <CardTitle>Financial Assistant</CardTitle>
          </CardHeader>

          <CardContent className="flex-1 min-h-0 flex flex-col gap-4">
            <div className="flex-1 overflow-y-auto rounded-md border p-4 space-y-3 bg-muted/20">
              {messages.map((message, idx) => (
                <div
                  key={idx}
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    message.role === "user"
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "bg-card border"
                  }`}
                >
                  {message.content}
                </div>
              ))}

              {isLoading && (
                <div className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm bg-card border">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Thinking...
                </div>
              )}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <form className="flex gap-3" onSubmit={onSubmit}>
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask about spending, tax optimization, or budget planning..."
                className="min-h-[44px] max-h-40"
              />
              <Button type="submit" disabled={isLoading || !input.trim()}>
                <Send className="w-4 h-4 mr-2" />
                Send
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

