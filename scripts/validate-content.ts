import { loadContent } from "../src/content/load";

const dir = process.argv[2] ?? "content";
const { questions, errors } = loadContent(dir);
for (const e of errors) console.error(`✖ ${e.file}: ${e.message}`);
const byStatus = Object.groupBy(questions, (q) => q.question.status);
console.log(
  `${questions.length} valid (${byStatus.approved?.length ?? 0} approved, ${byStatus.draft?.length ?? 0} draft, ` +
    `${byStatus.retired?.length ?? 0} retired), ${errors.length} errors`,
);
process.exit(errors.length ? 1 : 0);
