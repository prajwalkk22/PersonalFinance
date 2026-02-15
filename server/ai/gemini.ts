const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1";
const CHAT_MODEL = "models/gemini-2.5-flash";

if (!GEMINI_API_KEY) {
  console.warn("GEMINI_API_KEY not set");
}

/* ================= HELPERS ================= */
async function geminiPost(prompt: string) {
  const res = await fetch(
    `${GEMINI_API_URL}/${CHAT_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,   // 🔒 VERY LOW TEMP = STICK TO FACTS
          maxOutputTokens: 512,
        },
      }),
    }
  );

  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  return json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
}

/* ================= CHAT (STRICT) ================= */
async function generateChatReply(message: string, context: string): Promise<string> {
  const prompt = `
You are a personal finance advisor analyzing ACTUAL user data.

⚠️ CRITICAL RULES - NEVER VIOLATE:
1. Use ONLY the categories and amounts shown in "FINANCIAL ANALYSIS" below
2. NEVER mention categories not listed (e.g., if "Dining Out" isn't listed, DON'T mention it)
3. NEVER invent or assume spending patterns
4. If a category shows "Uncategorized", say "Uncategorized" - don't guess what it might be
5. Use EXACT amounts from the data
6. Be direct and confident - this is THEIR actual data

FINANCIAL ANALYSIS (THIS IS THE ONLY SOURCE OF TRUTH):
${context}

YOUR TASK:
Answer the user's question using ONLY the data above. Structure your response:
1. State the main financial finding (income vs expenses, savings status)
2. Identify the highest spending category BY NAME and EXACT AMOUNT from the data
3. Explain the impact (e.g., negative savings, budget breach)
4. Give 1-2 specific, actionable steps

Response length: 4-6 sentences
Tone: Professional, direct, helpful
DO NOT: Ask questions, use vague language like "seems" or "might be", or mention data not provided

USER QUESTION:
${message}
`;

  try {
    const reply = await geminiPost(prompt);
    
    // Validate response isn't empty or too short
    if (!reply || reply.length < 50) {
      throw new Error("Response too short");
    }
    
    return reply;
  } catch (error) {
    console.error("Gemini API error:", error);
    
    // Intelligent fallback based on actual context
    if (context.includes("Savings: ₹-")) {
      return "Your expenses currently exceed your income, creating a negative savings situation. Based on your transaction data, focus on reducing your highest spending category and establishing a strict monthly budget limit to restore positive cash flow.";
    } else if (context.includes("Highest Spending Category:")) {
      return "Review your spending breakdown above to identify optimization opportunities. Focus on the highest spending category and set a realistic monthly limit to improve your savings rate.";
    } else {
      return "Your financial data has been analyzed. Focus on tracking all expenses, categorizing transactions accurately, and setting monthly budget limits for your top spending categories to build sustainable savings habits.";
    }
  }
}

/* ================= PUBLIC API ================= */
export const gemini = {
  chat: {
    completions: {
      async create(opts: any) {
        const userMsg =
          opts.messages.find((m: any) => m.role === "user")?.content || "";
        const context =
          opts.messages.find((m: any) => m.role === "system")?.content || "";

        const reply = await generateChatReply(userMsg, context);

        return {
          choices: [{ message: { content: reply } }],
        };
      },
    },
  },
};