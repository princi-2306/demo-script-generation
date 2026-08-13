import mongoose, { Schema, model, models } from "mongoose";

const KnowledgeChunkSchema = new Schema(
  {
    demoId: { type: String, required: true, index: true },
    docTitle: { type: String, required: true },
    docUrl: { type: String, default: "" },
    chunkText: { type: String, required: true },
    chunkIndex: { type: Number, required: true },
    embedding: { type: [Number], required: true },
  },
  { timestamps: true }
);

export type KnowledgeChunkDocument = mongoose.InferSchemaType<
  typeof KnowledgeChunkSchema
> & {
  _id: mongoose.Types.ObjectId;
};

export const KnowledgeChunk =
  models.KnowledgeChunk || model("KnowledgeChunk", KnowledgeChunkSchema);
