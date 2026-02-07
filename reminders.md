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
√ Fix offset issue:
In this AI writing assistant chrome extension, I face a bug. Below is the detail, please analyze the code, find why is the issue. Similar functionality is in many places like applying suggested corrections or improvements, applying to multiple places, replacing text, replacing phrases.

Bug:
When I apply the suggestions one by one the first suggestion applied correctly on correct place, but for the other suggestions, they applied to wrong possition. I suspect that is because start and end is now change due to first suggestion applied with different character count. Can you please analyze and let me know what is the issue and in which places, there could be multiple places.

---

√ Wrong category bug:

For the following text, "I recieved your mesage yesterday. The accomodation was excelent and the resturant had delicous food. I definately recomend visiting this beautful city. Tommorow I will send you more informaton about the confrence.", why all the suggestions category either it is "Grammar" or "Tone", the expected category is "Spelling". This issue is happening for all the texts that I give for analysis. It always picks the wrong categories.

Can you please analyze the suggestion system, the prompts, the category selection system, and check what is the issue, how can we fix it or improve it, without changing the the current functionality. Please note, changing the prompt can cause entire system to malfunction, increase the API token cost. Please be mindfull, analyze in detail, then apply the fix. Please think hard, spend time to reason. Please make the system 100% perfect.

---

√ Please check the code for underline system. For the firsts time, the underlines are placed correctly, but when I applied the suggestion, the offset is updated for the next suggesions, but the underlines remains on the same possitions. This also happening when a suggestion is applied, system reanalyzed the text, the old suggestions remains on the same possition, some time outside the suggestion words. Can you please analyze the issue/bug and fix it for all the categories. Please sure you do not break the existing functionality

---

√ Why analysis triggered every apply. Can you please analyze why it is reanalizing when user applied any suggestion? Does this not cost API calls. Is this unnessary to reanalyze. What should be the best practice for a spelling checking software. what the does grammarly do for the same situations? Pleae analyze suggest best solution that is best for the user experience and also best for the API calls.

---

When user applies the suggestion anywhere in the middle of the text which change the offsets, all the following underlines posstions get missplaced. This is happening suggestions applied one by one. I have noticed this issue in spelling category suggesion at the movement, but could be happening in other categories as well. Can you please check the root cause. Don't analyze the surface-level. You must fix this issue smartly without breaking any existing functionality. 

One suggestion that I could give is that when a suggestion is applied, remove all the underlines and the eventlisteners, then recreate all the underlines using the new offsets for all the categories. and register the events. use the existing logic for creating underlines but with new offsets.

make sure this don't cause memory or performance issue for the long lists of suggestions. Do not break existing code or break business logic.

---


# Prompts

## Screenshot generator

Based on the screenshot requirements (highlith the screenshot part from the guide), create a html page with all these requirements. I will open the html page in browser, take the screenshots of the different different parts and save them in JPEG.

HTML page should cover all the possible screenshots from the recommendations.

HTML page should also have all the icon size that I can simply save them as png.

## Generate options page and home page

Please explore entire project, understand what it is about, what features, it has, what problems it solves, how does this works, how it helps to increase productivity, how it is different from the other writing assistant apps,  and create following:

- A professional and elegent looking Welcome page, that opens after extentions installed and upadated
- Professional Home page with all the details and features, policies, credits, links, repo, how-to section, hero section with UI elements from the extentions, animations
- Implement npm versioning and also dynamically show the version in options page, welcome page, home page, readme
- create readme with minimum information about the project, features, functionalities, architecture, extending functionality, setup guide, packaging guide, publishing guide, build, etc.  
- Use plugin to plugin ui-ux-pro-max@ui-ux-pro-max-skill
- create design guide
- Repo URL: https://github.com/hanif-mianjee/AuroraWrite

Please thinkhard, use your creative libertities, design professionaly, clean, modern, intutive, functional, design that everyone loves.
