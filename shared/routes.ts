import { z } from 'zod';
import { insertTransactionSchema, insertBudgetSchema, insertGoalSchema, transactions, budgets, goals, financialSnapshots } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  transactions: {
    list: {
      method: 'GET' as const,
      path: '/api/transactions' as const,
      input: z.object({
        month: z.string().optional(), // YYYY-MM
        year: z.string().optional(), // YYYY
        category: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof transactions.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/transactions' as const,
      input: insertTransactionSchema,
      responses: {
        201: z.custom<typeof transactions.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/transactions/:id' as const,
      responses: {
        200: z.custom<typeof transactions.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/transactions/:id' as const,
      input: insertTransactionSchema.partial(),
      responses: {
        200: z.custom<typeof transactions.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/transactions/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  budgets: {
    list: {
      method: 'GET' as const,
      path: '/api/budgets' as const,
      responses: {
        200: z.array(z.custom<typeof budgets.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/budgets' as const,
      input: insertBudgetSchema,
      responses: {
        201: z.custom<typeof budgets.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/budgets/:id' as const,
      input: insertBudgetSchema.partial(),
      responses: {
        200: z.custom<typeof budgets.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/budgets/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  goals: {
    list: {
      method: 'GET' as const,
      path: '/api/goals' as const,
      responses: {
        200: z.array(z.custom<typeof goals.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/goals' as const,
      input: insertGoalSchema,
      responses: {
        201: z.custom<typeof goals.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/goals/:id' as const,
      input: insertGoalSchema.partial().extend({
        addToCurrentAmount: z.number().optional(), // Special field to add savings
      }),
      responses: {
        200: z.custom<typeof goals.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/goals/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  analytics: {
    dashboard: {
      method: 'GET' as const,
      path: '/api/analytics/dashboard' as const,
      responses: {
        200: z.object({
          totalIncome: z.number(),
          totalExpenses: z.number(),
          savings: z.number(),
          healthScore: z.number(),
          recentTransactions: z.array(z.custom<typeof transactions.$inferSelect>()),
          categoryBreakdown: z.array(z.object({ category: z.string(), amount: z.number(), color: z.string() })),
        }),
      },
    },
    tax: {
      method: 'GET' as const,
      path: '/api/analytics/tax' as const,
      responses: {
        200: z.object({
          estimatedTax: z.number(),
          deductibleExpenses: z.number(),
          potentialSavings: z.number(),
          taxBreakdown: z.array(z.object({ category: z.string(), amount: z.number() })),
        }),
      },
    },
  },
  ai: {
    categorize: {
      method: 'POST' as const,
      path: '/api/ai/categorize' as const,
      input: z.object({
        description: z.string(),
        amount: z.number().optional(),
      }),
      responses: {
        200: z.object({
          category: z.string(),
          confidence: z.number(),
          isTaxDeductible: z.boolean(),
          taxCategory: z.string().optional(),
        }),
      },
    },
    chat: { // For the financial assistant
       method: 'POST' as const,
       path: '/api/ai/chat' as const,
       input: z.object({
         message: z.string(),
         context: z.any().optional(), // Current financial data context
       }),
       responses: {
         200: z.object({
            response: z.string(),
         })
       }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
