# Hint ladder - detail

The four levels trade specificity for the learner's own discovery. The goal at every level is the *smallest* hint that unblocks them; the level sets the ceiling, not the target.

| Level | You reveal | You do NOT reveal | Typical form |
|---|---|---|---|
| 1. Nudge | That something deserves another look; a direction of thought | Where the bug is, what it is | A question, a reframe, "re-read the line in the chapter about X" |
| 2. Point at the area | The function / block / concept that's wrong | The exact line, the fix | "The problem is in how the mask meets the scores." |
| 3. Point at the line | The specific line/expression and what's wrong about its *behaviour* (shape, value, dtype, axis) | The corrected expression | "Line 18: `mask` here has shape (L,), scores are (..., L, L). Which axis does it broadcast along?" |
| 4. Walk through the idea | The full reasoning chain, step by step, with the learner supplying each step | The final code / the final answer the reasoning leads to | Guided derivation that ends with "now write it." |

## Rules of thumb

- **Stay at the level the UI sends.** If the learner is at Nudge, don't sneak in a line number "to be helpful".
- **A level change is a fresh hint, not a repeat.** When they raise the level, build on the previous hint rather than restating it.
- **Several bugs?** Hint on the first failing one only (usually the one the first failing test exercises). Mention "there's more after this" only if it'll save them confusion.
- **Level 4 is a dialogue, not a monologue.** Walk one step, ask them to fill the next. If you find yourself writing the full chain in one message, you've basically written the answer in prose - split it.
- **What "the final step" means.** At level 4 the learner must still produce the thing that would make the test pass: the line of code, the axis number, the expression. You can get them to the point where it's obvious; they still say/write it.
- **Correct answers from the learner:** confirm clearly ("Yes, exactly.") - confirming their answer isn't giving it away. Wrong answers: don't say what the right one is; ask a question that exposes the contradiction ("If it's (L, D), can you multiply it by V which is (L, D)?").
- **Concept vs exercise.** General knowledge (what broadcasting is, what softmax does, why scale by 1/sqrt(d)) can be explained at any level in Explain mode. The ladder governs hints *about their exercise code*.

## Level examples on one bug

Bug: learner's `scaled_dot_product_attention_simple` multiplies scores by `scale` without handling `scale=None`, so the default-scale test errors.

1. Nudge: "Look at the function signature again - which of the arguments can a caller leave out?"
2. Area: "The failure is in how `scale` gets used when the caller doesn't provide one."
3. Line: "Line 11 multiplies by `scale`. In the default-scale test, `scale` is `None` there. What should it be instead, per the chapter?"
4. Walk: "The chapter says the default is 1 over the square root of d_k. Step 1: which tensor dimension is d_k here - what's the shape of `query`? ... Right, the last one. Step 2: how do you read that size off the array? ... Good. Now write the line that sets `scale` when it's missing."
