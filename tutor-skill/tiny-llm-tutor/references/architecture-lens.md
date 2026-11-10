# Architecture lens: course topics as software components

Use these framings to explain a concept to a software architect. Each one gives the component's job, its contract, and a systems analogy. They describe *what* and *why*, never the exercise's code. Adapt them to the chapter's exact wording and shapes.

## How to explain any math in this course

- **Shapes are the type signature.** `(N, L, D)` reads as "N independent requests, L tokens each, D numbers per token". Most bugs are type errors between stages.
- **A tensor op is a vectorised loop.** "For every query position i and key position j, compute ..." is a nested loop the op runs in parallel. Describe the loop first, then the op.
- **Σ (sum) is a reduction** over one axis. **A matrix product** `A @ B` is "dot product of every row of A with every column of B": a batch of similarity scores.
- **Dot product = similarity score.** Bigger means "more aligned". That's all most of the attention math needs.
- **Softmax = turn arbitrary scores into weights that are positive and sum to 1** (like normalising votes into percentages). Subtracting the max first is a numeric-overflow guard and doesn't change the result.
- **Weighted sum** = blend several values by those weights (like a weighted average of records).
- **sin/cos in RoPE = a rotation**, like turning a clock hand by an angle that depends on position. You don't need trigonometry: rotating a 2-number pair by an angle is a fixed recipe the chapter gives.
- Show tiny numeric examples (2x3 arrays) in Explore mode whenever symbols aren't landing.

## Week 1: the model

| Topic | Component's job | Contract (shapes as types) | Systems analogy |
|---|---|---|---|
| Attention | For each token, build its output by blending information from the other tokens, weighted by relevance | Q, K, V: `(..., L, D)` -> output `(..., L, D)`; mask optional, broadcastable to the score matrix `(..., L, S)` | A **fuzzy key-value lookup**: each query scores every key (dot product), scores become weights (softmax), result is the weighted blend of the values. A dictionary where every key partially matches |
| Scale 1/√D | Keep scores in a range where softmax doesn't saturate | scalar | **Normalising input** so a downstream function stays in its useful range |
| Mask | Forbid some query->key pairs (e.g. the future) | added to scores before softmax; `-inf` = blocked | An **access-control list** applied before the lookup |
| Multi-head attention | Run several independent attention lookups in parallel on slices of the embedding, then merge | `(N, L, E)` in -> `(N, L, E)` out; inside, H heads of size D = E/H | **Sharding** one big lookup into H parallel workers, each specialised, results concatenated and projected |
| Linear / projections | Learned transform from one representation to another | `x (..., in) @ W.T -> (..., out)` | An **adapter / mapper** between two schemas |
| RoPE | Stamp each token's position into Q and K so attention can tell order | same shape in and out; depends on token offset | **Versioning/timestamping records** so the lookup can compare by relative position; implemented as a rotation per position |
| GQA | Fewer K/V heads than Q heads; groups of Q heads share one K/V head | Q has H_q heads, K/V have H_kv, H_q a multiple of H_kv | **Shared read replicas**: many readers per replica, saving memory |
| RMSNorm | Rescale each token vector to a standard size, then apply a learned per-feature weight | `(..., D)` -> `(..., D)` | **Normalisation middleware** keeping values in a stable range between layers |
| MLP / SwiGLU | Per-token feature processing, with a gate deciding how much passes | `(..., E)` -> expand -> gate -> `(..., E)` | A **per-record transform service** with a feature flag (gate) on each feature |
| Transformer block / Qwen3 model | Stack of blocks: norm -> attention -> residual add -> norm -> MLP -> residual add | `(N, L, E)` through every block, then to vocabulary logits | A **pipeline of middleware layers**; the residual add is a **bypass** so each layer only adds a delta |
| Generate / sampling | Loop: run model, pick the next token, append, repeat | prompt tokens -> stream of tokens | An **event loop / producer** emitting one item per tick; sampling is the **selection policy** (greedy, temperature, top-k/top-p) |

## Week 2 and later: serving

| Topic | Analogy |
|---|---|
| KV cache | **Memoisation**: K and V of past tokens never change, so cache them and compute only the new token's |
| Quantization | **Lossy compression** of weights (fewer bits per number plus a scale per group), decompressed on the fly in the matmul |
| Flash attention | **Streaming / chunked processing**: compute attention tile by tile with a running softmax instead of materialising the full score matrix (a memory-bounded algorithm) |
| Continuous batching | A **request scheduler**: requests join and leave the running batch at any step instead of waiting for the whole batch to finish |
| Chunked prefill | **Time-slicing** a long prompt so it doesn't starve other requests |
| Paged attention | **Virtual memory paging** for the KV cache: fixed-size blocks plus a page table per request, no big contiguous allocation |
| Prefix caching | **Content-addressed cache / dedup** of shared prompt prefixes |
| Coding agent (Week 4) | A **controller loop** around the model: plan, call tools, observe, repeat |
