import type { Metadata } from "next";

export const metadata: Metadata = { title: "About — Skewed" };

// Level rubric from the design spec §2.2.
const RUBRIC = [
  { level: 1, name: "Fundamentals", spark: "select, filter, withColumn, read/write", sql: "SELECT/WHERE/basic JOIN", git: "init, add, commit, branch, checkout/switch" },
  { level: 2, name: "Practitioner", spark: "groupBy/agg, joins, null handling basics", sql: "GROUP BY/HAVING, CTEs, outer joins", git: "merge, rebase basics, remotes, stash" },
  { level: 3, name: "Intermediate", spark: "window functions, null semantics, explode/structs", sql: "window functions, anti/semi joins, CASE logic", git: "interactive rebase, reset vs revert, conflict resolution" },
  { level: 4, name: "Advanced", spark: "partitioning, skew, broadcast, caching, UDF pitfalls", sql: "gaps & islands, SCD2 MERGE, QUALIFY, dedup patterns", git: "reflog recovery, cherry-pick conflicts, rewriting shared history" },
  { level: 5, name: "Expert", spark: "AQE, plan-driven optimization, structured streaming watermarks, Delta MERGE semantics", sql: "performance-aware rewrites, engine-specific semantics, recursive CTEs", git: "bisect, filter-repo, submodule/subtree edge cases, worktrees" },
];

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10">
      <h1 className="text-2xl font-bold">About Skewed</h1>
      <p>
        Skewed is a set of quick drills for data engineers. Every question shows a real-world scenario and four code
        options in PySpark, SQL or Git, and exactly one of them is correct. Questions come in five levels:
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-300 dark:border-neutral-700">
              <th className="p-2">Level</th>
              <th className="p-2">PySpark</th>
              <th className="p-2">SQL</th>
              <th className="p-2">Git</th>
            </tr>
          </thead>
          <tbody>
            {RUBRIC.map((r) => (
              <tr key={r.level} className="border-b border-neutral-200 align-top dark:border-neutral-800">
                <th scope="row" className="p-2 font-semibold whitespace-nowrap">{r.level} · {r.name}</th>
                <td className="p-2">{r.spark}</td>
                <td className="p-2">{r.sql}</td>
                <td className="p-2">{r.git}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="text-xl font-semibold">Spotted a bad question?</h2>
      <p>
        After you answer, use the <strong>Report question</strong> link under the question to tell us the marked answer
        is wrong, the question is ambiguous, or there&apos;s a typo. Reports are anonymous and every one is reviewed.
      </p>
    </main>
  );
}
