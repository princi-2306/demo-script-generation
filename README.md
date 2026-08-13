# Demo Script Builder — Autonomous Agent Script & Review System

Turns a customer's scraped documentation or uploaded files into a **structured, RAG-grounded, editable demo script** — reviewable by a person, and executable by an autonomous AI agent (or human presenter) step-by-step.

Built for **Omnisavant**'s autonomous B2B sales demo pipeline.

---

## 🏗️ End-to-End System Architecture & Flowchart

```
flowchart TD
    subgraph S1["1. Document Ingestion & Scraping"]
        UserUpload["User Uploads PDF / TXT / MD / JSON or URL"] -->|POST multipart/form-data| ApiScrape["/api/scrape Endpoint"]
        ApiScrape -->|PDF Document| PDFParser["pdf-parse / Stream Reader"]
        ApiScrape -->|Web Page URL| WebScraper["Cheerio HTML Scraper"]
        PDFParser --> CleanText["Extracted Clean Text"]
        WebScraper --> CleanText
    end

    subgraph S2["2. RAG & AI Script Generation"]
        CleanText -->|POST Document Pages| StreamRoute["/api/demos/generate-stream Route"]
        StreamRoute -->|Step 1| DBCreate["Create Draft Demo in MongoDB"]
        DBCreate -->|Step 2 & 3| ChunkingEngine["Text Chunking Engine (800-char, 150 overlap)"]
        ChunkingEngine --> VectorEmbed["Gemini Vector Embeddings"]
        VectorEmbed --> MongoKBCache[("MongoDB KnowledgeChunks")]

        MongoKBCache -->|Step 4: Vector Retrieval| CosineSearch["Cosine Similarity Top-K Search"]
        CosineSearch -->|Step 5: LLM Synthesis| GeminiLLM["Gemini 2.5 Flash Model"]
        GeminiLLM --> ZodParser["Zod Schema Validator & Auto-Repair"]
        ZodParser -->|Step 6: Finalize| SaveDemo["Save Steps to Demo Schema"]
        SaveDemo -->|SSE Event: complete| FrontendRedirect["Redirect to /demos/:id"]
    end

    subgraph S3["3. Reviewer Audit Suite"]
        FrontendRedirect --> EditorUI["Visual Step Editor (/demos/:id)"]
        EditorUI --> ProgressTracker["Real-time % Verification Progress Bar"]
        EditorUI --> BatchVerify["Mark All Verified & Approve Production"]
        EditorUI --> CodeGenerator["Playwright & Puppeteer Script Generator"]
        CodeGenerator --> TestFiles["Download .spec.ts / .js Test Files"]
    end

    subgraph S4["4. Interactive Player & Voice Runner"]
        EditorUI -->|Launch Player| PlayerUI["Interactive Execution Player (/demos/:id/play)"]
        PlayerUI --> StepStack["Vertical Step Stack Navigator"]
        PlayerUI --> StepExecution["Step Execution & Highlight Panel"]
        StepExecution --> WebSpeech["Browser Speech Synthesis API (TTS)"]
    end
```

---

## 🧩 Detailed System Architecture

### 1. Ingestion & Scrape Engine (`app/api/scrape/route.ts`)

- **PDF Processing**: Receives binary PDF file buffers, processes text streams using `pdf-parse/lib/pdf-parse.js` to avoid serverless filesystem lookup errors, and falls back to text stream regex matching.
- **Web Scraping**: Uses Cheerio to fetch documentation URLs, strips boilerplate elements (`script`, `style`, `nav`, `footer`), and extracts clean content capped at 30,000 characters.

### 2. RAG & AI Synthesis Engine (`lib/llm/`)

- **Document Chunking (`lib/llm/rag.ts`)**: Splits documentation text into overlapping 800-character chunks with a 150-character window.
- **Resilient Multi-Model Vector Embeddings**:
  - Attempts vector embedding using `text-embedding-004`.
  - Automatically falls back to `embedding-001`.
  - If the user's Gemini key does not have embedding services active, it gracefully switches to **Direct Text RAG**, preventing 404 errors from breaking script synthesis.
- **RAG Context Retrieval**: Calculates cosine similarity between the focus query vector and indexed chunk vectors to select the top 8–10 most relevant context passages.
- **LLM Script Synthesis (`lib/llm/generateScript.ts`)**:
  - Transmits retrieved context and persona rules to `gemini-2.5-flash`.
  - Enforces structured JSON output matching `GeneratedScriptSchema` (Action types: `navigate`, `click`, `input`, `highlight`, `wait`, `say`, `scroll`).
  - Implements an automated retry loop to correct malformed JSON.

### 3. Server-Sent Events (SSE) Progress Pipeline (`app/api/demos/generate-stream/route.ts`)

- Opens an HTTP SSE connection (`text/event-stream`).
- Streams real-time progress events (Steps 1 through 6) to the client UI as vector chunking, embedding, and LLM synthesis take place.
- Emits a final `complete` event containing the generated `demoId`.

### 4. Reviewer Audit Suite (`components/Editor.tsx`)

- **Verification Tracker**: Computes live verification percentage (`verifiedCount / totalSteps * 100`) and displays a progress bar.
- **Batch Verification & Approval**: Allows reviewers to mark all steps as verified in one click or promote the script status to `approved`.
- **Timestamped Audit Notes**: Stores reviewer comments signed with `[Reviewer - Date]`.
- **Multi-Format Export Engine (`lib/exportGenerators.ts`)**:
  - Exports raw script to JSON, YAML, Markdown, Text.
  - Generates executable Playwright (`.spec.ts`) and Puppeteer (`.js`) browser automation test scripts with direct `.download` triggers.

### 5. Interactive Execution Player (`components/Player.tsx`)

- **Split Layout**:
  - **Left Rail**: Compact vertical stack of all steps with status indicators.
  - **Right Execution View**: Full-width interactive step execution view displaying target elements, expected outcomes, and narration text.
- **Text-To-Speech (TTS) Voice Narration**: Uses the browser-native `window.speechSynthesis` Web Speech API for instant voice narration without external API latency or costs.

### 6. Storage & Database Schema (`lib/models/`)

- **Demo Schema**: Stores title, customer name, status (`draft`, `in_review`, `approved`), version number, source pages, and array of step objects.
- **KnowledgeChunk Schema**: Stores demo-specific text chunks, document titles, URLs, and vector embedding arrays (`[Number]`).
- **Connection Management (`lib/db.ts`)**: Maintains global Mongoose connection caching to prevent connection pool exhaustion in serverless environments.

---

## 🔑 Key Design Decisions

1. **Unified Step Model**:
   - `Step` objects combine both **agent execution attributes** (`action`, `narration`, `expectedOutcome`) and **human review attributes** (`sourceRef`, `status`, `notes`) in one document. This ensures that edits in the UI immediately update what the agent executes without parallel structure drift.

2. **Decoupled Export Contract**:
   - `GET /api/demos/[id]/export` strips human-review metadata (`sourceRef`, `notes`, `status`), serving only execution properties and a `version` hash. This allows the authoring UI to evolve independently of the runner contract.

3. **Script Versioning**:
   - Every saved edit increments the `version` integer, enabling running agents to detect when a script was modified mid-demo.

---

## 🚀 Setup & Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables in .env
MONGODB_URI="mongodb://localhost:27017/demo-script-builder"
GEMINI_API_KEY="your-gemini-api-key"
GEMINI_MODEL="gemini-2.5-flash"

# 3. Launch local development server
npm run dev
```

---

## 🤖 Agent Export Contract (`GET /api/demos/[id]/export`)

Returns clean machine-executable JSON stripped of human-review fields for autonomous agent runners:

```json
{
  "id": "6a7ce1f909729d47c81e835a",
  "title": "Create a Project Demo",
  "version": 2,
  "steps": [
    {
      "order": 1,
      "title": "Navigate to Dashboard",
      "narration": "Let's start on the main dashboard screen.",
      "action": {
        "type": "navigate",
        "target": "Dashboard Screen",
        "value": "/dashboard"
      },
      "expectedOutcome": "Dashboard is loaded and visible."
    }
  ]
}
```
