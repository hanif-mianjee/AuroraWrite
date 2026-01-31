# Reminders

**DO NOT BREAK ANY FUNCTIONALITY**
**Pleae fix following bugs:**

- Ignore all is working but ignore is not working, after clicking ignore, the same thing was analyzed again and suggested, please fix this.
- Is tone is analyzed and appears in suggestions? I never seen anything for tone, please check and fix it.
- Transformer text selection is detecting every text selection on the page, it should only work on inputs.
- Fix all spelling button is not applying fix to all the spelling erros, it just applies to first one, please fix this.
- Transformer button is not appearing correctly, it should appear underneath the selected text and transformer popover should open underneeth the selected text like a drop down popover. check attached images.

**DO NOT BREAK ANY FUNCTIONALITY**
**Please implement following improvements:**

- Ignore all is confusing, change it to ignore forever or always ignore.
- Ad support for more llms and models like Google gemeni, OpenAI, meta AI, if they support API integration. Implement factory pattern so we can add more llms in the future. Make it future proof.
- Make categories future proof, so we can add more categories in the future.
- Make transformers future proof so we can add more transformers in the future. 
- In the transformer popover, when user enter instructions, display custom in the above list and when user select any other option, hide the custom and empty input field.

**DO NOT BREAK ANY FUNCTIONALITY**


## Improvements

- Transformer pop-over does not cache tab responses. It is transforming on every tag change. Switching to previous tag should use cached text.
- The text input need to be cached. Every time when I apply correction from the suggestion, or improvements, or other chanages suggestion from the option, the analyzer detects the change check the entire text again. This increases the API calls. What is the better way to improve this?

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