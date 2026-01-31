
# 🧠 AuroraWrite — Stability Pass & Recursive Improvement System

**Purpose:** Ensure multi-layer writing issues (grammar → tense → agreement → style) are fully resolved even when earlier fixes unlock new errors, without re-triggering full-document analysis or infinite AI loops.

---

## 🎯 Problem Statement

Current system stops analysis once:
- All known issues are applied
- All blocks are marked clean

But many writing errors are **dependency-based**:
> Fixing spelling often reveals grammar, tense, or agreement issues.

**Example:**
> “I definately recieve the documents you sended me”  
Spelling fix reveals:  
> “I definitely receive the documents you sent me”

This requires **multi-pass verification**.

---

# 🏗️ Target Behavior

Implement a **Controlled Recursive Stability Pass**

> After all suggestions are applied, run a *low-cost verification sweep* to detect newly exposed issues — without increasing token cost or creating infinite AI loops.

---

# 🧩 Core Concepts

## 1. Block Confidence State

Extend `BlockState`:

```ts
interface BlockState {
  id: string
  text: string
  hash: string
  issues: Issue[]
  version: number

  confidence: number // 0.0 → 1.0
  passes: number
}
```

---

## 2. Confidence Scoring Rules

Each block earns confidence:
- `+0.4` when AI returns no issues
- `+0.2` when user applies all suggestions
- `-0.3` if new issues appear after a pass

Block is considered **stable** when:
```
confidence >= 0.8 AND passes >= 1
```

---

# 🔁 Stability Pass Trigger

## Trigger Conditions

Run a stability pass when:
- All blocks are marked clean
- No dirty blocks exist
- User is idle for `1000ms`

---

# 🌐 Stability Pass Strategy

## Rule
> Stability pass is ALWAYS block-based, NEVER full-document.

---

## Sweep Logic

```ts
const unstableBlocks = blocks.filter(b =>
  b.confidence < 0.8 || b.passes === 0
)
```

Only send these blocks to AI.

---

# 🤖 AI Prompt Mode

Use a **Verification Prompt**, not a full analysis prompt:

```
You are a writing verification agent.
Check this text for any remaining grammar, tense, agreement, or clarity issues
that may have appeared after previous corrections.
Return ONLY newly discovered issues. If none exist, return an empty list.
```

This reduces token usage by ~60%.

---

# 🔁 Pass Control System

## Loop Guard

Each block must enforce:
```
maxPasses = 2
```

If:
```
passes >= maxPasses
```
Block is forced into **stable** state.

---

# 🔄 Merge Logic

When AI responds:
- If issues found:
  - Replace block issues
  - `confidence -= 0.3`
- If no issues:
  - `confidence += 0.4`
  - `passes++`

Clamp confidence between `0.0` and `1.0`.

---

# ⚡ UX Rules

## Suggestion Application Flow

If a suggestion is applied during a stability pass:
- Cancel all pending stability requests
- Mark block dirty
- Restart incremental analysis flow

---

# 📊 Performance Constraints

| Metric | Limit |
|--------|--------|
| Stability API calls | Max 1 per block |
| Verification token budget | ≤ 40% of normal |
| Infinite loop risk | 0 |

---

# 🧪 Required Tests

## Unit
- Confidence score math
- Pass counter behavior
- Loop guard enforcement

## Integration
- Spelling → grammar reveal flow
- Multi-block stabilization
- Idle-triggered sweep
- Cancellation on user input

---

# 🚦 Milestones

## Milestone 1
- Extend block state
- Implement confidence scoring
- Implement pass counter

## Milestone 2
- Stability trigger system
- Verification AI prompt mode
- Loop guard

## Milestone 3
- UX cancellation logic
- Performance logging
- Tests

---

# 🔚 Final Instruction for Claude

> Implement this system incrementally.  
> Never perform full-document AI calls.  
> Enforce max passes strictly.  
> Pause for review after each milestone.
