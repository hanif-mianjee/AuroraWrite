
# 🧠 AuroraWrite — Incremental AI Text Analysis Architecture
**Purpose:** Eliminate input-text re-analysis, reduce LLM API calls, improve latency, and enable Grammarly-scale performance.

---

## 🎯 Problem Statement

The current Chrome extension re-sends the **entire input text** to the AI analyzer whenever:
- A suggestion is accepted
- A transformation is applied
- The user types

This causes:
- High token usage
- High latency
- Duplicate detection of already-fixed issues
- Poor UX at scale

---

## 🏗️ Target Architecture

Implement **Incremental Block-Based Analysis with Local State Caching**

> Only re-analyze the text blocks that actually changed.

---

# 🧩 Core Concepts

## 1. Input Text State Store

```ts
interface InputTextState {
  text: string
  version: number
  blocks: BlockState[]
}

interface BlockState {
  id: string
  startOffset: number
  endOffset: number
  hash: string
  text: string
  issues: Issue[]
  version: number
}
```

---

## 2. Block Strategy

Split the input text into **stable logical units**:
- Paragraphs (preferred)
- OR sentences
- OR fixed-size chunks (300–500 characters max)

Each block must be:
- Independently hashable
- Independently analyzable
- Independently updatable

---

## 3. Hashing System

```ts
function hashBlock(text: string): string
```

Used to detect changes efficiently.

---

# 🔍 Change Detection Flow

## On Any Text Change

### Step 1 — Split into blocks
```ts
const newBlocks = splitIntoBlocks(newText)
```

### Step 2 — Compare hashes
```ts
const dirtyBlocks = newBlocks.filter((block, i) => {
  return block.hash !== InputTextState.blocks[i]?.hash
})
```

Only these blocks are sent to AI.

---

# 🌐 AI Call Strategy

## Old (Bad)
```
POST /analyze
{ fullInputText }
```

## New (Good)
```
POST /analyze/block
{
  blockId,
  blockText,
  previousBlockText,
  nextBlockText,
  textTone,
  userSettings
}
```

---

# 🔁 Result Merge Strategy

```ts
function mergeBlockResult(blockId: string, issues: Issue[]) {
  const block = InputTextState.blocks.find(b => b.id === blockId)
  block.issues = issues
  block.version++
  InputTextState.version++
}
```

---

# ⚡ Suggestion Acceptance Optimization

> Accepting a suggestion must NEVER trigger AI analysis.

Flow:
1. Apply text change locally
2. Remove that issue from block cache
3. Re-hash block
4. Mark block clean
5. Update UI

---

# ⏳ Debounce System

```ts
onUserTyping() {
  debounce(runBlockAnalysis, 700)
}
```

---

# 🧠 Two-Tier Analysis System

| Tier | Engine | Purpose |
|------|--------|----------|
| Fast | Local rules | Spelling, punctuation, spacing |
| Deep | LLM | Tone, clarity, style, rewrites |

---

# 📦 Chrome Extension Architecture

```
/state
  inputTextStore.ts
/block
  blockSplitter.ts
  blockHasher.ts
/ai
  blockAnalyzer.ts
/merge
  resultMerger.ts
/ui
  suggestionController.ts
```

---

# 🛡️ Safety Rules

- Never trust AI offsets blindly
- Validate all block offsets before applying
- If mismatch detected → full block re-analysis fallback

---

# 📊 Performance Targets

| Metric | Target |
|--------|--------|
| API calls per session | -70% |
| Token usage | -75% |
| Suggestion latency | <300ms |
| UI frame drops | 0 |

---

# 🧪 Required Tests

## Unit
- Block splitting
- Hash consistency
- Dirty block detection
- Issue merge correctness

## Integration
- Suggestion acceptance flow
- Multi-block typing behavior
- Context injection accuracy

---

# 🚦 Milestones

## Milestone 1
- Implement block splitter
- Implement hash system
- Build input text store

## Milestone 2
- Dirty block detection
- AI block analyzer
- Result merger

## Milestone 3
- Suggestion acceptance optimization
- Debounce system
- Performance logging

---

# 🔚 Final Instruction for Claude

> Implement this system incrementally.  
> Pause for review after each milestone.  
> Do not optimize or refactor beyond this spec unless requested.
