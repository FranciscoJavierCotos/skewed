import { z } from "zod";
import { TOPICS } from "@/domain/types";

const OptionSchema = z.object({
  code: z.string().trim().min(1, "option code is required"),
  correct: z.boolean(),
  explanation: z.string().trim().min(1, "every option needs an explanation"),
});

export const QuestionFileSchema = z
  .strictObject({
    id: z.string().regex(/^(spark|sql|git)-l[1-5]-\d{4}$/, "id must look like sql-l3-0007"),
    topic: z.enum(TOPICS),
    level: z.number().int().min(1).max(5),
    title: z.string().trim().min(1).max(120),
    prompt: z.string().trim().min(1),
    context: z.string().trim().min(1).nullish(),
    options: z.array(OptionSchema).length(4, "exactly 4 options required"),
    tags: z.array(z.string()).default([]),
    docs_url: z.url({ protocol: /^https$/, error: "docs_url must be an https URL" }).nullish(),
    status: z.enum(["draft", "approved", "retired"]),
  })
  .superRefine((q, ctx) => {
    const correct = q.options.filter((o) => o.correct).length;
    if (correct !== 1)
      ctx.addIssue({ code: "custom", path: ["options"], message: `expected exactly 1 correct option, found ${correct}` });
    if (new Set(q.options.map((o) => o.code.trim())).size !== q.options.length)
      ctx.addIssue({ code: "custom", path: ["options"], message: "option code must be unique" });
    if (!q.id.startsWith(`${q.topic}-l${q.level}-`))
      ctx.addIssue({ code: "custom", path: ["id"], message: "id prefix must match topic and level" });
  });

export type QuestionFile = z.infer<typeof QuestionFileSchema>;
