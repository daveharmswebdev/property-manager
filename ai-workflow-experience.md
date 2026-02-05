# AI-Assisted Development: Lessons from Property Manager

## The Stack
Angular 20 + .NET 10 + PostgreSQL, using BMad Method for planning and Claude Code for implementation.

## Planning Phase
Created foundational docs through AI-guided workflows: **PRD → Requirements → Architecture → UX**. These aren't throwaway artifacts—they get updated as the project evolves (brownfield development). When I added Work Orders after completing Expenses, all docs were updated and new epics/stories added.

## Daily Development Workflow

1. **Scrum Master Agent** → Creates refined story from epics (`/bmad:bmm:workflows:create-story`)
2. **Dev Agent** → Implements via TDD: backend, frontend, unit tests, integration tests, e2e (`/bmad:bmm:workflows:dev-story`)
3. **Push & PR** → New branch, push changes, create PR, let CI/CD run
4. **Clear Context** → If CI fails, copy the action hash, clear Claude context, have it fix
5. **Code Review** → Clear context again, run AI code review, fix issues, push

**Key insight:** Clearing context between phases prevents accumulated confusion and lets git history provide the necessary context.

## Entropy is Real

Claude makes mistakes. The longer a session runs, the more confusion accumulates. **Layers of verification matter:**
- TDD catches implementation errors early
- CI/CD catches what tests miss
- Code review (with fresh context) catches what CI misses
- Manual QA catches edge cases

Tech debt still happens. I track bugs and debt as GitHub issues, then have Claude address them in focused sessions. The issue tracker becomes another source of truth.

## Documentation as a Superpower

Claude's documentation stamina is an underrated asset. It will write detailed specs, update architecture docs, generate comprehensive test descriptions, and maintain consistency across artifacts—work that would burn out a human. Lean into this. Good docs compound over time and make every future AI session more effective.

## Parallel Work with Git Worktrees

Ran two features simultaneously:
- Main worktree: Work Orders feature
- Secondary worktree: Adding photos to Properties (refactoring existing receipt photo code)

Merge conflicts happened. Claude handled them cleanly—no git-astrophes.

## This Workflow is Already "Old Fashioned"

My approach requires near-constant monitoring and medium-to-heavy interaction. According to [Anthropic's 2026 Agentic Coding Trends Report](https://resources.anthropic.com/hubfs/2026%20Agentic%20Coding%20Trends%20Report.pdf), the industry is moving toward long-running autonomous agents—think YOLO mode, where agents run for hours without human confirmation. Rakuten ran Claude against a 12.5M-line codebase autonomously for seven hours.

I haven't tried YOLO mode yet. Claude Code upgrades weekly; what worked six weeks ago feels dated now. I'm sticking with BMad because I don't change horses midstream, but I recognize my supervised workflow may soon look quaint.

The tradeoff is real: unsupervised agents are faster but riskier. My layered verification approach is slower but catches more. As tooling matures, the balance will shift.

## But We're Still Engineers

I recently added CodeQL and Dependabot to the project. That kind of security infrastructure doesn't get one-shot into existence. You don't YOLO your way to a mature CI/CD pipeline.

AI changes how code gets written, but engineering isn't just writing code. It's DevOps, Git workflows, security scanning, dependency management, observability—the full milieu. We never one-shot applications before; why would we now just because we can?

Just because you *can* one-shot an app doesn't change the nature of engineering.

## What Works (For Now)

- **Structured planning docs** give AI consistent context across sessions
- **TDD enforcement** through the dev workflow catches issues early
- **GitHub as source of truth** means clearing context is safe—commit messages and diffs provide history
- **Agent specialization** (scrum master vs dev vs reviewer) keeps each session focused

---

## The Other Side: What Keeps Me Up at Night

Everything above describes what's working. What follows is what's not — or at least, what should give us pause. These aren't hypothetical concerns. They're things I've experienced firsthand and that the research is starting to confirm.

### 1. We Built a Single Point of Failure

When Claude Code goes down, I stop working. Full stop. It's not like losing a convenience — it's like a highway shutdown. There's no alternate route because the entire workflow is AI-dependent: planning, implementation, code review, even documentation. The code is AI-written. The processes are AI-driven. Switching to "just write it by hand" isn't realistic when you're this deep in.

This isn't unique to me. [82% of developers now use AI coding assistants daily or weekly](https://www.secondtalent.com/resources/ai-coding-assistant-statistics/). We've moved past experimentation into dependency. And dependency without redundancy is a risk any engineer would flag in a system design review.

MIT Technology Review profiled an engineer at Companion Group who started a side project without AI tools and [found himself struggling with tasks that used to be instinct](https://www.technologyreview.com/2025/12/15/1128352/rise-of-ai-coding-developers-2026/). "Things that used to be instinct became manual, sometimes even cumbersome." Skill atrophy is real, and it's the hidden cost of tight coupling.

### 2. The Churn Is Exhausting

Claude Code versions up once or twice a week. The changelog is at the top of my browser history. One day this LLM is the best. Another day this harness changes everything. Another day this MCP server is the future. Another day MCPs are irrelevant. It's worse than JavaScript fatigue because at least JavaScript frameworks pretended to be stable for six months.

The data backs this up. [Stack Overflow's 2025 Developer Survey](https://stackoverflow.blog/2025/12/29/developers-remain-willing-but-reluctant-to-use-ai-the-2025-developer-survey-results-are-here/) found that developer trust in AI tools is *falling* even as usage rises. "AI integration" ranked second to last among features developers actually value. What they want is reliability and robust APIs — boring, stable things.

[Chainguard's 2026 Engineering Reality Report](https://www.prnewswire.com/news-releases/chainguard-research-shows-engineers-struggle-with-burnout-maintenance-and-tool-sprawl-despite-ai-gains-302577843.html) found that only one in three engineers say they spend the majority of their time on work that energizes them. 48% of companies are running two or more AI coding tools simultaneously — not because they've found the right one, but because they're still searching. That's not productivity. That's thrashing.

[Fortune reported](https://fortune.com/2025/06/11/ai-companies-employee-fatigue-failure/) that AI fatigue is setting in across organizations as proofs of concept keep failing. And a [Quantum Workplace study](https://medium.com/@asarav/ai-fatigue-is-widespread-now-211ad4dd9656) found that frequent AI users report *higher* burnout (45%) than those who never use AI (35%). The tools that are supposed to reduce toil are creating new forms of it.

### 3. The Hype Machine Is Toxic

The social media discourse around AI development is almost unusable. Every day: "Don't miss out on these new features!" "Claude just changed everything forever!" "You're doing AI wrong!" It's engagement farming disguised as education.

MIT Technology Review called it [the era of "hype first, think later."](https://www.technologyreview.com/2025/12/23/1130393/how-social-media-encourages-the-worst-of-ai-boosterism/) They cited OpenAI's Sébastien Bubeck announcing on X that GPT-5 had "solved 10 unsolved math problems" — framing a useful but modest capability (literature search) as a scientific revolution. The gap between what gets posted and what actually happened is a chasm.

[The "great AI hype correction"](https://www.technologyreview.com/2025/12/15/1129174/the-great-ai-hype-correction-of-2025/) is MIT Tech Review's term for what happened in 2025: reality caught up with promises. Generative AI has entered what [Gartner calls the "Trough of Disillusionment,"](https://www.pragmaticcoders.com/blog/gartner-ai-hype-cycle) and AI agents — the current hype driver — are expected to follow the same curve within 2-3 years.

The clickbait isn't just annoying — it's harmful. It creates anxiety, makes rational tool evaluation nearly impossible, and pressures teams into adopting things they don't need. When everything is a "gamechanger," nothing is.

### 4. The Uncomfortable Data Point

Here's the number that should make every AI-enthusiast presentation uncomfortable: [METR's randomized controlled trial](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/) studied experienced open-source developers and found that AI tools **increased completion time by 19%**. Developers *thought* they were 24% faster. They were actually slower.

This doesn't mean AI is useless. It means the gap between perceived and actual productivity is enormous, and we're making organizational decisions based on the perceived number. That should concern everyone.

### 5. So What Do We Do?

I'm not arguing we should stop using AI. I use it every day and my Property Manager project wouldn't exist without it. But I am arguing for clear-eyed honesty about the tradeoffs:

- **Build redundancy into your workflow.** If your AI tool goes down, can you still ship? If the answer is no, that's an engineering problem.
- **Maintain your fundamentals.** Code without AI sometimes. Keep the muscle memory alive. The engineer who can't function without autocomplete is fragile.
- **Ignore the hype cycle.** Pick your tools, learn them deeply, and stop chasing every new announcement. Depth beats breadth. [TechCrunch predicts 2026 is when AI moves from hype to pragmatism](https://techcrunch.com/2026/01/02/in-2026-ai-will-move-from-hype-to-pragmatism/) — be pragmatic now.
- **Measure actual outcomes, not vibes.** Track your real velocity, not how fast it *feels*. The METR study exists because someone bothered to measure.
- **Demand stability from your tools.** The Stack Overflow survey is clear: developers want reliability over AI integration. We should say that out loud.

The tools are genuinely powerful. The workflow I described in the first half of this talk is real, and it works. But so are the risks. Engineering has always been about managing tradeoffs — AI doesn't change that. It just adds new ones to the list.

---

## The Bigger Picture: AI Beyond Our Editor

I want to end on something more personal. Everything I've said so far is about software engineering — our world, our tools, our workflows. But I'd be dishonest if I didn't acknowledge the dichotomy I carry around every day: **I love AI for software development. I worry about AI for society.**

I lean toward quality. I'm not using AI just to write code faster — I'm using it to enforce TDD, maintain architecture documents, run adversarial code reviews, and practice good engineering discipline. For *my* work, AI is a force multiplier for quality, not just speed. I genuinely believe I'm more productive and producing better software because of it.

But zoom out, and the picture gets uncomfortable.

### The Economics Don't Add Up

OpenAI [expects to lose $14 billion in 2026](https://www.rdworldonline.com/facing-14b-losses-in-2026-openai-is-now-seeking-100b-in-funding-but-can-it-ever-turn-a-profit/) and has made [$1.4 trillion in commitments](https://techstrong.ai/articles/openais-financial-crisis-a-1-4-trillion-gamble/) for energy and compute — against revenue that barely crossed $20 billion in 2025. Deutsche Bank estimates a [cumulative negative free cash flow of $143 billion](https://fortune.com/2025/11/12/openai-cash-burn-rate-annual-losses-2028-profitable-2030-financial-documents/) from 2024 to 2029 before the company turns profitable. A New York Times analysis warned OpenAI [could face bankruptcy by mid-2027](https://www.tomshardware.com/tech-industry/big-tech/openai-could-reportedly-run-out-of-cash-by-mid-2027-nyt-analyst-paints-grim-picture-after-examining-companys-finances) if trends persist. 95% of ChatGPT's 800 million users don't pay.

And it's not just OpenAI. The AI infrastructure investment gap is staggering: in 2026, [global AI infrastructure investment approached $400 billion annually, while enterprise AI revenue remained capped at roughly $100 billion](https://www.ainvest.com/news/ai-bubble-2026-ai-hype-overinflating-tech-stocks-2512/). An [MIT Media Lab report](https://fortune.com/2026/01/04/is-ai-boom-bubble-pop-tech-stocks-sp500-bull-run/) found that despite $30-40 billion in enterprise investment into generative AI, 95% of organizations are getting zero return. [54% of global fund managers](https://en.wikipedia.org/wiki/AI_bubble) view AI-related stocks as being in "bubble territory." Even Sam Altman himself said in 2025 that he believes an AI bubble is ongoing.

Some of the financing is circular. Nvidia committed up to $100 billion to OpenAI — money that, [as OpenAI's CFO acknowledged, "will go back to Nvidia"](https://blog.carnegieinvest.com/the-risks-facing-openai-and-its-1.4t-in-spending-commitments) in GPU purchases. That's not investment. That's a money loop.

### The Environmental Cost Is Real

[U.S. data centers consumed 183 TWh of electricity in 2024](https://www.pewresearch.org/short-reads/2025/10/24/what-we-know-about-energy-use-at-us-data-centers-amid-the-ai-boom/) — more than 4% of the country's total electricity, roughly equivalent to Pakistan's entire annual demand. By 2026, global data center electricity consumption is [expected to approach 1,050 TWh](https://research.aimultiple.com/ai-energy-consumption/), which would rank data centers fifth on the global list between Japan and Russia if they were a country.

This has direct costs for regular people. In the PJM electricity market (Illinois to North Carolina), data centers [accounted for a $9.3 billion price increase](https://www.pewresearch.org/short-reads/2025/10/24/what-we-know-about-energy-use-at-us-data-centers-amid-the-ai-boom/), with residential bills rising $16-18 per month. A [Carnegie Mellon study](https://www.pewresearch.org/short-reads/2025/10/24/what-we-know-about-energy-use-at-us-data-centers-amid-the-ai-boom/) estimates data centers could drive an 8% increase in the average U.S. electricity bill by 2030 — exceeding 25% in northern Virginia.

U.S. data centers directly consumed [17 billion gallons of water](https://www.congress.gov/crs-product/R48646) for cooling in 2023, a figure that could quadruple by 2028.

### What Are We Actually Getting?

And here's the question that haunts me: what is all this cost and disruption *for*?

For software engineers like us, the answer is clear — better tools, higher productivity, quality enforcement. But for society at large? A [projected 8 million deepfakes will be shared in 2025](https://deepstrike.io/blog/deepfake-statistics-2025). Europol estimates [90% of online content may be synthetically generated by 2026](https://www.openfox.com/deepfakes-and-their-impact-on-society/). [96-98% of all deepfake videos](https://deepstrike.io/blog/deepfake-statistics-2025) are non-consensual intimate imagery, overwhelmingly targeting women. Deloitte predicts AI-driven fraud losses will grow from [$12.3 billion in 2023 to $40 billion by 2027](https://deepstrike.io/blog/deepfake-statistics-2025). Only [9% of adults feel confident they can identify a deepfake](https://keepnetlabs.com/blog/deepfake-statistics-and-trends).

When you ask consumers what they actually want from AI, the [answers are modest](https://www.deloitte.com/us/en/insights/industry/telecommunications/connectivity-mobile-trends-survey.html): help writing emails, comparing prices, summarizing reviews. And the thing they want most? [Make it easier to reach a human when needed.](https://kinsta.com/blog/ai-vs-human-customer-service/) That's the top consumer demand. Not more AI — a faster path *through* the AI to a person.

Is AI going to make people happier? Closer to their loved ones? The honest answer is: nobody is even asking that question. The industry is optimizing for capability, not human flourishing.

I hear the promise of better pharmaceuticals, scientific breakthroughs, accelerated research. That may prove true and genuinely great. But we'll be living longer in a world with more synthetic content, more fraud, more erosion of trust, and more energy consumed to power it all.

### "The production of too many useful things results in too many useless people."

That's Karl Marx, from the [Economic and Philosophical Manuscripts of 1844](https://www.goodreads.com/quotes/7141559-the-production-of-too-many-useful-things-results-in-too). A friend quoted it to me recently and it hasn't left my head. Marx was writing about industrial alienation — how mass production displaces the workers who build the things. Nearly two centuries later, the pattern is repeating with cognitive labor instead of physical labor.

The tools I use daily are genuinely making me a better engineer. And the industry producing those tools is consuming resources, displacing workers, degrading the information environment, and operating on financial assumptions that may not survive contact with reality.

Both of those things are true at the same time. That's the dichotomy. I don't have a resolution for it. But I think being honest about it — refusing to be either a cheerleader or a doomer — is the only intellectually serious position for an engineer in 2026.
