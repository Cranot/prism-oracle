# Prism Oracle

> Structural trust analysis for the infrastructure the ecosystem depends on.

**Live:** https://oracle.agentskb.com
**Repo:** https://github.com/Cranot/prism-oracle
**Engine:** [prism.py](https://github.com/Cranot/agi-in-md) — 58+ cognitive prisms, 42 rounds of research, 1,000+ experiments

---

## 9 Infrastructure Targets. 7 Conservation Laws. 19K+ Lines of Analysis.

We analyzed the code the entire Ethereum ecosystem depends on using full 9-pass pipelines + a custom exploit surface scanner. Findings are structural composition properties, conservation laws, and attack vector maps — not zero-day exploits.

### OpenZeppelin (738 lines — 5 composition hazards)
**Finding: Role State Synchronization Paradox**

The framework assumes orthogonal security primitives (ownership, access control, reentrancy protection) can be independently composed. They can't. Owner grants admin role, renounces ownership, keeps admin — creating orphaned privileges no component detects. Reentrancy check runs before role check, allowing role changes during reentrant calls.

**Conservation law:** Safety x Gas Efficiency x Social Flexibility = Constant.

**Falsifiable prediction:** Any attempt to add governance flexibility to OpenZeppelin's access control will either increase gas costs OR reduce safety guarantees. Test: add a timelock to role changes — it will require additional storage (gas cost up) or weaken the single-transaction guarantee (safety down).

### ERC-8004 Reference Implementation (549 lines — 7 findings)
**Finding: Identity Fragmentation Through Normalization Inconsistency**

The system creates phantom identities through inconsistent normalization. Hierarchical identity semantics on flat storage create a semantic impedance mismatch. ENS domain seizure permanently breaks agent identity — a single point of failure in the trust layer this hackathon is built on.

### x402 Protocol — Coinbase (2,026 lines — 5 findings)
**Finding: Centralized Assumptions in Distributed Protocol**

The facilitator is a single point of trust in a protocol designed to minimize trust. Race conditions when multiple async hooks modify shared payment state. Silent failures when networks have overlapping facilitator configs.

### Lido stETH (1,905 lines — full pipeline, 3,119 lines of analysis)
**Finding: Observer-Dependent Value**

The share rate creates different values for different observers — it's not hiding a "true" value, it's creating value by being different for each viewer. Exploit surface scan found dilution attacks via adapters minting unbacked shares, front-running via oracle information asymmetry.

**Conservation law:** Observer-Dependent Value × Denomination = Constant.

### MetaMask Delegation Framework (971 lines — full pipeline, 2,271 lines of analysis)
**Finding: Temporal Consistency vs Composability**

Independent deployment of framework components guarantees coordination failures at boundaries. Permission amplification through unvetted delegation intermediaries.

**Conservation law:** Temporal Consistency × Computational Composability = Constant.

### Octant (560 lines — full pipeline, 2,440 lines of analysis)
**Finding: Historical Fidelity vs Computational Directness**

The epoch-based allocation system cannot simultaneously maintain complete historical records, compute allocations efficiently, and allow flexible configuration changes.

**Conservation law:** Historical Fidelity × Computational Directness × Configuration Flexibility = Constant.

### Starlette routing.py (333 lines — 9 findings)
Stack overflow on recursive mounts. Infinite redirect loops. Dict mutation side effects.
**Conservation law:** Complexity cannot be eliminated, only relocated between layers.

### Click core.py (417 lines — 10 findings)
Context args leak between chained commands. Shallow copy creates shared state.
**Conservation law:** Context isolation trades against ergonomics.

---

## How It Works

A "cognitive prism" is a compact prompt (200-350 words) that changes how a model frames problems. Here is the actual L12 prism — the exact text sent to the model:

> *Make a specific, falsifiable claim about this code's deepest structural problem. Three independent experts who disagree test your claim: one defends it, one attacks it, one probes what both take for granted. Your claim will transform. Name the concealment mechanism — how this code hides its real problems. Apply it. Engineer a legitimate-looking improvement that would deepen the concealment. Name three properties only visible because you tried to strengthen it. Apply the diagnostic to your improvement. Name the structural invariant. Invert it. The conservation law between original and inverted impossibilities is the finding. Apply this diagnostic to your conservation law itself. The meta-law is the deeper finding. Finally: collect every concrete bug this analysis revealed.*

That's it. 332 words. No hidden magic. The same model with and without this prism produces categorically different output — one produces code review, the other produces structural analysis with conservation laws. Available on Opus (maximum depth), Sonnet (recommended), and Haiku (fast).

**All findings are framework-contingent** — valid within this analytical frame, not universal claims. [Full methodology](https://github.com/Cranot/agi-in-md/blob/master/experiment_log.md).

## Reproduce Any Finding

```bash
# Submit any code for analysis:
curl -X POST https://oracle.agentskb.com/analyze \
  -H "Content-Type: application/json" \
  -d '{"code": "your code here", "mode": "l12", "model": "sonnet"}'

# Poll for results:
curl https://oracle.agentskb.com/job/{id}

# Read the full report:
curl https://oracle.agentskb.com/report/{id}/md
```

Or paste code directly at https://oracle.agentskb.com — results in ~50 seconds.

Sample reports (19K+ lines total):

**Full 9-pass pipelines:**
- [OpenZeppelin](examples/openzeppelin-full-pipeline.md) | [ERC-8004](examples/erc8004-full-pipeline.md) | [x402](examples/x402-full-pipeline.md) | [Lido](examples/lido-full-pipeline.md) | [MetaMask](examples/metamask-full-pipeline.md)

- [ERC-8183 Agent Interaction](examples/erc8183-full-pipeline.md) | [Octant](examples/octant-full-pipeline.md)

**Exploit surface scans:**
- [OpenZeppelin](examples/oz-exploit-surface.md) | [ERC-8004](examples/erc-exploit-surface.md) | [x402](examples/x402-exploit-surface.md) | [Lido](examples/lido-exploit-surface.md)

## Note on Findings

The findings in OpenZeppelin, ERC-8004, and x402 are **structural composition properties**, not zero-day vulnerabilities. They describe trade-offs inherent in how the components compose — not bugs that can be "fixed" in the traditional sense. OpenZeppelin is not "broken." The composition of its orthogonal primitives creates emergent structural properties that the framework doesn't track. No responsible disclosure is needed because these are architectural observations, not exploitable vulnerabilities.

---

## What It Is and What It Isn't

**Is:**
- Structural analysis tool finding conservation laws, concealment mechanisms, and trade-offs
- Proven on 9 infrastructure targets (OpenZeppelin, ERC-8004, x402, Lido, MetaMask, ERC-8183, Octant, Starlette, Click)
- Live API with Opus, Sonnet, and Haiku — async jobs, content-hash caching
- Parser handles 7 output formats for bug extraction

**Isn't:**
- Not a replacement for manual security audits
- Not a comparative ranking system (conservation laws resist scoring)
- Depth scores are heuristic markers, not calibrated metrics
- Findings are structural insights, not exhaustive vulnerability lists

**What only Prism Oracle finds:**

Conservation laws are structural invariants — properties that, when violated, always indicate a vulnerability class. Traditional tools search for known patterns. Prism Oracle finds the underlying laws that patterns violate.

Example: OpenZeppelin's `Safety × Gas Efficiency × Social Flexibility = Constant` predicts that ANY governance extension will either increase gas costs or reduce safety. This isn't a bug to fix — it's a structural constraint that predicts where future bugs will appear. If you see a PR adding timelocked role changes to OZ contracts, this conservation law tells you to look for gas cost increases or safety regressions. No pattern matcher can make that prediction.

Complementary to Slither (known patterns), MythX (symbolic execution), Certora (formal proofs). They find what code DOES wrong. We find WHY it must go wrong.

**Methodological limits:** Findings are prism-constitutive, not target-constitutive — different prisms on the same code produce different (complementary) findings. What you see is what THIS analytical frame reveals. The L12 prism finds conservation laws and concealment mechanisms; other prisms (SDL, claim, emergence) find different structural properties. Use multiple prisms for full coverage.

---

## API

```bash
curl https://oracle.agentskb.com/health

curl -X POST https://oracle.agentskb.com/analyze \
  -H "Content-Type: application/json" \
  -d '{"code": "...", "mode": "l12", "model": "sonnet"}'

curl https://oracle.agentskb.com/job/{id}
curl https://oracle.agentskb.com/report/{id}/md
```

Rate limited: 5/hour/IP anonymous, 20/hour with API key, 3 concurrent max.
Authenticate with `x-api-key` header for higher rate limits.

---

## Tracks (10)

- **Synthesis Open Track** — structural analysis using Ethereum ecosystem tooling
- **Protocol Labs (ERC-8004)** — trust verification through structural analysis
- **Base (Agent Services)** — paid analysis service on Base via x402
- **MetaMask (Delegations)** — analyzed the delegation framework itself
- **Octant (Public Goods)** — analyzed Octant's own allocation contracts, found Historical Fidelity × Directness × Flexibility = Constant
- **Bankr (LLM Gateway)** — x402 revenue funds inference
- **Lido (stETH Treasury)** — analyzed the staking infrastructure
- **Virtuals (ERC-8183)** — analyzed the agent interaction spec, found Decision Centralization × Temporal Efficiency = Constant
- **Venice (Private Agents)** — private structural analysis without data retention
- **Slice (ERC-8128)** — analyzed commerce authentication for machines

## Tech Stack

Node.js, Express, Anthropic API (Opus/Sonnet/Haiku), PM2, Solidity (compiled), Base Sepolia, x402 wiring, ERC-8004 scripts.

---

*Built for [Synthesis Hackathon 2026](https://synthesis.md)*
