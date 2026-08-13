import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI || "";

if (!MONGODB_URI) {
  // Don't throw at import time (breaks `next build`); throw lazily on first
  // real connection attempt instead.
  console.warn(
    "[db] MONGODB_URI is not set. Set it in .env.local before running the app."
  );
}

// Reuse the connection across hot-reloads in dev and across serverless
// invocations in prod - without this, Next.js API routes would open a new
// connection on every request.
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var _mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = global._mongooseCache ?? { conn: null, promise: null };
global._mongooseCache = cache;

export async function connectToDatabase() {
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    if (!MONGODB_URI) {
      throw new Error(
        "MONGODB_URI is not set. Add it to .env.local (see .env.example)."
      );
    }
    cache.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
    });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}
