# Operon

An AI operations layer for travel agencies that automates hotel booking workflows through intelligent planning and execution.

Operon uses a locally running LLM (llama3.2:3b via Ollama) to handle the full booking lifecycle: collecting customer preferences through natural chat, searching contracted hotel pools, presenting options, gathering personal details via checklist, and dispatching reservation documents to hotels.

## Prerequisites

- **Node.js** >= 18
- **npm** >= 9
- **macOS** (Ollama install below uses Homebrew; see [ollama.com](https://ollama.com) for other platforms)

## Setup

### 1. Clone and install dependencies

```bash
git clone <repo-url> && cd Operon
npm install
```

### 2. Install Ollama and pull the LLM

```bash
# Install Ollama
brew install ollama

# Start the Ollama background service
brew services start ollama

# Pull the llama3.2 3B model (~2 GB download)
ollama pull llama3.2:3b
```

Verify the model is running:

```bash
ollama list
# Should show: llama3.2:3b
```

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Pages

| Route | Description |
|---|---|
| `/` | Dashboard with booking pipeline, stats, and recent bookings |
| `/chat` | Chat UI for handling customer conversations with LLM-driven workflow |
| `/bookings` | Booking list with search and status filters |
| `/bookings/[id]` | Booking detail with customer info, hotel options, and contract preview |
| `/hotels` | Contracted hotel catalog with room types and pricing |

## Booking Workflow

The chat-driven workflow progresses through these stages automatically:

1. **Collecting Preferences** — LLM extracts destination, dates, guests, budget, room type from natural conversation
2. **Hotel Matching** — Rule-based search filters the contracted hotel pool, LLM presents results conversationally
3. **Option Selection** — LLM parses customer's choice (supports negotiation and rejection)
4. **Personal Info Collection** — Checklist-driven: LLM asks for name, passport, nationality, email, phone
5. **PDF Generation & Dispatch** — Dummy PDF created, dummy email sent to hotel (replace with real services)
6. **Confirmation** — Simulated hotel confirmation (replace with real webhook/polling)

## Project Structure

```
src/
  app/
    page.tsx                   # Dashboard
    chat/page.tsx              # Chat UI
    bookings/page.tsx          # Booking list
    bookings/[id]/page.tsx     # Booking detail
    hotels/page.tsx            # Hotel catalog
    api/
      bookings/route.ts        # Booking CRUD
      chat/route.ts            # Chat + workflow orchestration
      hotels/route.ts          # Hotel pool
      matching/route.ts        # Hotel matching
      templates/route.ts       # Contract template fill
      dispatch/route.ts        # Reservation dispatch
      llm/route.ts             # LLM health check
  components/
    layout/                    # Sidebar, Header
    ui/                        # StatusBadge
  lib/
    types.ts                   # Data models
    mock-data.ts               # Sample hotels, bookings, messages
    store.ts                   # In-memory store (replace with DB)
    utils.ts                   # Formatting helpers
    services/
      llm.ts                   # Ollama client with 6 optimized prompts
      workflow.ts              # Booking state machine
      matching.ts              # Hotel filtering + scoring
      extraction.ts            # Regex-based extraction (legacy fallback)
      template.ts              # Contract template selection + fill
      dispatch.ts              # Reservation send + confirmation
      pdf-dummy.ts             # Dummy PDF generation + email
```

## Environment Variables (optional)

| Variable | Default | Description |
|---|---|---|
| `OLLAMA_URL` | `http://localhost:11434` | Ollama API endpoint |
| `OLLAMA_MODEL` | `llama3.2:3b` | Model to use for inference |

## Integration Points

The following are currently mocked and ready for real service integration:

- **PDF generation** — `src/lib/services/pdf-dummy.ts` (swap in pdf-lib or puppeteer)
- **Email dispatch** — same file (swap in nodemailer or SendGrid)
- **Hotel confirmation** — auto-simulated in `workflow.ts` (swap in webhook/polling)
- **Database** — `src/lib/store.ts` is an in-memory singleton (swap in SQLite/PostgreSQL)
- **Chat channels** — currently web-only (integrate WhatsApp/WeChat APIs)
- **LLM provider** — currently local Ollama (can swap to Claude API or other providers)
