it broke the functionality. it is analyzing, giving suggestions, and then suddenly suggestions disappears and tick mark displayed

🧠 AuroraWrite — Issue State Machine & Stability Guard
======================================================

**Purpose:** Prevent verification passes from clearing valid user-facing suggestions and eliminate race conditions between analyzers and UI.

* * *

🎯 Problem Statement
====================

The Stability Pass currently:

*   Runs while unresolved issues exist
    
*   Overwrites `block.issues`
    
*   Forces UI into a “clean” state prematurely
    

This causes:

> Suggestions flash → disappear → green tick appears

* * *

🏗️ Target Architecture
=======================

Implement an **Issue Lifecycle State Machine** and **Stability Guard**

* * *

🧩 Core Model Changes
=====================

Extend Issue Model
------------------

`type IssueStatus = "new" | "applied" | "verified" | "stale"  interface Issue {   id: string   message: string   startOffset: number   endOffset: number   suggestion: string   source: "analysis" | "verification"   status: IssueStatus }`

* * *

Extend BlockState
-----------------

`interface BlockState {   id: string   text: string   hash: string   issues: Issue[]   version: number    confidence: number   passes: number   hasUnappliedIssues: boolean   isVerifying: boolean }`

* * *

🔒 Stability Guard Rules (CRITICAL)
===================================

Stability pass is allowed ONLY if:
----------------------------------

`hasUnappliedIssues === false AND isVerifying === false AND userIdle >= 1000ms`

* * *

🔁 Verification Merge Rules
===========================

Verification pass must:

*   NEVER delete existing `analysis` issues
    
*   ONLY add new issues with:
    
    
    
    `source = "verification" status = "new"`
    
*   If no new issues found:
    
    *   Only update `confidence` and `passes`
        
    *   DO NOT touch `issues[]`
        

* * *

⚡ UI Rendering Rules
====================

UI must:

*   Show suggestions if ANY issue exists where:

    `status === "new"`
    
*   Only show green tick if:
    

    
    `issues.length === 0 OR all issues.status === "verified"`
    

* * *

🔄 Suggestion Apply Flow
========================

When user applies suggestion:


`issue.status = "applied" block.hasUnappliedIssues = false IF no issues.status === "new"`

Then:

*   Mark block dirty
    
*   Restart incremental analysis
    
*   Cancel verification
    

* * *

🛡️ Race Condition Protection
=============================

Request Token System
--------------------

Each AI call gets:


`requestId = uuid() block.activeRequestId = requestId`

When response arrives:

`if (response.requestId !== block.activeRequestId) {   discard() }`

This prevents old verification calls from overwriting fresh analysis results.

* * *

🧪 Required Tests
=================

Unit
----

*   Stability guard logic
    
*   Issue lifecycle transitions
    
*   Merge rules
    

Integration
-----------

*   Suggestions persist during verification
    
*   Verification does not clear analysis issues
    
*   Old AI responses are discarded
    

* * *

🚦 Milestones
=============

Milestone 1
-----------

*   Implement Issue model + status
    
*   Add `hasUnappliedIssues` + `isVerifying`
    

Milestone 2
-----------

*   Stability guard
    
*   Merge rules
    
*   Request token system
    

Milestone 3
-----------

*   UI logic update
    
*   Tests
    

* * *

🔚 Final Instruction for Claude
===============================

> Verification must NEVER remove visible issues.  
> Only user actions can clear suggestions.  
> Enforce request token validation.  
> Pause after each milestone.

* * *

🎯 Result
=========

This will give you:

*   Stable suggestions (no flashing)
    
*   Safe multi-pass verification
    
*   No race conditions
    
*   Professional-grade UX
    

* * *

If you want, I can also give you a **TypeScript reference implementation for the request token + merge logic** — this is the hardest part to get right and saves hours of debugging 🔥