# Agentic Coding: A Bug Fix Case Study

## Fixing a UI Styling Bug with Claude Code

---

## Slide 1: The Problem

**A confirmation modal with styling issues**

- Scrollbar appearing unexpectedly
- Warning icon misaligned with title text
- Content touching dialog edges
- Buttons flush against borders

*"Just a CSS bug" - but where do you start?*

---

## Slide 2: The Agentic Approach

**Human provides direction, AI executes**

```
Human: "This confirmation modal needs work. No scrollbar.
        Padding around components. Make it reusable."
```

- Clear problem statement
- Desired outcome described
- Constraint added: "make it reusable"

**Key insight:** You don't need to know the solution. Describe the problem.

---

## Slide 3: Resisting the Refactor Rabbit Hole

**What Claude Code did first:**

1. Found the component files (Glob)
2. Read the existing code (Read)
3. Identified root cause in styling
4. Made targeted CSS changes (Edit)

**What it did NOT do:**

- Rewrite the entire component
- Change the component architecture
- Add unnecessary dependencies
- Over-engineer the solution

*Focused changes = lower risk*

---

## Slide 4: Iterative Feedback Loop

**First fix applied → User tested → Feedback provided**

```
Human: "The icon and text need to be aligned along the base"
       [Includes screenshot from browser DevTools]
```

**Claude Code response:**

- Read the specific CSS section
- Changed `align-items: center` → `align-items: flex-end`
- Added 2px optical adjustment
- Single targeted edit

*Screenshots and DevTools output accelerate debugging*

---

## Slide 5: Managing Context Efficiently

**What stayed in context:**

- The problem description
- File paths discovered
- Test results
- User feedback

**What we avoided:**

- Reading entire codebase
- Exploring unrelated files
- Keeping irrelevant history

*At 65% context usage, we had room to complete the task properly*

---

## Slide 6: The Deliverables

**More than just a bug fix:**

| Artifact | Purpose |
|----------|---------|
| Fixed styling | Immediate problem solved |
| Enhanced shared component | Reusable for future dialogs |
| 18 new unit tests | Regression protection |
| Deleted duplicate code | Reduced maintenance burden |
| Documentation | Prevents future occurrences |

*One bug fix → Five improvements*

---

## Slide 7: Documentation as Prevention

**Lessons learned captured immediately:**

```markdown
## Problem: Icon and Text Misalignment in Headers

**Symptom:** Icon appears centered while text baseline sits lower

**Root Cause:** `align-items: center` aligns to vertical center,
but text baseline sits above bounding box bottom

**Solution:** Use `align-items: flex-end` with optical adjustment
```

*Future developers (and AI agents) won't repeat this mistake*

---

## Slide 8: The Human-AI Collaboration Pattern

| Human Role | AI Role |
|------------|---------|
| Identify the problem | Find relevant code |
| Describe desired outcome | Propose solution |
| Test and provide feedback | Execute changes |
| Approve direction | Write tests |
| Request documentation | Generate documentation |

**You remain in control. AI handles the execution.**

---

## Slide 9: Why This Matters for Your Team

**Traditional approach:**
- Developer searches Stack Overflow
- Tries multiple solutions
- Forgets to write tests
- Doesn't document the fix
- Similar bug appears in 6 months

**Agentic approach:**
- Problem described once
- Solution implemented with tests
- Documentation generated
- Knowledge captured for reuse
- AI learns from the codebase patterns

---

## Slide 10: Getting Started

**Tips for your first agentic bug fix:**

1. **Describe the problem, not the solution**
   - "The modal has a scrollbar" not "add overflow:hidden"

2. **Provide visual context**
   - Screenshots, DevTools output, error messages

3. **Request deliverables explicitly**
   - "Write tests" / "Document this" / "Make it reusable"

4. **Trust but verify**
   - Review the changes, run the tests, check the UI

5. **Capture lessons learned**
   - "Document what we learned from this bug fix"

---

## Questions?

**Resources:**
- Claude Code: https://claude.ai/code
- This case study: `docs/lessons-learned/frontend-styling-patterns.md`
- Session artifacts: All tests passing, component reusable, docs complete
