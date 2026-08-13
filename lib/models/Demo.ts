import mongoose, { Schema, model, models } from "mongoose";

const ActionSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["navigate", "click", "input", "highlight", "wait", "say", "scroll"],
      required: true,
    },
    target: { type: String, default: "" },
    value: { type: String, default: "" },
  },
  { _id: false }
);

const SourceRefSchema = new Schema(
  {
    docTitle: { type: String, required: true },
    docUrl: { type: String, default: "" },
    excerpt: { type: String, default: "" },
  },
  { _id: false }
);

const StepSchema = new Schema(
  {
    id: { type: String, required: true },
    order: { type: Number, required: true },
    title: { type: String, required: true },
    narration: { type: String, default: "" },
    action: { type: ActionSchema, required: true },
    expectedOutcome: { type: String, default: "" },
    sourceRef: { type: SourceRefSchema, required: false },
    status: {
      type: String,
      enum: ["generated", "edited", "verified"],
      default: "generated",
    },
    notes: { type: String, default: "" },
  },
  { _id: false }
);

const SourcePageSchema = new Schema(
  {
    title: { type: String, required: true },
    url: { type: String, default: "" },
    content: { type: String, required: true },
  },
  { _id: false }
);

const DemoSchema = new Schema(
  {
    title: { type: String, required: true },
    customerName: { type: String, default: "" },
    status: {
      type: String,
      enum: ["draft", "in_review", "approved"],
      default: "draft",
    },
    // Bumped every time steps are edited after generation. The agent export
    // includes this so a running agent can detect the script changed under it.
    version: { type: Number, default: 1 },
    sourcePages: { type: [SourcePageSchema], default: [] },
    steps: { type: [StepSchema], default: [] },
    generationModel: { type: String, default: "" },
  },
  { timestamps: true }
);

export type DemoDocument = mongoose.InferSchemaType<typeof DemoSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Demo = models.Demo || model("Demo", DemoSchema);
