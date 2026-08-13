import { z } from "zod";

/**
 * A "step" is the atomic unit of a demo script. It is deliberately split into
 * two halves:
 *
 *  - fields an AGENT needs to actually perform the step (action, narration,
 *    expectedOutcome)
 *  - fields a HUMAN reviewer needs to trust/edit the step (sourceRef, status, notes)
 *
 * Keeping these in one record (rather than two parallel structures) means the
 * editor and the agent runtime never drift out of sync with each other - but
 * the /export endpoint strips the human-only fields back out for the agent's
 * consumption. See README "Data model" section for the reasoning.
 */

export const ActionTypeEnum = z.enum([
  "navigate", // go to a URL / screen
  "click", // click an element
  "input", // type text into a field
  "highlight", // point out / call attention to an element, no state change
  "wait", // pause, e.g. for a page to load or a process to finish
  "say", // pure narration, no UI action (e.g. framing a section)
  "scroll", // scroll to reveal an element
]);
export type ActionType = z.infer<typeof ActionTypeEnum>;

export const ActionSchema = z.object({
  type: ActionTypeEnum,
  // Human-readable target description (e.g. "the 'Create Project' button",
  // or a CSS selector if the source docs were specific enough to justify one).
  target: z.string().optional().default(""),
  // For 'input' actions: what to type. For 'navigate': the URL/path.
  value: z.string().optional().default(""),
});
export type Action = z.infer<typeof ActionSchema>;

export const SourceRefSchema = z.object({
  docTitle: z.string(),
  docUrl: z.string().optional().default(""),
  // Short excerpt (<300 chars) from the source doc that justifies this step,
  // shown in the editor so a reviewer can verify the step against ground truth.
  excerpt: z.string().optional().default(""),
});
export type SourceRef = z.infer<typeof SourceRefSchema>;

export const StepStatusEnum = z.enum(["generated", "edited", "verified"]);
export type StepStatus = z.infer<typeof StepStatusEnum>;

export const StepSchema = z.object({
  id: z.string(),
  order: z.number(),
  title: z.string(), // short label, e.g. "Create a new project"
  narration: z.string(), // what the presenter/agent says while doing this
  action: ActionSchema,
  expectedOutcome: z.string().optional().default(""),
  sourceRef: SourceRefSchema.optional(),
  status: StepStatusEnum.default("generated"),
  notes: z.string().optional().default(""),
});
export type Step = z.infer<typeof StepSchema>;

// What the LLM is asked to return for ONE step, pre-id/order/status assignment.
export const GeneratedStepSchema = StepSchema.omit({
  id: true,
  order: true,
  status: true,
}).extend({
  notes: z.string().optional().default(""),
});
export type GeneratedStep = z.infer<typeof GeneratedStepSchema>;

export const GeneratedScriptSchema = z.object({
  steps: z.array(GeneratedStepSchema).min(1),
});

export const SourcePageSchema = z.object({
  title: z.string(),
  url: z.string().optional().default(""),
  content: z.string(),
});
export type SourcePage = z.infer<typeof SourcePageSchema>;

export const DemoStatusEnum = z.enum(["draft", "in_review", "approved"]);
export type DemoStatus = z.infer<typeof DemoStatusEnum>;

// The minimal, stable contract handed to an executing agent. Intentionally
// does NOT include sourceRef/notes/status - those are authoring metadata the
// agent doesn't need and shouldn't be coupled to.
export interface AgentRunnableStep {
  order: number;
  title: string;
  narration: string;
  action: Action;
  expectedOutcome: string;
}

export interface AgentRunnableScript {
  demoId: string;
  title: string;
  version: number;
  steps: AgentRunnableStep[];
}
