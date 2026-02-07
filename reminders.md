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
