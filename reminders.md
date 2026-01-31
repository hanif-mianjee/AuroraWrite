# Reminders


# 🔚 Final Instruction for Claude

> Implement this system incrementally.  
> Pause for review after each milestone.  
> Do not optimize or refactor beyond this spec unless requested.

---

**I spotted a bug in the AI suggestion quality:**

Original text: The meeting was went well yesterday...

Fixing: went -> was at 16

New text: The meeting was was well yesterday...

The AI incorrectly suggested changing "went" → "was", which created "was was" (a duplicate word). The correct fix for "was went" should have been:

- Either remove "was" → "The meeting went well...
- Or remove "went" → "The meeting was well..." (though this changes meaning)

This is an LLM response quality issue, not a code bug. The prompt tells the AI to find the "smallest valid span", but it's only finding "went" instead of the phrase "was went".

**Potential improvement:** The prompt could be enhanced to better detect repeated/duplicate word issues and provide the correct minimal fix. Would you like me to adjust the system prompt to better handle these cases?

---