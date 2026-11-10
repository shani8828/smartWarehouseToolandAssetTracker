// Quick sanity check for the NL query parser: npx tsx scripts/nlq-check.ts
import { parseQuery, EXAMPLE_QUERIES } from "@/lib/nlq";
const vocab = {
  categories: [
    { id: "c1", name: "Digital Multimeters", code: "MM" }, { id: "c2", name: "Power Drills", code: "PD" },
    { id: "c3", name: "Precision Gauges", code: "PG" }, { id: "c4", name: "Oscilloscopes", code: "OS" },
    { id: "c5", name: "Soldering Stations", code: "SS" },
  ],
  departments: ["ISE", "ME", "EE"],
  labs: ["Industrial Automation Lab", "Metrology Lab", "Manufacturing Workshop"],
  manufacturers: ["Fluke", "Bosch", "Mitutoyo"],
  people: [{ id: "u1", name: "Priya Nair" }, { id: "u2", name: "Aarav Sharma" }],
};
for (const q of [...EXAMPLE_QUERIES, "multimter overdue", "scopes in automation lab", "blah blah"]) {
  const r = parseQuery(q, vocab);
  console.log(q.padEnd(70), "=>", r.understood ? r.chips.map((c) => `${c.kind}:${c.label}`).join(" | ") : "(not understood)");
}
