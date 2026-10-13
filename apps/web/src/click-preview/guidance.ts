import { PROBLEMS } from "./problems";
import type { DiscoveryContext } from "./types";

export function guidanceFor(context: DiscoveryContext, step: "problem" | "goal" | "scale" | "priority" | "recommendations" | "refine"): string {
  const problem = PROBLEMS.find((item) => item.id === context.problemId);
  switch (step) {
    case "problem": return "Start with one thing you'd like to improve. Every path is click-first, and you can change your choices along the way.";
    case "goal": return `Choose the outcome that matters most for ${problem?.label.toLowerCase() ?? "your event"}. Another goal keeps room for a need our catalog may not cover.`;
    case "scale": return "A small gathering and a large conference have different needs. An estimate is fine, and Not sure yet is always an option.";
    case "priority": return "Pick the priority that would make the biggest difference. Your choices help order the curated catalog; no live AI is involved.";
    case "recommendations": return "These are curated possibilities based on your choices. Each card explains its fit and clearly separates a concept from a working sample.";
    case "refine": return "It's okay if these don't fit. Try another goal, keep a note of what's missing, or explore a different event problem.";
  }
}
