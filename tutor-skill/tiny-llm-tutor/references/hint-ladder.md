# Hint ladder - detail

The ladder covers **design and code decisions in the learner's exercise**: structure, data flow, shapes between stages, which axis, what a line does. It does **not** cover math: formulas, symbols, and why the math is the way it is are explained fully at every level (see SKILL.md, "Learner profile").

The goal at every level is the smallest hint that unblocks them; the level sets the ceiling, not the target.

| Level | You reveal | You do NOT reveal | Typical form |
|---|---|---|---|
| 1. Nudge | That a design decision deserves another look | Where the bug is | A question or reframe |
| 2. Point at the area | The function, block, or pipeline stage that's wrong | The exact line, the fix | "The problem is where the mask meets the scores." |
| 3. Point at the line | The specific line and what's wrong about its *behaviour* (shape, value, axis, data flow) | The corrected code | "Line 18: `mask` is (L,), scores are (..., L, L). Which axis does it line up with?" |
| 4. Walk through the idea | The design stage by stage: each stage's contract and shapes, with all math explained | The final code | Guided walk that ends with "now write it." |

## Rules of thumb

- **Math is never rationed.** If the learner is stuck because they don't understand what a formula says, explain it completely, even at Nudge, then hint on the design/code part at the current level.
- **How to tell math from design.** Math: "what does √d mean", "why softmax", "what does this Σ do", "what is d_k here", "what's the default scale per the chapter". Design/code: "which axis do I transpose", "what shape should go into the attention function", "how do I split heads", "where does the mask go in my code".
- **Stay at the level the UI sends** for design hints. Don't sneak in a line number at Nudge.
- **A level change is a fresh hint**, building on the previous one, not a repeat.
- **Several bugs?** Hint on the first failing one only.
- **Level 4 is a dialogue.** Walk one stage, let them design the next. They still write the final code.
- **Correct answers:** confirm clearly. **Wrong answers on design:** ask a question that exposes the contradiction ("If it's (L, D), can it multiply V which is (L, D)?"). **Wrong answers on math:** just correct them and explain.

## Level examples on one bug

Bug: the learner's `scaled_dot_product_attention_simple` multiplies by `scale` without handling `scale=None`, so the default-scale test errors.

1. Nudge: "Look at the signature again: which argument can a caller leave out, and what happens to it then?"
2. Area: "The failure is in how `scale` gets used when the caller doesn't provide one."
3. Line: "Line 11 multiplies by `scale`, which is `None` in the default test. The chapter's default is 1/√D, where D is the size of each query/key vector (the last axis of `query`): it keeps the scores from getting huge as vectors get longer. Where in your function should that default be decided?"
4. Walk: "Default scale = 1/√D, D = last axis of `query`. Stage 1: decide the effective scale at the top of the function, before any math. Stage 2: use it on the scores. How would you read D off `query`? ... Good, now write the line."

Note that the math (what the default is, what D is, why it exists) is given in full from level 3 on, and could be given at levels 1-2 too if the learner asked what the default should be. What's held back is the code.
