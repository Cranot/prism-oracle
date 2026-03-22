[36mFull Prism: static champion pipeline (10 steps, optimal models)[0m
    [32mL12 STRUCTURAL[0m (l12) → [2msonnet[0m
    [32mDEEP SCAN[0m (deep_scan) → [2msonnet[0m
    [32mRECURSIVE ENTAILMENT[0m (fix_cascade) → [2msonnet[0m
    [32mIDENTITY DISPLACEMENT[0m (identity) → [2msonnet[0m
    [32mOPTIMIZATION COSTS[0m (optimize) → [2msonnet[0m
    [32mERROR RESILIENCE[0m (error_resilience) → [2msonnet[0m
    [32mCONTRACT FIDELITY[0m (fidelity) → [2msonnet[0m
    [32mSECURITY[0m (security_v1) → [2msonnet[0m
    [32mADVERSARIAL[0m (l12_complement_adversarial) → [2msonnet[0m
    [32mSYNTHESIS[0m (l12_synthesis) → [2msonnet[0m

[1m[34m── L12 STRUCTURAL ── x402.txt ── [2msonnet[0m
  [2mModel → sonnet (optimal for prism)[0m
[2mthinking...[0m                                        # L12 Meta-Conservation Analysis: x402 Protocol Implementation

## Original Claim

**This code's deepest structural problem is incoherent versioning strategy across three independently-versioned components (Client, Facilitator, Server) creating hidden coordination failures.**

---

## Dialectical Examination

### Expert 1: Defender
The architecture elegantly separates concerns: Client creates payments, Facilitator verifies/settles, Server protects resources. Version-specific methods (`register()` vs `registerV1()`) provide clear backward compatibility. The extensibility model (hooks, extensions, policies) allows customization without core modifications. This is mature protocol design.

### Expert 2: Attacker  
The version handling is a disaster. hardcoded `if (partialPayload.x402Version == 1)` branches scatter throughout. The three components don't share a common versioning interface—Facilitator stores versions in arrays with `SchemeData`, Client uses nested Maps, Server uses yet another structure. When `x402Version` mismatches occur, errors thrown at execution time reveal there's no validation at registration. The "extensibility" is just workaround complexity.

### Expert 3: Prober
Both assume this is about version management architecture, but they miss that the real issue is **temporal decoupling**: registration happens at startup, execution happens later, and the version is a runtime value that must route through all three components. The hooks/updates/extensions systems are all trying to solve the same problem: "how do I inject behavior at execution time based on runtime state?"

---

## Transformed Claim

**The code's deepest problem is concealing a distributed protocol's coordination complexity behind local extensibility mechanisms, making the coordination failures look like implementation bugs rather than structural impossibilities.**

---

## Gap Analysis

**Original → Transformed Gap:** The original claim locates the problem in poor version handling (tactical). The transformed claim reveals that version handling complexity is a symptom of trying to make three independent components coordinate as if they were a monolith. The extensibility systems (hooks, policies, extensions) aren't features—they're **patch infrastructure** for the fundamental coherence problem.

---

## Concealment Mechanism

**Name:** Extensibility as Coordination Patch

**How it works:** The code provides rich extension points (6 hook types, policies, client extensions, facilitator extensions, server extensions) that make the system seem "flexible by design." In reality, these are emergency injection points for when the three components can't coordinate. When version mismatch or network mismatch occurs, the developer is expected to add a hook rather than fix the routing. This makes structural bugs appear solvable through local customization.

---

## Concealment Applied: What the Dialectic Missed

The dialectic debated version management architecture, but **both sides took for granted that Client, Facilitator, and Server *should* be separate classes**. The extensibility mechanisms conceal that this three-class structure creates the coherence problem they're trying to solve. The hooks/policies/extensions are compensating for the inability to atomically update three independently-instantiated classes.

---

## Engineered Concealment-Strengthening

```typescript
// "Improvement": Add version-aware routing hook system
export interface VersionRoutingHook {
  (x402Version: number, phase: 'register' | 'create' | 'verify' | 'settle'): Promise<{
    allow: boolean;
    overrideVersion?: number;
    reason?: string;
  }>;
}

export class x402Client {
  private versionRoutingHooks: VersionRoutingHook[] = [];
  
  registerVersionRoutingHook(hook: VersionRoutingHook): x402Client {
    this.versionRoutingHooks.push(hook);
    return this;
  }
  
  private async applyVersionRouting(
    version: number, 
    phase: 'register' | 'create' | 'verify' | 'settle'
  ): Promise<number> {
    for (const hook of this.versionRoutingHooks) {
      const result = await hook(version, phase);
      if (!result.allow) {
        throw new Error(`Version routing denied at phase ${phase}: ${result.reason}`);
      }
      if (result.overrideVersion !== undefined) {
        version = result.overrideVersion;
      }
    }
    return version;
  }
  
  // Use in createPaymentPayload:
  async createPaymentPayload(paymentRequired: PaymentRequired): Promise<PaymentPayload> {
    const effectiveVersion = await this.applyVersionRouting(
      paymentRequired.x402Version, 
      'create'
    );
    // ... rest of method using effectiveVersion
  }
}
```

**Why this deepens concealment:** It looks like legitimate "enterprise flexibility" but actually provides a global backdoor to bypass version checks entirely. Now when version mismatches occur, developers will add routing hooks rather than fix the coordination. The structural impossibility (three components can't share version state) is now "solvable" through configuration.

---

## Properties Revealed by Strengthened Concealment

1. **State Mutation During Iteration**: The routing hook can override `x402Version` mid-execution, but `paymentRequired.x402Version` remains unchanged. The method continues with an inconsistent version state.

2. **Hook Order Dependency**: If multiple routing hooks are registered, the final version depends on execution order. No two installations will have identical behavior.

3. **Phase Violation**: The hook can approve version 2 at `register` phase but version 1 at `create` phase, violating the invariant that registration and creation must agree on version.

---

## Diagnostic Applied to Improvement

**What the improvement conceals:** It makes the version routing problem look like a configuration issue ("add the right hook") rather than revealing that **version is not a property that can be routed—it's a property of the entire execution context**.

**Property of original now visible:** The hardcoded `if (x402Version == 1)` checks throughout the code are **not poor style—they're the only honest expression of the reality** that this is three separate protocols masquerading as one. The "improvement" tries to paper over this with dynamic routing, but that only makes the three-protocol nature harder to see.

---

## Second Improvement: Address the Recreated Property

```typescript
// "Fix": Make version routing transactional
export interface VersionRoutingTransaction {
  originalVersion: number;
  currentVersion: number;
  phases: Set<'register' | 'create' | 'verify' | 'settle'>;
  addPhase(phase: typeof VersionRoutingTransaction.phases extends Set<infer T> ? T : never): void;
}

export class x402Client {
  private versionRoutingTransactions: Map<string, VersionRoutingTransaction> = new Map();
  
  async createPaymentPayload(paymentRequired: PaymentRequired): Promise<PaymentPayload> {
    const txId = crypto.randomUUID();
    const tx: VersionRoutingTransaction = {
      originalVersion: paymentRequired.x402Version,
      currentVersion: paymentRequired.x402Version,
      phases: new Set(),
      addPhase(phase) { this.phases.add(phase); }
    };
    this.versionRoutingTransactions.set(txId, tx);
    
    try {
      tx.addPhase('create');
      const effectiveVersion = await this.applyVersionRouting(tx.currentVersion, 'create', tx);
      tx.currentVersion = effectiveVersion;
      // ... rest with transaction tracking
    } finally {
      this.versionRoutingTransactions.delete(txId);
    }
  }
  
  private async applyVersionRouting(
    version: number,
    phase: 'register' | 'create' | 'verify' | 'settle',
    tx: VersionRoutingTransaction
  ): Promise<number> {
    // Check transaction invariants
    if (tx.phases.has('create') && tx.currentVersion !== tx.originalVersion) {
      throw new Error(`Version mutation not allowed after creation phase`);
    }
    // ... apply hooks
  }
}
```

---

## Diagnostic Applied to Second Improvement

**What the second improvement conceals:** It makes the version management problem look like a **transaction isolation** problem ("we need ACID guarantees for version routing"). This shifts the discourse from "why are there three versions?" to "how do we make version routing thread-safe?"

**Structural Invariant Revealed:** **The three components (Client, Facilitator, Server) each store independent version maps, but the protocol requires them to agree on a single version for any given request. This is a distributed consensus problem masquerading as a library design problem.**

The invariant that persists: **State partitioning is conserved.** Whether you use hooks, transactions, policies, or extensions—you still have three separate state machines that need to agree. Every improvement just adds coordination machinery on top of an inherently non-coordinated structure.

---

## Structural Invariant: The Problem Space Property

**Partitioned State Co-ordination Tax:**

```
Coordination Overhead = (Number of Independent Components) × (Version States²) × (Registration Complexity)
```

The protocol defines three components (Client, Facilitator, Server) that must maintain coherent state. Each new version multiplies the coordination surface area quadratically. This is not fixable through better code organization—it's a property of choosing a three-component architecture for a single coherent operation.

---

## Inverted Design

```typescript
// Inversion: Single Protocol Object with Context-Specific Behavior
export class x402Protocol {
  private schemes: Map<string, ProtocolImplementation> = new Map();
  
  constructor(schemes: ProtocolImplementation[]) {
    schemes.forEach(scheme => this.schemes.set(scheme.schemeId, scheme));
  }
  
  // One method handles the entire lifecycle
  async executePayment(request: PaymentRequest): Promise<PaymentResult> {
    const impl = this.selectImplementation(request);
    return impl.execute(request);
  }
  
  private selectImplementation(request: PaymentRequest): ProtocolImplementation {
    // Version, network, and scheme ALL resolved in one place
    for (const [schemeId, impl] of this.schemes) {
      if (impl.supports(request)) {
        return impl;
      }
    }
    throw new Error(`No implementation supports: ${JSON.stringify(request)}`);
  }
}

interface ProtocolImplementation {
  schemeId: string;
  supports(request: PaymentRequest): boolean;
  execute(request: PaymentRequest): Promise<PaymentResult>;
}
```

**Why this makes the impossible trivial:** Version coherence is now **a local property of a single object**. There's no Client/Facilitator/Server to get out of sync. The `supports()` check happens atomically before execution.

---

## New Impossibility Created by Inversion

**The monolithic protocol object cannot be independently deployed or updated.** If Client v2 requires a breaking change but Facilitator v2 doesn't, you can't update them independently. The original three-component design was trying to solve **independent deployability**, which the monolith makes impossible.

---

## Conservation Law

**Partitioned Independence ↔ Coherent Coordination**

You can either have:
1. **Three independently deployable components** (original design) → High coordination overhead, version mismatch bugs, extensibility patches
2. **One coherent protocol object** (inverted design) → No coordination needed, but no independent deployment

This is **distributed systems CAP theorem applied to library design**: you cannot have both **partition independence** and **coordination consistency**. The x402 code tries to have both, resulting in maximum complexity.

---

## Meta-Conservation Law: What the Law Conceals

My conservation law ("Partitioned Independence ↔ Coherent Coordination") conceals that **the choice between partitioned and coherent is itself a function of deployment topology**:

- **Cloud/Server-side**: Monolithic protocols are fine (everything deploys together)
- **Edge/Client-side**: Partitioned components are necessary (different release cycles)

The code hides **who controls the deployment**. If the protocol author controls all deployments, a monolith is optimal. If users independently upgrade components, partitioning is required.

**The real invariant:** **Deployment authority determines architectural possibility.** The x402 code makes deployment authority look like a technical decision ("use hooks vs don't") when it's actually an organizational question.

---

## Meta-Invariant of the Meta-Law

**Any framework that abstracts deployment will eventually require deployment-specific configuration.**

The x402 code tries to be deployment-agnostic ("works in cloud, works on edge"), but this just moves deployment concerns into extensibility mechanisms. When I tried to improve the version routing, I created configuration complexity. When I tried to make it transactional, I created operational complexity.

**Structural invariant:** **Deployment locality is conserved.** You can shift the boundary (where deployment concerns live) but you cannot eliminate it.

---

## Final Meta-Law: The Meta-Conservation

**Abstraction Migration Law:**

```
Complexity × Locality = Constant

Where:
- Complexity = Code/hooks/configuration needed
- Locality = How close to deployment the complexity lives
```

When you push complexity "up" into abstraction layers (hooks, policies, transactions), it reduces deployment locality but increases abstraction complexity. When you push complexity "down" into deployment (require monolithic deployments), it reduces abstraction complexity but increases deployment coupling.

The x402 code tries to minimize both simultaneously, which is impossible. Every "improvement" just moves complexity along this axis.

---

## Complete Bug Catalog

### Structural Bugs (Predicted Unfixable by Conservation Law)

| Location | Bug | Severity | Structural? |
|----------|-----|----------|-------------|
| `x402Facilitator.ts:539` | Facilitator array iteration uses `schemeData.facilitator.scheme === paymentRequirements.scheme` match but registration allows same scheme with different networks. Later registrations override earlier ones silently. | HIGH | YES - Independent versioning |
| `x402Facilitator.ts:555-558` | Pattern matching regex `^` + pattern.replace(`*`, `.*`) + `$` is incorrect when pattern contains multiple `*` or `*` not at end. `eip155:*` works but `*:mainnet` becomes `^.*:mainnet$` which matches `eip155:mainnet` but also `solana:mainnet`. | HIGH | YES - Coordination overhead |
| `x402Client.ts:450-453` | Extension enrichPaymentPayload iterates `registeredExtensions` Map but checks `if (key in paymentRequired.extensions)`. If extension registers with key `"eip2612"` but server sends `"EIP2612"`, extension is silently not invoked. Case/variant mismatch creates silent failures. | MEDIUM | YES - State partitioning |
| `x402ResourceServer.ts:735-738` | `buildPaymentRequirements` returns empty array when no SchemeNetworkServer registered (console.warn only). Callers receive `[]` and proceed, creating 402 responses with empty `accepts`. | CRITICAL | YES - Deployment locality |
| `x402Client.ts:157-159` | `selectPaymentRequirements` filters by registered schemes, but registration map structure is nested Maps (`Map<version, Map<network, Map<scheme, client>>>`). The filter uses `findSchemesByNetwork` which returns inner Map, but then checks `clientSchemes.has(requirement.scheme)` on the wrong Map level. | HIGH | YES - Structural complexity |
| `x402Facilitator.ts:232-235` | `register()` allows same facilitator instance for multiple networks via array, but internally stores each as separate SchemeData entries with `pattern: this.derivePattern(networks)`. If networks are `["eip155:1", "eip155:137"]`, derived pattern is `eip155:*`, but stored networks are `Set(["eip155:1", "eip155:137"])`. Lookup fails for `eip155:42161`. | HIGH | YES - Partitioned independence |

### Fixable Bugs (Implementation Issues)

| Location | Bug | Severity | Fixable? |
|----------|-----|----------|----------|
| `x402ResourceServer.ts:847-851` | `enrichPaymentRequiredResponse` mutates `response.extensions` inside loop but also checks `if (!response.extensions)` inside loop. Extension order affects which extensions get added if multiple extensions write same key. | MEDIUM | YES - Use temporary map then assign |
| `x402Client.ts:380-383` | `mergeExtensions` deep merge only checks `typeof serverValue === "object"` but `null` is `typeof "object"` in JavaScript. If server extension value is `null`, merge fails or creates wrong structure. | LOW | YES - Add null check |
| `x402ResourceServer.ts:638-639` | `getSupportedKind` finds `supportedResponse` but then searches `supportedResponse.kinds` array for matching kind. If `kinds` has duplicate entries with same version/network/scheme, returns first match (non-deterministic). | MEDIUM | YES - Use find with index or validate uniqueness |
| `x402Facilitator.ts:607-611` | Pattern regex constructed inside loop without caching. For each `verify()`/`settle()` call, reconstructs same regex. Expensive in hot path. | LOW | YES - Cache patterns in SchemeData |
| `x402Client.ts:336-340` | Before hooks execute in loop but no error handling. If one hook throws, subsequent hooks don't execute and state is inconsistent (some hooks ran, some didn't). | MEDIUM | YES - Wrap in try-catch, continue or abort |
| `x402ResourceServer.ts:1093-1095` | `findMatchingRequirements` for v1 only checks `scheme` and `network` but v1 payload might have `amount` mismatch. v1 allows payment that doesn't match requirements amount. | MEDIUM | YES - Add amount check for v1 |

### Silent Failures (Conservation Law Predictions)

| Location | Silent Failure | Severity | Why Structural |
|----------|---------------|----------|----------------|
| `x402Client.ts:450-453` | Extension key mismatch causes silent non-invocation. No error, extension just doesn't run. | HIGH | Keys cross deployment boundaries (client vs server) |
| `x402ResourceServer.ts:735-738` | Empty `accepts` in PaymentRequired response. Client receives `accepts: []` and treats as "no payment options available". | CRITICAL | Server and facilitator deploy independently |
| `x402Facilitator.ts:232-235` | Network pattern mismatch causes "no facilitator found" error during verify/settle but registration succeeded. | HIGH | Registration time ≠ execution time topology |
| `x402Client.ts:419-421` | `supportedPaymentRequirements` filter can return empty array. Thrown error lists registered schemes but error happens at payment creation time, not registration time. | HIGH | Client registration and server discovery are decoupled |
| `x402ResourceServer.ts:653` | `getFacilitatorExtensions` returns `[]` when version not found. Caller sees no extensions available, doesn't know if version mismatch or no extensions registered. | MEDIUM | Version map is partitioned by component |

  [2mSaved to .deep/findings/x402.md[0m
  [2mProfile: 102 scans, 0 patterns, 5 laws[0m
  [2mQueued 3 Q&As for AgentsKB seeding[0m

[1m[34m── DEEP SCAN ── x402.txt ── [2msonnet[0m
  [2mModel → sonnet (optimal for prism)[0m
[2mthinking...[0m                                        ## Analysis of x402 Protocol Core Server Code

### Step 1: Identify the Conservation Law

**Conserved Quantity**: `Static Type Safety × Runtime Composition × Protocol Extensibility = Constant`

**The Fundamental Trade-off**:
The system simultaneously demands:
1. **Static Type Safety**: Compile-time guarantees that all scheme/network/extension combinations are valid
2. **Runtime Composition**: Dynamic registration of schemes, policies, hooks, and extensions
3. **Protocol Extensibility**: Support for arbitrary payment schemes across multiple networks and protocol versions

**What Cannot Coexist**:
- You cannot have static type safety AND dynamic registration. The nested `Map<number, Map<string, Map<string, T>>>` structures bypass the type system entirely—schemes are looked up by string keys at runtime with zero compile-time verification.
- You cannot have extensibility AND guaranteed correctness. The `extensions` system uses string keys (`extension.key`) to match between client and server declarations. A typo means silent failure, not a compiler error.
- You cannot have runtime composition AND O(1) lookup. Every operation must traverse version → network → scheme maps. This is conserved—the system MUST pay this cost somewhere.

**The O(n) Cost That Cannot Be Optimized Away**:
The registry lookup is fundamentally O(depth) where depth = 3 nested maps (version × network × scheme). This is not an implementation bug—it's the necessary cost of supporting:
- Multiple protocol versions (1, 2, ...)
- Multiple networks per version (`eip155:8453`, `solana:mainnet`, ...)
- Multiple schemes per network
- Multiple facilitators per combination

Every payment operation MUST perform this lookup. The cost is conserved.

---

### Step 2: Locate Information Laundering

**1. x402Client.createPaymentPayload (lines 141-152)**
```typescript
const schemeNetworkClient = findByNetworkAndScheme(clientSchemesByNetwork, requirements.scheme, requirements.network);
if (!schemeNetworkClient) {
  throw new Error(`No client registered for scheme: ${requirements.scheme} and network: ${requirements.network}`);
}
```
**What's Destroyed**: The error message enumerates what was NOT found but destroys information about what WAS available. When debugging integration issues, you need to know:
- What schemes ARE registered for this network?
- What networks ARE registered for this version?
- What versions ARE supported at all?

**What Should Be Propagated**:
```typescript
throw new Error(`No client registered for scheme: ${requirements.scheme} and network: ${requirements.network}. ` +
  `Registered versions: [${Array.from(this.registeredClientSchemes.keys())}]. ` +
  `Registered networks for v${paymentRequired.x402Version}: [${Array.from(clientSchemesByNetwork.keys())}]. ` +
  `Registered schemes for ${requirements.network}: [${Array.from(findSchemesByNetwork(clientSchemesByNetwork, requirements.network)?.keys() || [])}]`
);
```

**2. x402Client.selectPaymentRequirements (lines 321-329)**
```typescript
if (supportedPaymentRequirements.length === 0) {
  throw new Error(`No network/scheme registered for x402 version: ${x402Version} which comply with the payment requirements. ${JSON.stringify({
    x402Version,
    paymentRequirements,
    x402Versions: Array.from(this.registeredClientSchemes.keys()),
    networks: Array.from(clientSchemesByNetwork.keys()),
    schemes: Array.from(clientSchemesByNetwork.values()).map(schemes => Array.from(schemes.keys())).flat(),
  })}`);
}
```
**What's Destroyed**: This error DOES propagate diagnostic information (good!), but it's JSON-encoded inside the string, making it machine-unparseable. A structured error type would allow programmatic error handling:
```typescript
class NoMatchingSchemeError extends Error {
  constructor(
    public x402Version: number,
    public requestedRequirements: PaymentRequirements[],
    public registeredVersions: number[],
    public registeredNetworks: Network[],
    public registeredSchemes: string[]
  ) { super(...); }
}
```

**3. x402ResourceServer.initialize (lines 691-694)**
```typescript
} catch (error) {
  lastError = error as Error;
  // Log error but continue with other facilitators
  console.warn(`Failed to fetch supported kinds from facilitator: ${error}`);
}
```
**What's Destroyed**: The error object is cast to `Error` (losing type information) and stringified (losing stack trace and structured data). If the error has properties like `statusCode`, `retryable`, or `facilitatorUrl`, they are lost. Subsequent debugging cannot reconstruct which facilitator failed or why.

**What Should Be Propagated**:
```typescript
} catch (error) {
  lastError = error;
  console.warn(`Failed to fetch supported kinds from facilitator`, {
    error,
    facilitatorUrl: facilitatorClient instanceof HTTPFacilitatorClient ? facilitatorClient.baseUrl : 'unknown',
    errorType: error?.constructor?.name,
  });
}
```

**4. x402ResourceServer.registerExtension.enrichPaymentRequiredResponse (lines 837-848)**
```typescript
try {
  const extensionData = await extension.enrichPaymentRequiredResponse(declaration, context);
  // ...
} catch (error) {
  console.error(`Error in enrichPaymentRequiredResponse hook for extension ${key}:`, error);
}
```
**What's Destroyed**: Extension enrichment failures are SILENTLY SWALLOWED. The response is still returned to the client, possibly missing critical data that the client needs to proceed. The client receives a partial `PaymentRequired` response with no indication that an extension failed to enrich it.

**What Should Happen**: Either (a) fail the request and return an error to the client, or (b) track enrichment failures and include them in the response so the client can decide whether to proceed. Silent failure is the worst option.

---

### Step 3: Hunt Structural Bugs

**A. Async State Handoff Violation**

**Bug 1: x402Client.enrichPaymentPayloadWithExtensions (lines 279-297)**
```typescript
private async enrichPaymentPayloadWithExtensions(
  paymentPayload: PaymentPayload,
  paymentRequired: PaymentRequired,
): Promise<PaymentPayload> {
  if (!paymentRequired.extensions || this.registeredExtensions.size === 0) {
    return paymentPayload;
  }

  let enriched = paymentPayload;
  for (const [key, extension] of this.registeredExtensions) {
    if (key in paymentRequired.extensions && extension.enrichPaymentPayload) {
      enriched = await extension.enrichPaymentPayload(enriched, paymentRequired);
    }
  }

  return enriched;
}
```
**The Violation**: The loop mutates `enriched` across iterations. Each extension receives the output of the previous extension. If Extension A enriches `payload.extensions.foo`, and Extension B also touches `payload.extensions.foo`, Extension B overwrites A's work.

**The Race Condition**: While this example is sequential (not concurrent), it's still a state handoff bug. Extensions are not isolated—they share the same `payload` object. The order of extension execution matters, but the order is determined by `Map` iteration order, which is insertion order. This is nondeterministic across different JavaScript engines or if extensions are registered dynamically.

**The Fix**: Either:
1. Prohibit extensions from overlapping keys (enforce at registration time)
2. Make extension execution explicitly ordered (add `priority` field to `ClientExtension`)
3. Pass each extension a copy of the payload and merge results at the end

**Bug 2: x402Facilitator.verify (lines 318-374) - Recovery Result Reuse**
```typescript
// Execute onVerifyFailure hooks
for (const hook of this.onVerifyFailureHooks) {
  const result = await hook(failureContext);
  if (result && "recovered" in result && result.recovered) {
    // If recovered, execute afterVerify hooks with recovered result
    const recoveredContext: FacilitatorVerifyResultContext = {
      ...context,
      result: result.result,
    };
    for (const hook of this.afterVerifyHooks) {
      await hook(recoveredContext);
    }
    return result.result;
  }
}
```
**The Violation**: Multiple failure hooks can recover, but only the FIRST recovery is used. The loop returns early, so if Hook A recovers with `isValid: true`, and Hook B would recover with `isValid: true` BUT with additional enrichment, Hook B never runs.

**The Silent Failure**: If Hook A recovers but Hook B would add critical logging or side effects, that work is lost. The "first match wins" behavior is undocumented and likely unintended.

**The Fix**: Either:
1. Document that only the first recovery is used
2. Collect ALL recovery results and merge/choose the best one
3. Abort after first recovery but execute ALL `afterVerify` hooks (including those from other failure hooks)

**B. Priority Inversion in Search**

**Bug 3: x402Client.selectPaymentRequirements (lines 300-347)**
```typescript
// Step 1: Filter by registered schemes
const supportedPaymentRequirements = paymentRequirements.filter(requirement => {
  let clientSchemes = findSchemesByNetwork(clientSchemesByNetwork, requirement.network);
  if (!clientSchemes) {
    return false;
  }
  return clientSchemes.has(requirement.scheme);
})

// Step 2: Apply all policies in order
let filteredRequirements = supportedPaymentRequirements;
for (const policy of this.policies) {
  filteredRequirements = policy(x402Version, filteredRequirements);
  
  if (filteredRequirements.length === 0) {
    throw new Error(`All payment requirements were filtered out by policies for x402 version: ${x402Version}`);
  }
}

// Step 3: Use selector to choose final requirement
return this.paymentRequirementsSelector(x402Version, filteredRequirements);
```
**The Priority Inversion**: The `paymentRequirementsSelector` (Step 3) chooses from the filtered requirements, but the default selector is:
```typescript
this.paymentRequirementsSelector = paymentRequirementsSelector || ((x402Version, accepts) => accepts[0]);
```
It returns the **first** requirement, regardless of amount, network speed, or any other quality metric. This is "first match wins" over "best match."

**The Suboptimal Result**: If the server offers:
- `{ scheme: "usdc", network: "eip155:8453", amount: "1000000" }` (fast, cheap)
- `{ scheme: "eth", network: "eip155:1", amount: "5000000000000000" }` (slow, expensive)

The client will choose the first option (USDC on Base) even if the user has no USDC and plenty of ETH. The selector has no knowledge of user preferences or balances.

**The Structural Issue**: Policies are applied BEFORE selection, so policies cannot implement "prefer cheaper options" or "prefer networks where user has balance." Policies can only filter (remove options), not rank (prioritize remaining options).

**The Fix**: Either:
1. Move policies AFTER selection, and allow policies to return a ranked list
2. Change the default selector to implement a quality metric (e.g., lowest amount first)
3. Allow policies to attach a `score` to each requirement, and select by highest score

**Bug 4: x402ResourceServer.initialize (lines 667-682)**
```typescript
for (const facilitatorClient of this.facilitatorClients) {
  try {
    const supported = await facilitatorClient.getSupported();
    
    // Process each supported kind (now flat array with version in each element)
    for (const kind of supported.kinds) {
      // ...
      // Only store if not already present (gives precedence to earlier facilitators)
      if (!responseNetworkMap.has(kind.scheme)) {
        responseNetworkMap.set(kind.scheme, supported);
        clientNetworkMap.set(kind.scheme, facilitatorClient);
      }
    }
  }
}
```
**The Priority Inversion**: Earlier facilitators take precedence (`if (!responseNetworkMap.has(kind.scheme))`). This means:
- If Facilitator A supports `usdc` on `eip155:8453` with fee 1%
- And Facilitator B supports `usdc` on `eip155:8453` with fee 0.5%
- Facilitator A wins, even though B is cheaper

The "first match wins" logic is hidden inside the initialization loop. There's no way for a later facilitator to override an earlier one, even if it's objectively better.

**The Fix**: Either:
1. Document that facilitator order matters (but this is fragile)
2. Allow facilitators to declare a `priority` score, and keep the highest-priority one
3. Collect ALL facilitators per scheme/network and route to them dynamically based on load/health

**C. Edge Case in Composition**

**Bug 5: x402Client.mergeExtensions (lines 249-277)**
```typescript
private mergeExtensions(
  serverExtensions?: Record<string, unknown>,
  schemeExtensions?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!schemeExtensions) return serverExtensions;
  if (!serverExtensions) return schemeExtensions;

  const merged = { ...serverExtensions };
  for (const [key, schemeValue] of Object.entries(schemeExtensions)) {
    const serverValue = merged[key];
    if (
      serverValue &&
      typeof serverValue === "object" &&
      schemeValue &&
      typeof schemeValue === "object"
    ) {
      // Deep merge: scheme info overlays server info, schema preserved
      merged[key] = { ...serverValue as Record<string, unknown>, ...schemeValue as Record<string, unknown> };
    } else {
      merged[key] = schemeValue;
    }
  }
  return merged;
}
```
**The Edge Case**: The deep merge only recurses ONE level. If `serverValue` and `schemeValue` are nested objects:
```typescript
serverExtensions = {
  eip2612: {
    token: "0x123...",
    spender: "0x456...",
    permittedAmount: "1000",
  }
}

schemeExtensions = {
  eip2612: {
    signature: "0xabc...",
    deadline: "1234567890",
  }
}
```
The merge produces:
```typescript
{
  eip2612: {
    token: "0x123...",      // from server
    spender: "0x456...",    // from server
    permittedAmount: "1000", // from server
    signature: "0xabc...",   // from scheme
    deadline: "1234567890",  // from scheme
  }
}
```
This works. BUT if `schemeExtensions` has a nested object that COLLIDES with a nested object from `serverExtensions`:
```typescript
serverExtensions = {
  eip2612: {
    token: "0x123...",
    metadata: {
      source: "server",
    }
  }
}

schemeExtensions = {
  eip2612: {
    metadata: {
      source: "scheme",  // OVERWRITES server.metadata.source
      signature: "0xabc...",
    }
  }
}
```
The merge produces:
```typescript
{
  eip2612: {
    token: "0x123...",
    metadata: {
      source: "scheme",  // Lost "server" source
      signature: "0xabc...",
    }
  }
}
```
The deep merge is not actually deep—it spreads `schemeValue` over `serverValue`, which overwrites nested keys.

**The Fix**: Proper recursive merge:
```typescript
function deepMerge(base: Record<string, unknown>, overlay: Record<string, unknown>): Record<string, unknown> {
  const result = { ...base };
  for (const [key, overlayValue] of Object.entries(overlay)) {
    const baseValue = result[key];
    if (baseValue && typeof baseValue === "object" && overlayValue && typeof overlayValue === "object" && !Array.isArray(overlayValue)) {
      result[key] = deepMerge(baseValue as Record<string, unknown>, overlayValue as Record<string, unknown>);
    } else {
      result[key] = overlayValue;
    }
  }
  return result;
}
```

**Bug 6: x402Facilitator.derivePattern (lines 531-548)**
```typescript
private derivePattern(networks: Network[]): Network {
  if (networks.length === 0) return "" as Network;
  if (networks.length === 1) return networks[0];

  // Extract namespaces (e.g., "eip155" from "eip155:84532")
  const namespaces = networks.map(n => n.split(":")[0]);
  const uniqueNamespaces = new Set(namespaces);

  // If all same namespace, use wildcard
  if (uniqueNamespaces.size === 1) {
    return `${namespaces[0]}:*` as Network;
  }

  // Mixed namespaces - use first network for exact matching
  return networks[0];
}
```
**The Edge Case**: `n.split(":")[0]` assumes ALL networks use the colon format. If a network is:
- `"eip155:8453"` → splits to `["eip155", "8453"]` → namespace is `"eip155"` ✓
- `"solana:mainnet"` → splits to `["solana", "mainnet"]` → namespace is `"solana"` ✓
- `"cosmoshub-4"` (no colon) → splits to `["cosmoshub-4"]` → namespace is `"cosmoshub-4"` ✓ (accidentally works)
- `""` (empty string) → splits to `[""]` → namespace is `""` ✓ (works but creates pattern `:*` which matches EVERYTHING)

**The Critical Bug**: If `networks` is empty, the function returns `""`. Later, this pattern is used in `new RegExp("^" + pattern.replace("*", ".*") + "$")`. An empty pattern creates regex `^$`, which matches only empty strings. But empty strings are not valid network identifiers. This creates a silent failure mode where facilitators registered with no networks will NEVER match any payment request.

**The Fix**:
```typescript
if (networks.length === 0) {
  throw new Error(`Cannot derive pattern from empty network array`);
}
```

**Bug 7: x402ResourceServer.findMatchingRequirements (lines 1007-1029)**
```typescript
findMatchingRequirements(
  availableRequirements: PaymentRequirements[],
  paymentPayload: PaymentPayload,
): PaymentRequirements | undefined {
  switch (paymentPayload.x402Version) {
    case 2:
      // For v2, match by accepted requirements
      return availableRequirements.find(paymentRequirements =>
        deepEqual(paymentRequirements, paymentPayload.accepted),
      );
    case 1:
      // For v1, match by scheme and network
      return availableRequirements.find(
        req =>
          req.scheme === paymentPayload.accepted.scheme &&
          req.network === paymentPayload.accepted.network,
      );
    default:
      throw new Error(
        `Unsupported x402 version: ${(paymentPayload as PaymentPayload).x402Version}`,
      );
  }
}
```
**The Edge Case**: The `default` case throws an error, but this is unreachable if TypeScript types are correct (`x402Version` is `number`). However, the runtime value can be ANY number (including 3, 4, 100, -1, etc.). The function should handle unknown versions gracefully:
```typescript
default:
  // Unknown version - attempt partial match by scheme/network
  return availableRequirements.find(
    req =>
      req.scheme === paymentPayload.accepted?.scheme &&
      req.network === paymentPayload.accepted?.network,
  );
```

**The More Critical Bug**: For v2, the function uses `deepEqual` to compare the ENTIRE `PaymentRequirements` object. This includes nested fields like `extra`, `amount`, `asset`, `payTo`, etc. If the server's requirements include dynamic data (like a timestamp or nonce) that changes between requests, the deep equality check will fail even if the scheme/network match.

For example:
- Server requires: `{ scheme: "usdc", network: "eip155:8453", amount: "1000", extra: { timestamp: "2024-01-01T00:00:00Z" } }`
- Client sends: `{ accepted: { scheme: "usdc", network: "eip155:8453", amount: "1000", extra: { timestamp: "2024-01-01T00:00:01Z" } } }`

The `deepEqual` check fails because the timestamps differ by 1 second. The payment is rejected even though it's for the same scheme and network.

**The Fix**: For v2, match on a subset of fields that are stable (scheme, network, maybe payTo):
```typescript
case 2:
  return availableRequirements.find(req =>
    req.scheme === paymentPayload.accepted.scheme &&
    req.network === paymentPayload.accepted.network &&
    req.payTo === paymentPayload.accepted.payTo,
  );
```

  [2mSaved to .deep/findings/x402.md[0m
  [2mProfile: 106 scans, 0 patterns, 5 laws[0m
  [2mQueued 1 Q&As for AgentsKB seeding[0m

[1m[34m── RECURSIVE ENTAILMENT ── x402.txt ── [2msonnet[0m
  [2mModel → sonnet (optimal for prism)[0m
[2mthinking...[0m                                        I'll execute the structural analysis on this x402 payment protocol codebase.

## Step 1: Locate the Structural Defect

**Deepest Problem: The Hook Trilogy Pattern Repeated 9 Times with Inconsistent Semantics**

The codebase implements the same hook pattern **9 times** across 3 classes:
- `x402Client`: before/after/onFailure for PaymentCreation
- `x402Facilitator`: before/after/onFailure for Verify AND Settle  
- `x402ResourceServer`: before/after/onFailure for Verify AND Settle

**Exact locations of defect manifestation:**

1. **Lines 138-248 in x402Client**: `beforePaymentCreationHooks`, `afterPaymentCreationHooks`, `onPaymentCreationFailureHooks`
2. **Lines 260-355 in x402Facilitator**: `beforeVerifyHooks`, `afterVerifyHooks`, `onVerifyFailureHooks`  
3. **Lines 357-440 in x402Facilitator**: `beforeSettleHooks`, `afterSettleHooks`, `onSettleFailureHooks`
4. **Lines 570-625 in x402ResourceServer**: `beforeVerifyHooks`, `afterVerifyHooks`, `onVerifyFailureHooks`
5. **Lines 627-680 in x402ResourceServer**: `beforeSettleHooks`, `afterSettleHooks`, `onSettleFailureHooks`

**What the code cannot express cleanly:**

The hook system encodes three distinct operations that cannot be factored without losing their semantic relationship:
- **Abort capability** (before hooks)
- **Success observation** (after hooks)  
- **Error recovery** (onFailure hooks with `{recovered: true}` override)

The code cannot express "a cross-cutting lifecycle with transactional rollback capability" without duplicating this trilogy everywhere lifecycle management is needed.

## Step 2: Trace What a Fix Would Hide

**Proposed Fix:** Extract a `LifecycleManager<T>` class combining all three hook arrays and execution logic.

**Specific signals destroyed:**

1. **Abort semantics become unreachable** (lines 157-161 in x402Client): Before hooks can return `{abort: true, reason: string}` to halt operation. A generic `executeBefore()` wrapper would need to know to check for this specific return type shape. If abstracted as "run hooks before operation", the abort capability gets buried in generic "precondition checking" logic.

2. **Recovery override becomes invisible** (lines 233-238 in x402Client): onFailure hooks can return `{recovered: true, payload: PaymentPayload}` to convert failure → success. This is NOT the same as throwing a different error. A generic error handler would lose the distinction between "recovered" (normal return path restored) vs "caught and re-thrown" (error path).

3. **Verification failure duality erased** (lines 305-321 in x402Facilitator): The verify method has TWO failure modes:
   - Exception thrown (catch block, line 339)
   - `isValid: false` returned (line 296)
   
   Both trigger `onVerifyFailure` hooks but through different paths. A unified "executeWithHooks(operation)" wrapper would conflate these distinct failure types.

4. **After-hook conditional execution hidden** (lines 316-323 in x402Facilitator): AfterVerify hooks ONLY execute on successful verification (`isValid: true`), NOT on recovered verification. This subtle ordering constraint (after hooks execute for recovered result) would be lost in generic "execute after" logic.

## Step 3: Identify the Unfixable Invariant

**Apply the fix**: Extract `LifecycleManager<Context, Result, Error>` with `executeBefore()`, `executeAfter()`, `executeFailure()`.

**New problem created**: The LifecycleManager needs to know about:
- Abort return type shapes
- Recovery return type shapes  
- Which success path to take (normal vs recovered)
- Conditional after-hook execution rules

**Apply again**: Add type parameters for abort/recovery shapes: `LifecycleManager<C, R, E, A, Rec>`.

**New problem**: Every call site needs to specify 5 type parameters for what should be implicit context. The abstraction complexity exceeds the duplication it replaces.

**Apply again**: Try to infer types from hook function signatures.

**New problem**: TypeScript cannot infer union return types (`void | {abort: true}`). You'd need explicit type annotations everywhere.

**Persistent property through ALL iterations:**

**Operational phase coupling to transactional semantics.**

The three hook types are NOT independent. They form a **transaction protocol**:
- Phase 1 (before): Can veto transaction
- Phase 2 (operation): The transaction itself
- Phase 3 (after): Observe committed transaction
- Phase 3b (failure): Can rollback and retry

This protocol **cannot be decomposed** without losing the transactional relationship between phases. The "fixable" part (extracting hook arrays) destroys the "unfixable" part (the coordination between phases).

**The Invariant:**

**Phase ordering × State transition coupling = constant.**

You cannot simultaneously:
1. Extract hooks into reusable components (localize implementation)
2. Preserve transactional coordination across hooks (globalize semantics)

Factor the hooks → transaction coordination becomes implicit (lost in adapter layer).
Keep coordination explicit → hook logic must be duplicated at each transaction boundary.

**Verdict: STRUCTURAL**

This must be managed, never solved. The hook trilogy is the **minimum representation** of a transaction protocol with abort/recover capabilities. Any attempt to "DRY it up" will either:
- Lose abort/recovery semantics (hide them in generic wrappers)
- Require more complex type machinery than the original duplication
- Push the coordination problem to a different layer (middleware, decorators, proxies)

The current 9x duplication is the cost of making **transaction boundaries explicit** in the type system.

  [2mSaved to .deep/findings/x402.md[0m
  [2mProfile: 109 scans, 0 patterns, 5 laws[0m

[1m[34m── IDENTITY DISPLACEMENT ── x402.txt ── [2msonnet[0m
  [2mModel → sonnet (optimal for prism)[0m
[2mthinking...[0m                                        # Identity Displacement Analysis: x402 Protocol Core Server

## Step 1: Surface the Claim

### x402Client Claims
- **Type signature**: `register()`, `createPaymentPayload()`, `registerPolicy()`, `registerExtension()`
- **Documentation**: "Core client for managing x402 payment schemes and creating payment payloads"
- **Interface promises**: 
  - Hook methods (`onBeforePaymentCreation`, `onAfterPaymentCreation`, `onPaymentCreationFailure`) suggest lifecycle event notification
  - `createPaymentPayload()` appears to be a pure transformation function
  - `registerPolicy()` suggests filtering of payment requirements
  - Extension registration implies additive payload enrichment

### x402Facilitator Claims
- **Type signature**: `register()`, `verify()`, `settle()`, `getSupported()`
- **Documentation**: "Facilitator client for the x402 payment protocol. Manages payment scheme registration, verification, and settlement"
- **Interface promises**:
  - Hook methods suggest passive observation of verification/settlement lifecycle
  - `verify()` and `settle()` appear to be pure operations
  - `getSupported()` implies read-only capability discovery

### x402ResourceServer Claims
- **Type signature**: `register()`, `initialize()`, `verifyPayment()`, `settlePayment()`, `processPaymentRequest()`
- **Documentation**: "Core x402 protocol server for resource protection"
- **Interface promises**:
  - `initialize()` appears to be required setup
  - `buildPaymentRequirements()` suggests deterministic requirements generation
  - Hook methods imply lifecycle event notification
  - `processPaymentRequest()` promises complete payment workflow handling

---

## Step 2: Trace the Displacement

### **Displacement 1: Hooks are Control Flow Governors, Not Event Notifiers**

**Claim**: Hook methods (`onBefore*`, `onAfter*`, `on*Failure`) are named and documented as lifecycle event observers.

**Reality**: Hooks function as powerful control flow interruptors:
- `BeforePaymentCreationHook` can **abort** the entire operation by returning `{ abort: true, reason: string }`
- `OnPaymentCreationFailureHook` can **recover** from failures by returning `{ recovered: true, payload: PaymentPayload }`, completely bypassing the error
- Same pattern in `x402Facilitator` and `x402ResourceServer` - `before*` hooks can abort operations, `on*Failure` hooks can recover

**Location**: All three classes, lines 143-157 (x402Client), lines 172-218 (x402Facilitator), lines 247-283 (x402ResourceServer)

**Evidence**:
```typescript
// x402Client.createPaymentPayload
for (const hook of this.beforePaymentCreationHooks) {
  const result = await hook(context);
  if (result && "abort" in result && result.abort) {
    throw new Error(`Payment creation aborted: ${result.reason}`);
  }
}

// onPaymentCreationFailure recovery
for (const hook of this.onPaymentCreationFailureHooks) {
  const result = await hook(failureContext);
  if (result && "recovered" in result && result.recovered) {
    return result.payload; // Returns successful payload despite failure
  }
}
```

**Cost**: Naming mismatch ("on*" suggests notification, not control) + hooks introduce hidden control flow that's invisible from the main operation signature.

---

### **Displacement 2: `createPaymentPayload` Mutates Based on Protocol Version**

**Claim**: `createPaymentPayload()` is a single method with consistent behavior.

**Reality**: The method performs fundamentally different operations based on `x402Version`:
- **V1**: Returns `partialPayload` directly without any merging or enrichment (line 233-234)
- **V2**: Merges server extensions, adds resource and accepted fields, then calls extension hooks (lines 236-252)

**Location**: x402Client, lines 231-252

**Evidence**:
```typescript
if (partialPayload.x402Version == 1) {
  paymentPayload = partialPayload as PaymentPayload; // Direct pass-through
} else {
  // Complex merging and enrichment for V2
  const mergedExtensions = this.mergeExtensions(...);
  paymentPayload = {
    x402Version: partialPayload.x402Version,
    payload: partialPayload.payload,
    extensions: mergedExtensions,
    resource: paymentRequired.resource,  // Only added in V2
    accepted: requirements,              // Only added in V2
  };
}
```

**Cost**: A single method name hides two different workflows. V1 payloads bypass `mergeExtensions()` and extension hooks entirely - this is invisible to callers.

---

### **Displacement 3: Server `initialize()` is Optional but Required for Most Operations**

**Claim**: The constructor sets up the server; `initialize()` is an optional enhancement.

**Reality**: `initialize()` is **required** for:
- `buildPaymentRequirements()` to work (throws "Make sure to call initialize()" if no supported kinds)
- `getSupportedKind()` to return anything
- `verifyPayment()` and `settlePayment()` to find the correct facilitator client

**Location**: x402ResourceServer, lines 532-576

**Evidence**:
```typescript
// In buildPaymentRequirements, line 560
if (!supportedKind) {
  throw new Error(
    `Facilitator does not support ${SchemeNetworkServer.scheme} on ${resourceConfig.network}. ` +
    `Make sure to call initialize() to fetch supported kinds from facilitators.`
  );
}
```

However, the server's constructor allows it to be created without calling `initialize()`, and `processPaymentRequest()` will fail silently with empty requirements if `buildPaymentRequirements()` encounters the fallback warning (lines 545-553).

**Cost**: The "optional" naming creates a trap where developers might skip initialization, only to encounter runtime errors or silent failures.

---

### **Displacement 4: `processPaymentRequest()` is Incomplete**

**Claim**: Method signature suggests complete payment processing (verify + settle).

**Reality**: Method only performs verification. Settlement is left to the caller, despite the method name suggesting full processing.

**Location**: x402ResourceServer, lines 717-753

**Evidence**:
```typescript
// Payment verified, ready for settlement
return {
  success: true,
  verificationResult,
};
// No settlement occurs here, despite method name "processPaymentRequest"
```

The method returns when `verificationResult.isValid === true`, without calling `settlePayment()`. The actual settlement must be handled by the caller separately.

**Cost**: Naming misalignment - "process" implies complete workflow, but only half is performed.

---

### **Displacement 5: Policy Functions Can Transform, Not Just Filter**

**Claim**: `registerPolicy()` documentation says "filters or transforms" but the name "policy" suggests filtering rules.

**Reality**: Policies receive the full array and can return any array (modified, reordered, transformed objects). The example shows filtering, but nothing prevents transformation:

**Location**: x402Client, lines 114-127

**Evidence**:
```typescript
// Step 2: Apply all policies in order
let filteredRequirements = supportedPaymentRequirements;
for (const policy of this.policies) {
  filteredRequirements = policy(x402Version, filteredRequirements);
  // Policy could map/transform each requirement object
}
```

**Cost**: A "policy" is typically understood as a predicate (keep/discard), but here it's a transformation function. This asymmetry between naming and capability creates conceptual friction.

---

### **Displacement 6: Extension Merging is Asymmetric**

**Claim**: `mergeExtensions()` combines server and scheme extensions.

**Reality**: Scheme extensions **overlay** (replace) server extensions at each key, preserving only the server's schema structure, not its values.

**Location**: x402Client, lines 313-331

**Evidence**:
```typescript
// Deep merge: scheme info overlays server info, schema preserved
merged[key] = { ...serverValue, ...schemeValue };
// Scheme values win at overlapping keys
```

**Cost**: The word "merge" suggests combination, but the operation is "scheme overwrites server". A more honest name would be `overlayExtensions()` or `applySchemeOverrides()`.

---

### **Displacement 7: `x402Facilitator` Stores Multiple Facilitators Per Scheme**

**Claim**: Registration methods suggest one-to-one scheme-to-facilitator mapping.

**Reality**: `registeredFacilitatorSchemes` stores an **array** of `SchemeData` per version, supporting multiple facilitators with the same `scheme` name.

**Location**: x402Facilitator, lines 36-37, lines 605-615

**Evidence**:
```typescript
private readonly registeredFacilitatorSchemes: Map<
  number,
  SchemeData<SchemeNetworkFacilitator>[] // Array to support multiple facilitators per version
> = new Map();

// In _registerScheme
schemeDataArray.push({ facilitator, networks, pattern });
// Adds to array, doesn't overwrite
```

**Cost**: The naming (`register()`, not `registerMultiple()`) hides the multiplicity. Callers might assume `register()` overwrites previous facilitators, but it accumulates them.

---

### **Displacement 8: `findMatchingRequirements()` Behavior Changes by Version**

**Claim**: Single method `findMatchingRequirements()` matches payments to requirements.

**Reality**: Matching logic is completely different:
- **V1**: Matches by `scheme` and `network` only (partial matching)
- **V2**: Uses `deepEqual()` on entire requirements object (exact matching)

**Location**: x402ResourceServer, lines 693-713

**Evidence**:
```typescript
switch (paymentPayload.x402Version) {
  case 2:
    return availableRequirements.find(paymentRequirements =>
      deepEqual(paymentRequirements, paymentPayload.accepted),
    );
  case 1:
    return availableRequirements.find(
      req =>
        req.scheme === paymentPayload.accepted.scheme &&
        req.network === paymentPayload.accepted.network,
    );
}
```

**Cost**: Same method name, different matching semantics. V1 is looser (ignores amount, asset, payTo), V2 is strict.

---

## Step 3: Name the Cost

### **NECESSARY Displacements**

1. **Hooks as Control Flow (Displacement 1)**
   - **Cost**: Ability to implement permission checks, audit logging, and custom abort logic without modifying core classes
   - **Honest version sacrifice**: Would need separate `can*()` methods before each operation, or explicit middleware pipeline - both more verbose and harder to extend
   - **Verdict**: NECESSARY - The convenience of inline control flow outweighs naming imprecision

2. **V1 vs V2 Payload Handling (Displacement 2)**
   - **Cost**: Backward compatibility with V1 protocol while supporting V2's richer payload structure
   - **Honest version sacrifice**: Would need separate `createV1Payload()` and `createV2Payload()` methods, breaking existing V1 clients
   - **Verdict**: NECESSARY - Protocol evolution requires divergent behavior under one interface

3. **Asymmetric Extension Merging (Displacement 6)**
   - **Cost**: Scheme-specific data (EIP-2612 signatures, gas sponsorship info) must override server declarations
   - **Honest version sacrifice**: Would require explicit conflict resolution for every key, or prevent overlapping keys entirely
   - **Verdict**: NECESSARY - Server declares schema, scheme provides values; overlay is the correct semantic

4. **Optional Initialization (Displacement 3)**
   - **Cost**: Allows deferred facilitator connection and graceful degradation
   - **Honest version sacrifice**: Would require constructor to await async facilitator calls, breaking synchronous instantiation pattern
   - **Verdict**: NECESSARY - Async initialization can't happen in constructor without major API changes

5. **Multiple Facilitators Per Scheme (Displacement 7)**
   - **Cost**: Supports multiple facilitator instances with overlapping scheme support
   - **Honest version sacrifice**: Would need unique registration keys or explicit facilitator selection logic
   - **Verdict**: NECESSARY - Enables fallback and load balancing without changing registration API

### **ACCIDENTAL Displacements**

6. **`processPaymentRequest()` Incomplete (Displacement 4)**
   - **Cost**: None apparent - appears to be oversight
   - **Honest version**: Rename to `verifyPaymentForRequest()` or complete the workflow with settlement
   - **Verdict**: ACCIDENTAL - Method name promises "processing" but delivers only verification

7. **Policy Name Asymmetry (Displacement 5)**
   - **Cost**: None - naming is purely conventional
   - **Honest version**: Rename to `registerRequirementTransformer()` or add separate `registerFilter()` and `registerTransformer()`
   - **Verdict**: ACCIDENTAL - "Policy" suggests filtering, but transformation is equally supported

8. **Version-Dependent Matching (Displacement 8)**
   - **Cost**: V1's loose matching might allow mismatched payments through (e.g., wrong amount)
   - **Honest version**: Separate `findMatchingRequirementsV1()` and `findMatchingRequirementsV2()` methods
   - **Verdict**: ACCIDENTAL - Hiding version-dependent logic behind one interface creates confusion about matching strictness

---

### **Summary**

The x402 protocol implementation shows a pattern of **necessary complexity** hiding behind simple interfaces. Most displacements (1, 2, 3, 6, 7) are the cost of supporting:
- Protocol evolution (V1 → V2)
- Backward compatibility
- Extensibility (hooks, extensions, policies)
- Async initialization constraints

The accidental displacements (4, 5, 8) are technical debt:
- Method naming that doesn't reflect actual behavior (`processPaymentRequest`)
- Conventional terminology that obscures capability ("policy")
- Version-dependent logic behind unified interfaces (`findMatchingRequirements`)

**Core conservation law**: `Flexibility × Predictability = constant`. Every hook, policy, and version check adds flexibility at the cost of making behavior harder to predict from method names alone.

  [2mSaved to .deep/findings/x402.md[0m
  [2mProfile: 113 scans, 0 patterns, 5 laws[0m

[1m[34m── OPTIMIZATION COSTS ── x402.txt ── [2msonnet[0m
  [2mModel → sonnet (optimal for prism)[0m
[2mthinking...[0m                                        # Step 1: Search for Opacity

## Boundary 1: Dynamic Dispatch to Scheme Implementations
**Location**: `x402Client.register()` → `SchemeNetworkClient` interface
- **Hidden**: `createPaymentPayload()` implementation details, allocation patterns, whether implementation performs network I/O, cryptographic operations, or is pure in-memory
- **Erased**: Cache behavior (cold vs warm cache misses), branch predictability of scheme-specific logic, memory locality of scheme-specific data structures

## Boundary 2: Hook Execution Chains
**Location**: Arrays `beforePaymentCreationHooks[]`, `afterPaymentCreationHooks[]`, `onPaymentCreationFailureHooks[]` (x402Client, x402Facilitator, x402ResourceServer all have similar patterns)
- **Hidden**: Hook execution order dependencies, which hooks mutate shared state vs pure observers, exception handling patterns per hook
- **Erased**: Lock contention if hooks access shared resources, allocation patterns per hook, branch predictability (each hook can abort), memory locality of hook closures

## Boundary 3: Policy Filtering Chain
**Location**: `selectPaymentRequirements()` applies policies sequentially
- **Hidden**: Computational complexity of each policy, interaction effects between policies, which policies filter out which requirements
- **Erased**: Allocation patterns (array copying per policy), cache behavior (filtered arrays become smaller), branch predictability of policy predicates

## Boundary 4: Extension System Enrichment
**Location**: `ClientExtension.enrichPaymentPayload()`, `enrichPaymentPayloadWithExtensions()`
- **Hidden**: Whether extensions perform network calls, crypto operations, or are pure; which extensions are actually invoked based on `paymentRequired.extensions` presence
- **Erased**: Network latency (each extension could make HTTP calls), allocation patterns (extensions may clone payloads), cache misses in extension map lookups

## Boundary 5: Facilitator Network Calls
**Location**: `FacilitatorClient.verify()`, `FacilitatorClient.settle()`
- **Hidden**: Remote execution, network round trips, facilitator-side processing time
- **Erased**: Network latency (50-500ms per call), lock contention on facilitator side, retry behavior, connection pooling overhead

## Boundary 6: Nested Map Lookups for Scheme Resolution
**Location**: `registeredClientSchemes.get(version).get(network).get(scheme)` (similar patterns in x402Facilitator and x402ResourceServer)
- **Hidden**: Hash computation overhead, map resize behavior, collision handling
- **Erased**: Cache misses (3-4 pointer dereferences), allocation patterns if maps resize, memory locality of nested map structures

## Boundary 7: Version Switching Logic
**Location**: `if (partialPayload.x402Version == 1)` in `createPaymentPayload()`, `findMatchingRequirements()` switch statement
- **Hidden**: Why v1 needs different handling, what assumptions differ
- **Erased**: Branch prediction (misprediction penalty ~15 cycles), code cache locality (two code paths instead of one)

# Step 2: Trace the Blind Workarounds

## Workaround 1: Sequential Hook Execution Instead of Parallel
**Blocked Optimization**: Parallel hook execution with transactional rollback on abort
**What Code Does Instead**: Sequential for-loop with early return on abort
**Concrete Cost**: 
- If 3 hooks each take 10ms and are independent: 30ms sequential vs 10ms parallel = **20ms lost per request**
- Cannot benefit from multi-core even when hooks are independent
- Hook execution time dominates `createPaymentPayload()` latency

## Workaround 2: Deep Merge Instead of Shallow Reference
**Blocked Optimization**: Direct assignment (`paymentPayload.extensions = schemeExtensions`) with zero-copy
**What Code Does Instead**: `mergeExtensions()` recursively copies objects
**Concrete Cost**:
- Object allocation per merge: **~50-200 bytes per extension key**
- If extensions have nested objects with 10 keys each: **500-2000 bytes allocated per payment**
- GC pressure increases with payment volume

## Workaround 3: Linear Facilitator Search on Fallback
**Blocked Optimization**: Direct hash lookup via `(version, network, scheme)` tuple key
**What Code Does Instead**: Loop through all facilitators, try each until one succeeds
**Concrete Cost**:
- If 3 facilitators and only 3rd supports the combination: **2 failed network calls** = **100-1000ms wasted**
- Each failed call still requires HTTP round trip + JSON parsing
- Error handling overhead in try-catch inside loop

## Workaround 4: Sequential Extension Iteration
**Blocked Optimization**: Skip extensions not present in `paymentRequired.extensions` via O(1) lookup
**What Code Does Instead**: Iterate all registered extensions, check if key exists
**Concrete Cost**:
- If 10 extensions registered but only 2 used: **8 map lookups per payment** = **~80ns per lookup** (negligible but scales)
- Cannot predict early exit
- Extension registration map is scanned on every payment creation

## Workaround 5: Synchronous Extension Enrichment in Async Context
**Blocked Optimization**: Batch all extension enrichments into single async operation
**What Code Does Instead**: `await` inside loop, one extension at a time
**Concrete Cost**:
- If 3 extensions each make network call: **3 sequential round trips** = **150-1500ms total**
- Could parallelize to **50-500ms** (slowest extension only)
- Network watermark dominates processing time

## Workaround 6: Policy Array Filtering Creates Intermediate Arrays
**Blocked Optimization**: Filter in-place with indices or use iterator
**What Code Does Instead**: `filteredRequirements = policy(version, filteredRequirements)` creates new array per policy
**Concrete Cost**:
- If 5 policies, 100 requirements initially: **5 array allocations** of decreasing size
- Total allocations: ~100 + 80 + 60 + 40 + 20 = **300 array elements allocated**
- If policies are selective, most allocations are immediately garbage

## Workaround 7: Multiple Map Lookups for Scheme Resolution
**Blocked Optimization**: Single flat map with composite key `(version, network, scheme)`
**What Code Does Instead**: 3 nested `.get()` calls
**Concrete Cost**:
- **3 hash computations + 3 indirections** per lookup
- If lookup happens 10 times per payment: **30 hash operations**
- Each indirection potential L1 cache miss (~4 cycles)
- Nested Maps store duplicate keys, increasing memory footprint

## Workaround 8: Facilitator Fallback Silence
**Blocked Optimization**: Explicit capability declaration before runtime
**What Code Does Instead**: Try all facilitators on error, throw if all fail
**Concrete Cost**:
- **No ability to pre-validate** facilitator support
- Only discover missing support at payment processing time
- Debugging requires runtime tracing instead of static analysis

# Step 3: Name the Conservation Law

| Boundary | Erased Data | Blocked Optimization | Blind Workaround | Concrete Cost | Flattening Breaks |
|----------|-------------|---------------------|------------------|---------------|-------------------|
| **Hook execution chains** | Hook independence, exception behavior | Parallel execution with transactional rollback | Sequential for-loop with early abort | 20ms per request with 3 hooks | **Hooks cannot depend on execution order or shared state mutation** |
| **Extension merging** | Extension data ownership, mutability | Zero-copy reference passing | Deep merge with object allocation | 500-2000 bytes GC per payment | **Scheme extensions would corrupt server declarations if shared** |
| **Facilitator fallback** | Static capability registry | Direct hash lookup to correct facilitator | Linear search with try-catch | 100-1000ms on mismatch | **Facilitators become responsible for maintaining capability registry** |
| **Policy filtering** | Policy selectivity patterns | Single-pass in-place filter | Array allocation per policy | 300 elements allocated per payment | **Policies cannot see original unfiltered requirements** |
| **Extension enrichment** | Network vs pure extension behavior | Batched async parallel calls | Sequential await in loop | 150-1500ms for 3 network extensions | **Extensions cannot depend on sequential execution order** |
| **Scheme resolution** | Scheme registration distribution | Single flat map lookup | 3-level nested map traversal | 30 hash ops per payment | **Network isolation requires separate scheme namespaces per version** |

## Conservation Law: **Extensibility Is Conserved by Runtime Cost**

**Meta-form**: `flexibility × execution_certainty = constant`

**Explanation**: 
- The x402 protocol prioritizes **runtime flexibility** (hooks, policies, extensions, dynamic scheme registration) over **static optimization** (parallel execution, zero-copy, direct lookups)
- Every boundary that allows runtime customization (registering hooks, policies, schemes, extensions) **necessarily erases performance information** that would enable optimization
- Flattening any boundary (e.g., making hooks parallel, using direct lookups) **breaks the extensibility contract** that allows users to inject custom behavior at runtime
- The protocol trades **predictable local performance** for **unbounded global extensibility**

**Specific Conservation Laws by Subsystem**:
1. **Hook System**: `execution_order_guarantees × parallelism = constant` — Cannot have both ordered execution AND parallel speedup
2. **Extension System**: `data_isolation × memory_efficiency = constant` — Cannot have both isolated extension state AND zero-copy sharing
3. **Facilitator Lookup**: `runtime_discovery × lookup_speed = constant` — Cannot have both dynamic facilitator routing AND O(1) lookups
4. **Policy System**: `filtering_transparency × allocation_efficiency = constant` — Cannot have both per-policy visibility AND single-pass filtering

  [2mSaved to .deep/findings/x402.md[0m
  [2mProfile: 116 scans, 0 patterns, 5 laws[0m

[1m[34m── ERROR RESILIENCE ── x402.txt ── [2msonnet[0m
  [2mModel → sonnet (optimal for prism)[0m
[2mthinking...[0m                                        # Step 1: The Error Boundaries

## 1. Hook Error Transforms (x402Client.createPaymentPayload)

**Boundary**: Lines 331-340 catch block
```typescript
} catch (error) {
  const failureContext: PaymentCreationFailureContext = {
    ...context,
    error: error as Error,
  };
```

**Destroyed context**:
- **Call stack**: Original stack trace from `schemeNetworkClient.createPaymentPayload()` is preserved but wrapped
- **Partial state**: `partialPayload` is lost if error occurs during enrichment
- **Error type information**: Generic `Error` cast destroys subclass-specific properties (e.g., network-specific error codes, transaction hashes)
- **Timing information**: When during payload creation the error occurred (base creation vs extension enrichment vs post-hook)

**Preserved context**:
- `paymentRequired` (original server response)
- `selectedRequirements` (chosen payment option)
- Error message string
- Hook system gets full context object

## 2. Hook Abort Transforms (Multiple locations)

**Boundary**: Lines 294-297 (beforePaymentCreation)
```typescript
for (const hook of this.beforePaymentCreationHooks) {
  const result = await hook(context);
  if (result && "abort" in result && result.abort) {
    throw new Error(`Payment creation aborted: ${result.reason}`);
  }
}
```

**Destroyed context**:
- **Which hook aborted**: No identifier for which specific hook in the array initiated abort
- **Hook internal state**: What the hook observed that caused abort
- **Accumulated state**: Previous hooks may have modified context (if they could), lost on abort
- **Abort condition**: Was abort due to business logic, validation, security concern?

**Preserved context**:
- Abort reason string
- Full context at time of abort

## 3. Facilitator Verification Error Wrapper (x402Facilitator.verify)

**Boundary**: Lines 457-472 catch block
```typescript
} catch (error) {
  const failureContext: FacilitatorVerifyFailureContext = {
    ...context,
    error: error as Error,
  };
```

**Destroyed context**:
- **Verification stage**: Did error occur during signature verification, amount validation, or network-specific checks?
- **Facilitator-specific data**: Network-specific error metadata (e.g., EVM revert reasons, Solana account data)
- **Payment payload substructure**: Which specific field in payload caused failure
- **Recovery context**: What partial verification state was achieved before failure

**Preserved context**:
- Payment payload (full)
- Requirements
- Generic error
- Hook system gets context

## 4. Silent Scheme Registration Failure (x402Client.selectPaymentRequirements)

**Boundary**: Lines 533-549 filter operation
```typescript
const supportedPaymentRequirements = paymentRequirements.filter(requirement => {
  let clientSchemes = findSchemesByNetwork(clientSchemesByNetwork, requirement.network);
  if (!clientSchemes) {
    return false;
  }
  return clientSchemes.has(requirement.scheme);
})
```

**Destroyed context**:
- **Why no match**: Missing network? Missing scheme? Both? Version mismatch?
- **Partial match information**: Which schemes ARE available for that network
- **Filter order**: Which requirement was filtered first (ordering effect)

**Preserved context**:
- Filtered array (implicitly shows what failed)
- Later error at line 542 shows `JSON.stringify` of current state but no registration history

## 5. Extension Enrichment Error Silencing (x402ResourceServer)

**Boundary**: Lines 587-600
```typescript
try {
  const extensionData = await extension.enrichPaymentRequiredResponse(
    declaration,
    context,
  );
  // ...
} catch (error) {
  console.error(`Error in enrichPaymentRequiredResponse hook for extension ${key}:`, error);
}
```

**Destroyed context**:
- **Extension-specific failure**: Which extension failed and why
- **Enrichment state**: Partial enrichment already applied to response
- **Downstream impact**: Does missing enrichment break client expectations?
- **Error propagation**: Error logged but never surfaced to caller

**Preserved context**:
- Console log (operational visibility only)
- Rest of PaymentRequired response continues
- Other extensions still run

## 6. Facilitator Fallback Error Masking (x402ResourceServer.verifyPayment)

**Boundary**: Lines 743-764
```typescript
if (!facilitatorClient) {
  let lastError: Error | undefined;
  for (const client of this.facilitatorClients) {
    try {
      verifyResult = await client.verify(paymentPayload, requirements);
      break;
    } catch (error) {
      lastError = error as Error;
    }
  }
  if (!verifyResult!) {
    throw lastError || new Error(`No facilitator supports...`);
  }
}
```

**Destroyed context**:
- **All failed attempts**: Only preserves last error, not full failure history
- **Facilitator identity**: Which specific facilitator threw which error
- **Error taxonomy**: Network errors vs authentication errors vs validation errors
- **Retry exhaustion**: No indication of how many facilitators were tried

**Preserved context**:
- Last error (may be most relevant or least relevant)
- Final success if any facilitator succeeded

## 7. Payment Option Resolution Error Loss (buildPaymentRequirementsFromOptions)

**Boundary**: Lines 461-477
```typescript
for (const option of paymentOptions) {
  const resolvedPayTo = typeof option.payTo === "function" ? await option.payTo(context) : option.payTo;
  const resolvedPrice = typeof option.price === "function" ? await option.price(context) : option.price;
  // ...
  const requirements = await this.buildPaymentRequirements(resourceConfig);
  allRequirements.push(...requirements);
}
```

**Destroyed context**:
- **Which option failed**: No individual try-catch per option
- **Resolution stage**: Failed on payTo resolution or price resolution or requirement building?
- **Partial results**: If option 3 fails, options 1-2 are lost to caller
- **Dynamic resolution context**: What transport context triggered the failure

**Preserved context**:
- Entire loop fails on first error
- No accumulated requirements returned

## 8. Network Pattern Matching Loss (_registerScheme)

**Boundary**: Lines 919-926 derivePattern
```typescript
private derivePattern(networks: Network[]): Network {
  if (networks.length === 0) return "" as Network;
  if (networks.length === 1) return networks[0];
  const namespaces = networks.map(n => n.split(":")[0]);
  const uniqueNamespaces = new Set(namespaces);
  if (uniqueNamespaces.size === 1) {
    return `${namespaces[0]}:*` as Network;
  }
  return networks[0];
}
```

**Destroyed context**:
- **Mixed namespace handling**: When networks have different namespaces (eip155, solana), only first network is used
- **Pattern information**: Caller doesn't know if they got exact match or wildcard
- **Lost networks**: Additional networks beyond first in mixed case are silently dropped from pattern
- **Registration intent**: Was wildcard intended or accidental?

**Preserved context**:
- At least one network is always represented
- Wildcard pattern for same-namespace cases

## 9. SettleResponse Extension Enrichment Error Silencing

**Boundary**: Lines 877-888
```typescript
try {
  const extensionData = await extension.enrichSettlementResponse(
    declaration,
    resultContext,
  );
  if (extensionData !== undefined) {
    if (!settleResult.extensions) {
      settleResult.extensions = {};
    }
    settleResult.extensions[key] = extensionData;
  }
} catch (error) {
  console.error(`Error in enrichSettlementResponse hook for extension ${key}:`, error);
}
```

**Destroyed context**:
- **Which extensions failed**: Error logged but not tracked in response
- **Partial enrichment**: Some extensions succeeded, some failed
- **Client expectation**: Does client expect all declared extensions to be present?
- **Settlement consistency**: Is settlement valid if enrichment fails?

**Preserved context**:
- Settlement proceeds regardless
- Successful enrichments applied
- Console visibility for debugging

## 10. Version-specific Payload Merge Loss

**Boundary**: Lines 304-321 createPaymentPayload
```typescript
if (partialPayload.x402Version == 1) {
  paymentPayload = partialPayload as PaymentPayload;
} else {
  const mergedExtensions = this.mergeExtensions(
    paymentRequired.extensions,
    partialPayload.extensions,
  );
  paymentPayload = {
    x402Version: partialPayload.x402Version,
    payload: partialPayload.payload,
    extensions: mergedExtensions,
    resource: paymentRequired.resource,
    accepted: requirements,
  };
}
```

**Destroyed context**:
- **V1-specific fields**: If V1 has fields not in V2 PaymentPayload type, they're lost
- **Merge conflicts**: mergeExtensions deep merge may overwrite server extensions with scheme extensions silently
- **Extension precedence**: Not documented which wins in conflict (server or scheme)
- **Version transition state**: What happens when V2 payload claims to be V1?

**Preserved context**:
- Version field preserved
- Core payload data preserved
- Resource reference preserved

---

# Step 2: The Missing Context

## Boundary 1: Hook Abort Without Hook Identity

**Destroyed**: Which specific hook aborted payment creation

**Trace forward**:

When `beforePaymentCreationHook` aborts at line 296:
```typescript
throw new Error(`Payment creation aborted: ${result.reason}`);
```

**Wrong decision taken**: Caller cannot determine which hook caused abort

**Downstream impact**:

1. **Debugging impossible**: Developer registered multiple hooks (e.g., rate limiting hook, balance check hook, compliance hook) but error message only shows reason "Insufficient balance" - cannot determine which balance check failed (user's wallet? platform's pool? network congestion?)

2. **Hook ordering dependencies**: If Hook A modifies context that Hook B depends on, and Hook B aborts, the abort reason might reflect Hook B's perspective but not show Hook A's modification that caused it

3. **Hook composition impossible**: Cannot build "first hook that fails wins" vs "all hooks must pass" patterns because no hook identity in abort

4. **Logging insufficient**: Application logs show "Payment creation aborted: Invalid amount" but distributed tracing can't attribute to specific microservice's hook

**Harm**: Silent retry loops (retry without knowing which hook failed, causing infinite aborts), observability black holes (cannot add per-hook metrics), inability to add per-hook retry logic

**Misleading error**: "Payment creation aborted: Invalid amount" appears to be amount validation issue but could actually be:
- Rate limiter hook rejecting due to frequency (uses amount field as rate limit key)
- Compliance hook triggering AML check (uses amount field for risk scoring)
- Network congestion hook estimating gas (uses amount for gas calculation)

All three produce same error surface but require different remediation actions.

---

## Boundary 2: Extension Enrichment Error Silencing

**Destroyed**: Which extension failed during enrichment

**Trace forward**:

When `enrichPaymentRequiredResponse` fails at line 596:
```typescript
} catch (error) {
  console.error(`Error in enrichPaymentRequiredResponse hook for extension ${key}:`, error);
}
```

**Wrong decision taken**: Client receives PaymentRequired response without the failed extension's data

**Downstream impact**:

1. **Client validation failure**: Client expects all declared extensions to have enrichment data (e.g., EIP-2612 extension must have `permitSignature` field). When enrichment fails silently, client receives incomplete response and throws cryptic error "Missing permit signature" - developer spends hours debugging server-side extension code when issue was actually silent enrichment failure

2. **Partial state corruption**: Extension A (gas estimation) fails silently, Extension B (nonce) succeeds. Client receives valid nonce but no gas estimate. Client uses default gas (too low), transaction fails on-chain. Developer thinks gas estimator is broken when actually extension was never called

3. **Security blind spots**: Compliance extension enrichment fails to fetch sanctions list data. Server returns PaymentRequired without compliance flags. Client proceeds with payment to sanctioned address. Transaction rejected by facilitator but user charged gas fees. No audit trail of why compliance check didn't run

4. **Cascade of silent failures**: Multiple extensions fail in loop. Only last one's error is logged (overwrites console.error). First 3 extensions' errors lost completely. Application monitoring shows extension errors but cannot determine which extensions or how many

**Harm**: Production incidents where client receives incomplete PaymentRequired but cannot distinguish "server doesn't support this extension" from "server failed to enrich extension", leading to incorrect fallback logic, retry storms, or security bypasses

**Silent incorrect result**: Client receives 200 OK with PaymentRequired.extensions = {eip2612: {...}} but eip2612 object is missing required `deadline` field due to failed enrichment. Client attempts to sign permit without deadline, signature invalid, user wasted gas, server blames client, client blames server

---

## Boundary 3: Facilitator Fallback Error Masking

**Destroyed**: All but last facilitator error

**Trace forward**:

When primary facilitator fails at line 756:
```typescript
for (const client of this.facilitatorClients) {
  try {
    verifyResult = await client.verify(paymentPayload, requirements);
    break;
  } catch (error) {
    lastError = error as Error;
  }
}
```

**Wrong decision taken**: Only last error thrown, hiding facilitator-specific failure patterns

**Downstream impact**:

1. **Misdiagnosis of network issues**: Facilitator A (HTTP) fails with timeout (network issue), Facilitator B (WebSocket) fails with authentication failure (token expired). Only auth error thrown. Ops team rotates auth tokens (unnecessary) but actual issue is network connectivity to Facilitator A

2. **Partial verification blind spots**: Facilitator A validates signature but fails on amount check, Facilitator B fails on signature. Only signature error thrown. Developer thinks "signature validation broken" but actually signature was valid, amount was wrong. Fix signature validation code (wasted effort) when actual bug was in amount comparison

3. **Facilitator routing black hole**: App has 3 facilitators (primary, secondary, tertiary). Primary has route to Mainnet, secondary to Testnet, tertiary to Testnet. Payment requires Mainnet. Primary down. Secondary tries to verify on Testnet (fails: wrong chain), tertiary tries Testnet (fails). Error: "Transaction doesn't exist" - no indication that wrong network was tried, no indication that primary was down

4. **Retry logic broken**: App's retry loop sees "No facilitator supports..." generic error, treats as permanent failure, doesn't retry. But actual error was transient timeout on primary, secondary would have succeeded if retry occurred

**Harm**: Mean time to resolution (MTTR) increases because errors don't indicate which facilitator failed or why, inability to add per-facilitator alerts, shadow traffic patterns (silent retries that never succeed), cascading failures when all fallbacks exhausted but root cause unclear

**Misleading error**: "No facilitator supports eip155:1" suggests protocol incompatibility when actual error was temporary network issue. Ops team disables eip155:1 support (unnecessary) breaking all Ethereum payments when issue was just network blip

---

## Boundary 4: Payment Option Resolution Cascading Failure

**Destroyed**: All successfully resolved payment options if one fails

**Trace forward**:

When `buildPaymentRequirementsFromOptions` encounters error at line 470:
```typescript
const resolvedPrice = typeof option.price === "function" ? await option.price(context) : option.price;
```

**Wrong decision taken**: No try-catch per option, entire loop fails

**Downstream impact**:

1. **Total payment method blackout**: Server offers 3 payment methods (ETH, USDC, DAI). ETH price resolution succeeds, USDC price resolution fails (oracle timeout), DAI price resolution never attempted. User receives "No payment methods available" when 2 of 3 methods work. Lost revenue from users who would pay with ETH or DAI

2. **Dynamic pricing silent failure**: `option.price` is async function fetching real-time price. First option's price oracle times out. Exception thrown. Subsequent options' price oracles never called (which would have succeeded). Application monitoring shows "price oracle timeout" but doesn't indicate that 2 other oracles were healthy

3. **Transport context coupling**: Price resolution requires HTTP request context to get user's IP for geo-pricing. Option 1's geo-fence check throws exception (missing IP header). Entire payment options building fails. User sees 500 error when payment doesn't actually require geo-fencing (could fallback to flat pricing)

4. **Partial state leaks**: Option 1's `resolvedPayTo` succeeds (address resolved from user ID), Option 1's `resolvedPrice` fails. Exception thrown. But Option 1's payTo address is now "used" (incremented nonce or marked reserved in database) even though payment won't be created. Address reservation leaked, cannot be reused

**Harm**: Revenue loss from false negatives (reporting "no payment methods" when methods exist), database state corruption (leaked reservations), user experience degradation (generic error instead of graceful degradation), inability to offer partial payment options

**Silent incorrect result**: No silent failure - loud exception thrown - but exception message doesn't indicate which option failed or why. Error: "Cannot read property 'amount' of undefined" doesn't tell developer that option 2's price oracle returned null, option 1 never ran, option 3 never ran

---

## Boundary 5: Network Pattern Mixed Namespace Loss

**Destroyed**: Additional networks when namespaces differ

**Trace forward**:

When `_registerScheme` calls `derivePattern` at line 925:
```typescript
return networks[0];
```

**Wrong decision taken**: Only first network in mixed-namespace set is registered

**Downstream impact**:

1. **Silent payment method disappearance**: Server registers facilitator for ['eip155:1', 'eip155:8453', 'solana:mainnet']. derivePattern returns 'eip155:1'. getSupported() only reports eip155:1. Client queries supported, only sees Ethereum. User cannot pay with Base or Solana even though facilitator supports them. No error thrown, networks silently disappear

2. **Configuration brittleness**: Dev adds Solana to existing Ethereum-only facilitator config: ['eip155:1', 'solana:mainnet']. Expects getSupported() to return both. Only sees eip155:1. Adds Solana-specific route, tests, works. Adds to production. Solana payments still don't work because registration silently dropped Solana. Root cause: mixed namespace, not deployment issue

3. **Facilitator mismatch**: Server has facilitator A (Ethereum) on eip155:1, facilitator B (Solana) on solana:mainnet. Facilitator C (multi-chain) registered with networks: ['eip155:1', 'solana:mainnet']. C's derivePattern returns 'eip155:1'. Client sends Solana payment to server. Server tries to find facilitator for solana:mainnet. Finds C's registration (pattern 'eip155:1') but pattern matching fails. Error: "No facilitator supports solana:mainnet" - but C was supposed to support it

4. **Version confusion**: V1 registration used exact network strings, V2 adds patterns. Migration from V1 to V2 causes networks to silently disappear if config has mixed namespaces. No migration path, no warning

**Harm**: Silent feature removal (networks supported by facilitator but not exposed to clients), configuration bugs that only appear in production (when multi-chain configs added), impossible to debug (no error, network just missing from getSupported()), regression testing fails (test environment might have same-namespace networks, prod has mixed)

**Silent incorrect result**: getSupported() returns subset of actual supported networks. Client builds UI based on supported response, doesn't show Solana option. User assumes platform doesn't support Solana, goes to competitor. Facilitator fully supports Solana, registration bug prevented discovery

---

# Step 3: The Impossible Fix

## Boundary Destroying Most Information: **Extension Enrichment Error Silencing**

This boundary destroys the MOST information because:
1. **Error context lost**: Which extension failed, why, and what state was
2. **Response corruption**: Client receives incomplete response but cannot detect it
3. **Cascading impact**: Failed enrichment may cause downstream failures that are misdiagnosed
4. **Security blind spot**: Compliance/security extensions can fail silently
5. **Composability broken**: Cannot build robust extension systems if failures are invisible

---

## Fix A: Aggressive Error Propagation (Destroy Composition)

**Fix**: Throw on any enrichment failure, abort entire PaymentRequired response creation

```typescript
// Replace lines 587-600 with:
for (const [key, declaration] of Object.entries(extensions)) {
  const extension = this.registeredExtensions.get(key);
  if (extension?.enrichPaymentRequiredResponse) {
    try {
      const extensionData = await extension.enrichPaymentRequiredResponse(
        declaration,
        context,
      );
      if (extensionData !== undefined) {
        if (!response.extensions) {
          response.extensions = {};
        }
        response.extensions[key] = extensionData;
      }
    } catch (error) {
      throw new PaymentRequiredEnrichmentError(
        `Failed to enrich extension '${key}': ${error instanceof Error ? error.message : String(error)}`,
        {
          extensionKey: key,
          declaration,
          originalError: error,
          partialResponse: response,
        }
      );
    }
  }
}
```

**What Fix A Destroys**:
1. **Graceful degradation**: If non-critical extension fails (e.g., gas estimation), entire payment fails instead of continuing without gas estimate
2. **Partial functionality**: Client could handle missing optional extension data, but now never gets partial response
3. **Extension independence**: Broken extension blocks all other extensions from running
4. **Production resilience**: Transient failures (timeout, network blip) cause 500 errors instead of serving response with warning

**New Wrong Decision**:
- Optional extensions (nice-to-have metadata) are treated as mandatory
- Client cannot implement fallback logic ("if gas estimate missing, use default")
- Single broken extension takes down entire payment system

---

## Fix B: Full Error Preservation in Response (Destroy Transparency)

**Fix**: Add `failedExtensions` field to PaymentRequired, preserve all errors, never throw

```typescript
// In createPaymentRequiredResponse, before return:
const failedExtensions: Array<{key: string; error: string}> = [];

if (extensions) {
  for (const [key, declaration] of Object.entries(extensions)) {
    const extension = this.registeredExtensions.get(key);
    if (extension?.enrichPaymentRequiredResponse) {
      try {
        const extensionData = await extension.enrichPaymentRequiredResponse(
          declaration,
          context,
        );
        if (extensionData !== undefined) {
          if (!response.extensions) {
            response.extensions = {};
          }
          response.extensions[key] = extensionData;
        }
      } catch (error) {
        failedExtensions.push({
          key,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue with other extensions
      }
    }
  }
}

if (failedExtensions.length > 0) {
  response.failedExtensions = failedExtensions;
}

return response;
```

**What Fix B Destroys**:
1. **Error immediacy**: Errors must be explicitly checked in response body, not thrown as exceptions
2. **Type safety**: `failedExtensions` must be optional field, clients may not check it
3. **Observability integration**: Error logging frameworks that hook exception handlers won't see these errors
4. **Fail-fast semantics**: System continues with degraded state instead of stopping for attention

**New Wrong Decision**:
- Client must remember to check `response.failedExtensions` (easy to forget)
- Integration tests that don't check failedExtensions will pass even when extensions fail
- Monitoring must be updated to scan response bodies instead of just catching exceptions
- Silent failures become invisible if client ignores failedExtensions field

---

## What Survives Both Fixes: The Structural Invariant

**Invariant**: **Extension Enrichment Atomicity**

Both fixes preserve the fundamental property: **Either an extension contributes data to the response, or its failure is recorded.** No middle ground where extension silently fails with no trace.

Fix A: Success OR exception (atomic at transaction level)
Fix B: Success OR failedExtensions entry (atomic at extension level)

**Conserved Quantity**: **Total Failure Information = Explicit Exceptions + Response-Embedded Failures**

- Fix A: Failure info = 1 exception, 0 response-embedded failures
- Fix B: Failure info = 0 exceptions, N response-embedded failures

**Trade-off Surface**:

| Dimension | Fix A (Throw) | Fix B (Response Field) |
|-----------|---------------|------------------------|
| **Error visibility** | Automatic (exception handlers) | Manual (must check response) |
| **Graceful degradation** | Impossible | Supported |
| **Extension isolation** | Broken (one fails, all fail) | Preserved |
| **Client complexity** | Simple (try/catch) | Complex (check failedExtensions) |
| **Monitoring integration** | Native (APM catches exceptions) | Custom (must log from response) |
| **Backward compatibility** | Breaking (adds exception type) | Compatible (adds optional field) |
| **Production resilience** | Fragile (any failure = 500) | Robust (partial response served) |

**Impossible Simultaneous Satisfaction**:
- Cannot have **both** graceful degradation **and** automatic error visibility
- Cannot have **both** extension isolation **and** fail-fast semantics
- Cannot have **both** production resilience **and** immediate error surfacing

**The Conservation Law**:

```
(Error Visibility × Graceful Degradation) + (Extension Isolation × Fail-Fast) = Constant
```

Fix A maximizes Error Visibility and Fail-Fast at cost of Graceful Degradation and Extension Isolation.

Fix B maximizes Graceful Degradation and Extension Isolation at cost of Error Visibility and Fail-Fast.

**Structural Implication**: Extension enrichment is inherently a **partial failure domain**. The design must choose which dimension of failure to preserve. The current code (original) chose the worst of both: no error visibility AND no graceful degradation (silent logging).

The invariant reveals why the original implementation is a local maximum of badness: it destroys error information without preserving any benefit (resilience, composability, or visibility). Both Fix A and Fix B are superior because they conserve failure information, even if they optimize different trade-offs.

---

| Boundary | Destroyed | Wrong Decision | Harm | Fix A Destroys | Fix B Destroys | Invariant |
|----------|-----------|----------------|------|----------------|----------------|-----------|
| **Extension enrichment error silencing** (lines 587-600) | Which extension failed, why, partial enrichment state | Client receives incomplete PaymentRequired, cannot detect missing extension data | Security bypasses, production incidents from missing required fields, debugging impossibility | Graceful degradation (any failure = full 500 error), extension independence (one broken extension blocks all) | Error immediacy (must check response.failedExtensions), automatic monitoring (exceptions bypassed by manual field), fail-fast semantics | **Extension Enrichment Atomicity** = Explicit Exceptions + Response-Embedded Failures = Constant. Either success or recorded failure, no silent middle ground. |

  [2mSaved to .deep/findings/x402.md[0m
  [2mProfile: 122 scans, 0 patterns, 5 laws[0m

[1m[34m── CONTRACT FIDELITY ── x402.txt ── [2msonnet[0m
  [2mModel → sonnet (optimal for prism)[0m
[2mthinking...[0m                                        # Code Analysis: x402 Protocol Implementation

## Step 1: Map Explicit Promises to Implementation

### 1. Version Handling Logic vs. Documentation

**Location:** `x402Client.fromConfig()` and `x402ClientConfig` interface

**Promise:** The `x402Version` field in `SchemeRegistration` is documented with `@default 2`, suggesting that omitting this field will default to version 2.

**Implementation Reality:**
```typescript
// x402ClientConfig interface
x402Version?: number;  // @default 2

// fromConfig implementation
config.schemes.forEach(scheme => {
  if (scheme.x402Version === 1) {
    client.registerV1(scheme.network, scheme.client);
  } else {
    client.register(scheme.network, scheme.client);
  }
});
```

**Violation:** The implementation checks `scheme.x402Version === 1`, treating everything else (including `undefined`) as the current version. The "default 2" promise is misleading because:
- `undefined` !== 1, so it goes to `register()` which uses `x402Version` (the module-level constant)
- The documentation suggests explicit version 2 as default, but the implementation uses the current module version
- A user explicitly setting `x402Version: 2` works the same as omitting it, but for different reasons

---

### 2. Extension Processing Order Documentation

**Location:** `registerExtension()` docstring in `x402Client.ts`

**Promise:** "Extensions are invoked after the scheme creates the base payload and the payload is wrapped with extensions/resource/accepted data."

**Implementation Reality:**
```typescript
// Line ~180-200
const partialPayload = await schemeNetworkClient.createPaymentPayload(...);

let paymentPayload: PaymentPayload;
if (partialPayload.x402Version == 1) {
  paymentPayload = partialPayload as PaymentPayload;
} else {
  // Merge extensions HERE
  const mergedExtensions = this.mergeExtensions(
    paymentRequired.extensions,
    partialPayload.extensions,
  );
  
  paymentPayload = {
    x402Version: partialPayload.x402Version,
    payload: partialPayload.payload,
    extensions: mergedExtensions,  // Server + scheme extensions
    resource: paymentRequired.resource,
    accepted: requirements,
  };
}

// THEN enrich via registered extensions
paymentPayload = await this.enrichPaymentPayloadWithExtensions(paymentPayload, paymentRequired);
```

**Violation:** The actual order is:
1. Scheme creates base payload
2. **Server extensions merge with scheme extensions** (creating wrapped payload)
3. **Client extensions enrich** the already-wrapped payload

The documentation's phrasing "after... wrapped" is correct but vague about what happens in that wrapping. The key unmentioned step is that **server extensions are merged with scheme extensions BEFORE client extensions run**, which affects what client extensions see and can modify.

---

### 3. Policy Application Failure Handling

**Location:** `selectPaymentRequirements()` method

**Promise:** Policy type documentation says "A policy function that filters or transforms payment requirements."

**Implementation Reality:**
```typescript
// Step 2: Apply all policies in order
let filteredRequirements = supportedPaymentRequirements;
for (const policy of this.policies) {
  filteredRequirements = policy(x402Version, filteredRequirements);

  if (filteredRequirements.length === 0) {
    throw new Error(`All payment requirements were filtered out by policies for x402 version: ${x402Version}`);
  }
}
```

**Violation:** Policies that "transform" requirements must return the same requirements (possibly modified), but the implementation treats them as filters. If a policy returns an **empty array** to signal "no acceptable options," it throws an error instead of allowing this as a valid transformation result. The error message suggests "filtered out" is the only expected empty-array scenario, but "transform" suggests the ability to return an empty set as a valid result (e.g., "I want to reject all options intentionally").

---

## Step 2: Detect Stale Descriptive State

### 1. Fallback Implementation TODO

**Location:** `buildPaymentRequirements()` in `x402ResourceServer.ts`

**Stale Comment:**
```typescript
if (!SchemeNetworkServer) {
  // Fallback to placeholder implementation if no server registered
  // TODO: Remove this fallback once implementations are registered
  console.warn(
    `No server implementation registered for scheme: ${scheme}, network: ${resourceConfig.network}`,
  );
  return requirements;  // Returns empty array
}
```

**Evolutionary Drift:** This comment indicates temporary fallback behavior, but this has become **production behavior**. When no server is registered, the method silently returns an empty requirements array rather than throwing an error. This causes `createPaymentRequiredResponse()` to be called with an empty `accepts` array, which creates an invalid PaymentRequired response (no valid payment options). The TODO suggests this was meant to be temporary, but it's now the permanent error-handling strategy.

---

### 2. Version-Specific Payload Processing

**Location:** `createPaymentPayload()` in `x402Client.ts`

**Stale Logic:**
```typescript
let paymentPayload: PaymentPayload;
if (partialPayload.x402Version == 1) {
  paymentPayload = partialPayload as PaymentPayload;
} else {
  // V2+ processing: merge extensions, wrap with resource/accepted
  paymentPayload = {
    x402Version: partialPayload.x402Version,
    payload: partialPayload.payload,
    extensions: mergedExtensions,
    resource: paymentRequired.resource,
    accepted: requirements,
  };
}
```

**Evolutionary Drift:** This code assumes only two versions: V1 and everything else (V2). If V3 is introduced, it will be processed with V2 logic, which may be incorrect. There's no explicit handling for unknown versions, and no switch statement or version registry. The `== 1` comparison (not `===`) further suggests this was written with loose type assumptions.

---

### 3. Empty Facilitator Clients Constructor Handling

**Location:** `x402ResourceServer` constructor

**Stale State:**
```typescript
constructor(facilitatorClients?: FacilitatorClient | FacilitatorClient[]) {
  if (!facilitatorClients) {
    this.facilitatorClients = [new HTTPFacilitatorClient()];
  } else if (Array.isArray(facilitatorClients)) {
    this.facilitatorClients = facilitatorClients.length > 0 
      ? facilitatorClients 
      : [new HTTPFacilitatorClient()];
  } else {
    this.facilitatorClients = [facilitatorClients];
  }
}
```

**Evolutionary Drift:** The constructor ensures at least one facilitator client exists, defaulting to `HTTPFacilitatorClient()`. However, the `initialize()` method later throws an error if **all** facilitators fail to fetch supported kinds. This creates two different failure modes:
1. Constructor: Never fails, always provides default
2. `initialize()`: Can throw if default HTTP client can't reach facilitator

The documentation doesn't explain why the constructor is lenient but `initialize()` is strict, or that users should call `initialize()` immediately after construction.

---

## Step 3: Identify Asymmetric Documentation Contracts

### 1. Network Type Safety Asymmetry

**Location:** `registerV1()` in `x402Client.ts`, `register()` in `x402Facilitator.ts`

**Public Promise:**
```typescript
// x402Client.registerV1()
registerV1(network: string, client: SchemeNetworkClient): x402Client

// x402Facilitator.registerV1()
registerV1(networks: Network | Network[], facilitator: SchemeNetworkFacilitator)
```

**Implementation Reality:**
```typescript
// x402Client.registerV1()
registerV1(network: string, client: SchemeNetworkClient): x402Client {
  return this._registerScheme(1, network as Network, client);  // Type assertion!
}

// Internal _registerScheme
private _registerScheme(x402Version: number, network: Network, client: SchemeNetworkClient) {
  // No validation that `network` matches Network type
  const clientSchemesByNetwork = this.registeredClientSchemes.get(x402Version)!;
  clientSchemesByNetwork.set(network, new Map());  // Accepts any string
}
```

**Violation:** The public API accepts `string` (in client) or `Network` (in facilitator), but internally both are treated as opaque map keys with **no runtime validation**. A user could pass `"not-a-real-network"` and it would register successfully, only failing later when trying to create payments. The type annotation in `registerV1` (client) claims it accepts `string`, but the internal type system requires `Network` - this is enforced only at compile time, not runtime.

---

### 2. Hook Return Type Contracts

**Location:** `BeforeVerifyHook`, `BeforeSettleHook` in `x402ResourceServer.ts`

**Public Promise:**
```typescript
export type BeforeVerifyHook = (
  context: VerifyContext,
) => Promise<void | { abort: true; reason: string; message?: string }>;

export type BeforeSettleHook = (
  context: SettleContext,
) => Promise<void | { abort: true; reason: string; message?: string }>;
```

**Implementation Reality (verifyPayment):**
```typescript
for (const hook of this.beforeVerifyHooks) {
  try {
    const result = await hook(context);
    if (result && "abort" in result && result.abort) {
      return {
        isValid: false,
        invalidReason: result.reason,  // Uses `reason`
        invalidMessage: result.message,  // Uses `message`
      };
    }
  } catch (error) {
    throw new VerifyError(400, {
      isValid: false,
      invalidReason: "before_verify_hook_error",
      invalidMessage: error instanceof Error ? error.message : "",
    });
  }
}
```

**Violation:** The hook contract says `reason: string` is required, but the implementation accesses `result.reason` without checking if it exists. If a hook returns `{ abort: true }` (missing `reason`), the code will pass `undefined` to `invalidReason`, violating the contract that `invalidReason` should be a string. Similarly, `message` is optional in the type but the code assumes it exists.

---

### 3. Facilitator Fallback Error Messages

**Location:** `verifyPayment()` and `settlePayment()` in `x402ResourceServer.ts`

**Public Promise:** Method signature suggests it will return `VerifyResponse` or `SettleResponse`.

**Implementation Reality:**
```typescript
if (!facilitatorClient) {
  // Fallback: try all facilitators if no specific support found
  let lastError: Error | undefined;

  for (const client of this.facilitatorClients) {
    try {
      verifyResult = await client.verify(paymentPayload, requirements);
      break;
    } catch (error) {
      lastError = error as Error;
    }
  }

  if (!verifyResult!) {
    throw lastError || new Error(
      `No facilitator supports ${requirements.scheme} on ${requirements.network} for v${paymentPayload.x402Version}`
    );
  }
}
```

**Violation:** When no specific facilitator is found, the code tries **all** facilitators and throws `lastError` if all fail. However, `lastError` could be from a **completely different scheme/network** if a facilitator partially supports the request. The error message thrown claims "No facilitator supports X on Y" but the actual error might be "Invalid signature for Z on W" (from a different facilitator that was tried in the fallback loop). The error message doesn't preserve which facilitator actually threw which error.

---

### 4. Extension Enrichment Return Type Handling

**Location:** `createPaymentRequiredResponse()` in `x402ResourceServer.ts`

**Public Promise:** Extensions have `enrichPaymentRequiredResponse` hooks that return `Promise<unknown>`.

**Implementation Reality:**
```typescript
for (const [key, declaration] of Object.entries(extensions)) {
  const extension = this.registeredExtensions.get(key);
  if (extension?.enrichPaymentRequiredResponse) {
    try {
      const extensionData = await extension.enrichPaymentRequiredResponse(
        declaration,
        context,
      );
      if (extensionData !== undefined) {  // Only adds if not undefined
        if (!response.extensions) {
          response.extensions = {};
        }
        response.extensions[key] = extensionData;
      }
    } catch (error) {
      console.error(`Error in enrichPaymentRequiredResponse hook for extension ${key}:`, error);
    }
  }
}
```

**Violation:** Extensions can return three different outcomes with different effects:
1. `undefined` → Extension is **not added** to response (silently skipped)
2. `null` → Extension is **added** as `null` (included in response)
3. Any other value → Extension is **added** with that value

This asymmetry means extensions cannot intentionally signal "don't include this field" vs "include this field with undefined value." An extension returning `undefined` might mean "I have nothing to add" (intentional) or "I encountered an error and want to skip" (the try/catch swallows errors). There's no way to distinguish these cases.

---

## Summary of Findings

### Explicit Promise Violations (3):
1. `x402Version` default behavior misleading in `fromConfig`
2. Extension processing order not fully documented
3. Policy "transform" vs "filter" behavior mismatch

### Stale Descriptive State (3):
1. TODO comment for fallback that's now permanent
2. Binary version assumption (V1 vs V2+) without V3+ planning
3. Constructor leniency vs `initialize()` strictness mismatch

### Asymmetric Documentation Contracts (4):
1. Network type safety not enforced at runtime
2. Hook return types not validated before use
3. Facilitator fallback errors don't preserve context
4. Extension return value semantics (`undefined` vs `null`) ambiguous

  [2mSaved to .deep/findings/x402.md[0m
  [2mSkipping SECURITY — no security signals[0m

[1m[34m── ADVERSARIAL ── x402.txt ── [2msonnet[0m
  [2mModel → sonnet (optimal for prism)[0m
[2mthinking...[0m                                        # ADVERSARIAL ANALYSIS: Breaking the x402 Structural Claims

## WRONG PREDICTIONS

### Claim 1: Facilitator array iteration has silent override bugs
**Analysis Claim**: "Later registrations override earlier ones silently" (x402Facilitator.ts:539)

**What Actually Happens**: The analysis got the iteration order backwards. Looking at lines 539-542:
```typescript
for (const schemeData of schemeDataArray) {
  if (schemeData.facilitator.scheme === paymentRequirements.scheme) {
    if (schemeData.networks.has(paymentRequirements.network)) {
      schemeNetworkFacilitator = schemeData.facilitator;
      break; // FIRST match wins, not last
```

**The Bug**: It's actually **deterministic first-match semantics**, not "silent override". The real bug is there's **no validation that you're not registering duplicate schemes**. You can register the same facilitator twice and waste memory, but lookups will always use the first one. This is a **missing validation bug**, not a silent override.

---

### Claim 2: Client's selectPaymentRequirements uses wrong Map level
**Analysis Claim**: "checks `clientSchemes.has(requirement.scheme)` on the wrong Map level" (x402Client.ts:157-159)

**What Actually Happens**: Let's trace the data structures:

```typescript
// _registerScheme creates:
Map<version, Map<network, Map<scheme, client>>>

// findSchemesByNetwork returns:
Map<network, Map<scheme, client>>

// So clientSchemes IS Map<network, Map<scheme, client>>
// And clientSchemes.has(requirement.scheme) checks the INNER map
```

**The Analysis Error**: `findSchemesByNetwork` returns the inner map after filtering by network. So `clientSchemes` at that point IS `Map<scheme, client>`, and `clientSchemes.has(requirement.scheme)` is **correct**.

**The Real Bug**: The filter at line 408 doesn't check if the scheme is registered for that specific network before calling `findSchemesByNetwork`. It should short-circuit earlier if the network isn't registered at all.

---

### Claim 3: Extension key mismatch causes silent non-invocation
**Analysis Claim**: "If extension registers with key 'eip2612' but server sends 'EIP2612', extension is silently not invoked"

**What Actually Happens**: Looking at line 450:
```typescript
if (key in paymentRequired.extensions && extension.enrichPaymentPayload) {
```

The `in` operator does exact property key matching. But the analysis misses that **`paymentRequired.extensions` is defined by the SERVER** via `createPaymentRequiredResponse`. The client extensions are a MAP of registered handlers.

**The Real Issue**: This is **a protocol contract issue, not a bug**. If the server doesn't declare the extension key, the client shouldn't invoke it. The `enrichPaymentPayload` hook is ONLY for extensions the server declared. The correct behavior is:
- Server declares extensions it wants in PaymentRequired
- Client checks if it registered handlers for those keys
- If no handler registered, server's extension data is just ignored (not an error)

**The Actual Bug**: Line 450 should be `paymentRequired.extensions && key in paymentRequired.extensions` - currently if `paymentRequired.extensions` is undefined, the `in` check throws TypeError.

---

## OVERCLAIMS

### "Structural" Bug Actually Fixable: Facilitator network pattern matching

**Classification**: HIGH severity, structural (analysis claimed unfixable due to "coordination overhead")

**Why It's Fixable**:
```typescript
// Current problematic code (line 555-558):
const patternRegex = new RegExp("^" + schemeData.pattern.replace("*", ".*") + "$");

// Bug: Only replaces FIRST *, so "eip155:*-test" becomes "^eip155:.*-test$" 
// but "solana:*:*" becomes "^solana:.*:*$" which is wrong
```

**The Fix**:
```typescript
private derivePattern(networks: Network[]): Network {
  // Add validation in registration, not just pattern derivation
  for (const network of networks) {
    if (network.includes('*') && network !== '*' && !network.match(/^[^*]+:\*$/)) {
      throw new Error(`Invalid network pattern: ${network}. Only "namespace:*" wildcards supported`);
    }
  }
  // ... rest of derivation
}

// In verify/settle, cache the regex:
private getPatternRegex(schemeData: SchemeData): RegExp {
  if (!schemeData.cachedRegex) {
    const pattern = schemeData.pattern.replace(/\*/g, '.*'); // Replace ALL *
    schemeData.cachedRegex = new RegExp(`^${pattern}$`);
  }
  return schemeData.cachedRegex;
}
```

**Why Analysis Called It Structural**: Claimed it was "coordination overhead between components"

**Reality**: It's a **regex implementation bug** that can be fixed with input validation and proper escaping. Nothing structural about it.

---

### "Conservation Law" That's Actually Implementation Choice

**Claimed Law**: "Partitioned Independence ↔ Coherent Coordination" - you can't have independent deployment AND version coherence

**What's Wrong**: This ignores **semantic versioning as a coordination mechanism**:

```typescript
// Add validation at registration time:
private _registerScheme(x402Version: number, network: Network, client: SchemeNetworkClient): x402Client {
  if (!this.registeredClientSchemes.has(x402Version)) {
    this.registeredClientSchemes.set(x402Version, new Map());
  }
  
  // ADD THIS: Validate version compatibility
  const existingVersions = Array.from(this.registeredClientSchemes.keys());
  for (const existingVersion of existingVersions) {
    if (Math.abs(existingVersion - x402Version) > 1) {
      console.warn(`Registering version ${x402Version} when ${existingVersion} exists. Gap > 1 may cause incompatibility.`);
    }
  }
  // ... rest of registration
}
```

**Alternative Design That Violates the "Law"**: Use **feature flags instead of version numbers**:

```typescript
interface CapabilitySet {
  supportsPaymentV2: boolean;
  supportsExtensions: boolean;
  supportsBigIntAmounts: boolean;
}

register(network: Network, client: SchemeNetworkClient, capabilities: CapabilitySet) {
  // Registration validates capability compatibility
  // No "version" - just what features are supported
}
```

This gives you **independent deployment** (register/unregister anytime) AND **coherent coordination** (capability checks prevent incompatible operations). The "conservation law" is actually **"we chose version numbers as our coordination mechanism, then didn't implement them properly."**

---

## UNDERCLAIMS

### Critical Bug Analysis Missed: Type coercion in version checks

**Location**: x402Client.ts line 380, x402Facilitator.ts throughout

**The Bug**:
```typescript
if (partialPayload.x402Version == 1) {  // Using == not ===
```

**What Breaks**: `x402Version` is typed as `number` but could be `1` (number) or `"1"` (string) depending on source. The `==` coercion means:
- `partialPayload.x402Version = "1"` passes the check
- But `paymentPayload.x402Version = 1` in the wrapped payload
- Version mismatch creates corrupted payloads

**Why Analysis Missed It**: Focused on "version management architecture" not the actual comparison operators

**Severity**: HIGH - creates silent data corruption

---

### Critical Bug Analysis Missed: Unvalidated BigInt comparisons

**Location**: x402ResourceServer.ts line 1089 (in findMatchingRequirements)

**The Bug**:
```typescript
return availableRequirements.find(paymentRequirements =>
  deepEqual(paymentRequirements, paymentPayload.accepted)
);
```

**What Breaks**: `deepEqual` on BigInt values doesn't account for:
- `1000000n` vs `"1000000"` (BigInt vs string representation)
- Different precision from floating point conversion

If v1 payload has amount as string but requirements have BigInt, the match fails even though they're semantically equal.

**Why Analysis Missed It**: Focused on "v1 vs v2 version differences" not the type system mismatch

**Severity**: MEDIUM - causes valid payments to be rejected

---

### Critical Bug Analysis Missed: Race condition in hook execution

**Location**: x402Client.ts lines 336-340, x402Facilitator.ts lines 456-465, x402ResourceServer.ts lines 755-769

**The Bug**:
```typescript
for (const hook of this.beforePaymentCreationHooks) {
  const result = await hook(context);
  if (result && "abort" in result && result.abort) {
    throw new Error(`Payment creation aborted: ${result.reason}`);
  }
}
```

**What Breaks**: If hook 3 throws an unexpected error (not an abort), hooks 1 and 2 have already executed but the operation fails. The system is in an **inconsistent state** (some side effects happened, transaction aborted). Hooks can't clean up because there's no `onError` callback.

**Why Analysis Missed It**: Focused on "extensibility as coordination patch" not the error handling semantics

**Severity**: HIGH - causes data corruption in production (partial state mutations)

---

### Property Analysis Missed: Memory leak in Facilitator registration

**Location**: x402Facilitator.ts lines 246-260

**The Bug**:
```typescript
register(networks: Network | Network[], facilitator: SchemeNetworkFacilitator): x402Facilitator {
  const networksArray = Array.isArray(networks) ? networks : [networks];
  return this._registerScheme(x402Version, networksArray, facilitator);
}

private _registerScheme(
  x402Version: number,
  networks: Network[],
  facilitator: SchemeNetworkFacilitator,
): x402Facilitator {
  if (!this.registeredFacilitatorSchemes.has(x402Version)) {
    this.registeredFacilitatorSchemes.set(x402Version, []);
  }
  const schemeDataArray = this.registeredFacilitatorSchemes.get(x402Version)!;
  
  schemeDataArray.push({
    facilitator,
    networks: new Set(networks),  // Creates NEW Set every time
    pattern: this.derivePattern(networks),
  });
  return this;
}
```

**What Breaks**: Every call to `register()` adds a NEW SchemeData entry, even if registering the same facilitator for the same networks. If you call `register(['eip155:1', 'eip155:137'], facilitator)` then later `register(['eip155:1'], facilitator)`, you now have TWO entries. The `verify` method will search both, wasting memory and CPU.

**Why Analysis Missed It**: Focused on "network pattern matching" not the deduplication issue

**Severity**: MEDIUM - memory leak in long-running processes

---

### Property Analysis Missed: Silent failure in extension enrichment

**Location**: x402Client.ts lines 450-463

**The Bug**:
```typescript
for (const [key, extension] of this.registeredExtensions) {
  if (key in paymentRequired.extensions && extension.enrichPaymentPayload) {
    enriched = await extension.enrichPaymentPayload(enriched, paymentRequired);
  }
}
return enriched;
```

**What Breaks**: If an extension throws an error during `enrichPaymentPayload`, the entire payment creation fails. But there's no **try-catch around individual extension calls**, so one bad extension breaks ALL payments, even ones that don't use that extension.

**Why Analysis Missed It**: Focused on "extension key mismatch" not the error isolation

**Severity**: HIGH - one bad extension DOSes all payments

---

## REVISED BUG TABLE

### All Bugs (Analysis + Corrections)

| Location | What Breaks | Severity | Original Classification | My Classification | Why |
|----------|-------------|----------|------------------------|-------------------|-----|
| **x402Client.ts:380** | Version check uses `==` not `===` - allows string/number coercion | HIGH | Not identified | FIXABLE | Add type validation `typeof x402Version === 'number' && x402Version === 1` |
| **x402Client.ts:450** | Missing null check on `paymentRequired.extensions` before `in` operator | HIGH | Structural (claimed key mismatch) | FIXABLE | Add `paymentRequired.extensions && key in paymentRequired.extensions` |
| **x402Client.ts:336-340** | Hook execution doesn't handle unexpected errors - inconsistent state | HIGH | Not identified | FIXABLE | Wrap each hook in try-catch with rollback mechanism |
| **x402Client.ts:450-463** | Extension enrichment error propagates to all payments | HIGH | Not identified | FIXABLE | Add try-catch per extension, log and continue on error |
| **x402Facilitator.ts:555-558** | Pattern regex only replaces first `*` | HIGH | Structural (unfixable) | FIXABLE | Use `.replace(/\*/g, '.*')` and escape special chars |
| **x402Facilitator.ts:607-611** | Regex reconstructed in loop without caching | LOW | Fixable (correct) | FIXABLE | Cache regex in SchemeData during registration |
| **x402Facilitator.ts:246-260** | Duplicate registration creates multiple SchemeData entries | MEDIUM | Not identified | FIXABLE | Check for existing facilitator+networks combination before pushing |
| **x402Facilitator.ts:539** | Array iteration finds first match (analysis claimed silent override) | LOW | Structural | FIXABLE | Add deduplication validation at registration |
| **x402ResourceServer.ts:735-738** | Empty array returned when no SchemeNetworkServer registered | CRITICAL | Structural (correct) | FIXABLE | Throw error instead of returning `[]` - caller needs to know registration failed |
| **x402ResourceServer.ts:1089** | `deepEqual` on BigInt vs string amounts fails | MEDIUM | Not identified | FIXABLE | Custom comparison that handles BigInt/string conversion |
| **x402ResourceServer.ts:755-769** | Hook execution error handling inconsistency | HIGH | Not identified | FIXABLE | Same fix as client - wrap hooks with error isolation |
| **x402Client.ts:157-159** | Filter doesn't short-circuit early for unregistered networks | MEDIUM | Structural (claimed wrong Map) | FIXABLE | Add network existence check before scheme filtering |
| **x402ResourceServer.ts:847-851** | Extension order affects which extensions get added (race condition) | MEDIUM | Fixable (correct) | FIXABLE | Use temporary Map, then assign at end |
| **x402Client.ts:380-383** | `mergeExtensions` doesn't check for `null` (typeof null === 'object') | LOW | Fixable (correct) | FIXABLE | Add `&& serverValue !== null` check |

### Structural Bugs (Truly Unfixable Without Architecture Change)

| Location | What Breaks | Severity | Why Structural |
|----------|-------------|----------|----------------|
| **Three-way version split** | Client, Facilitator, Server each maintain independent version maps | HIGH | No single authority validates version compatibility across all three components at registration time |
| **Extension key contract** | Server declares extensions, client must match keys exactly | MEDIUM | Contract crosses deployment boundary - no way to validate key compatibility at registration |

**Note**: Even the "structural" bugs are fixable with **coordination protocols** (semantic versioning validation, capability negotiation), but they require **architectural changes**, not just code patches.

---

## FINAL ASSESSMENT

### Analysis Strengths
- Correctly identified versioning as the core complexity
- Good finding on empty `accepts` array causing silent failures
- Identified real issues in pattern matching and extension key handling

### Analysis Weaknesses  
- **Over-classified implementation bugs as "structural"**: Most of the HIGH/MEDIUM bugs are fixable with targeted patches
- **Missed critical type safety issues**: Version coercion, BigInt comparisons, hook error handling
- **Conservation law is false**: Semantic versioning and feature flags provide coordination without sacrificing independence
- **Deduced wrong mechanism**: Claimed "later registrations override" when it's actually "first match wins"
- **Missed memory leaks**: Duplicate facilitator registrations not deduplicated

### Real Conservation Law
**Not** "Partitioned Independence ↔ Coherent Coordination" (too abstract)

**Actually**: **Registration-time validation is conserved** - this codebase has **zero** validation at component registration, so all incompatibilities surface at execution time. Every bug is "I registered X but tried to use Y" because registration never validates that X supports Y.

This is fixable by adding **validation at registration boundaries**, not by restructuring the entire architecture.

  [2mSaved to .deep/findings/x402.md[0m
  [2mProfile: 125 scans, 0 patterns, 5 laws[0m

[1m[34m── SYNTHESIS ── x402.txt ── [2msonnet[0m
  [2mModel → sonnet (optimal for prism)[0m
[2mthinking...[0m                                        # FINAL SYNTHESIS: x402 Protocol Implementation

---

## REFINED CONSERVATION LAW

**Deployment Decoupling ↔ Operational Coherence**

**What both analyses independently discovered:**
- Analysis 1 identified the three-component architecture (Client, Facilitator, Server) with "Partitioned Independence ↔ Coherent Coordination"
- Analysis 2 identified "Static Type Safety × Runtime Composition × Protocol Extensibility = Constant"

**Why the original was incomplete:**
- Analysis 1 correctly located the coordination problem but framed it as a version management issue
- Analysis 2 correctly located the type safety erosion but framed it as a lookup cost issue
- Both miss that these are symptoms of the **same underlying trade-off**: independent deployment vs coherent execution

**The corrected law:**
```
Coordination Overhead = (Independent Components) × (Version/Namespace States) × (Registration Complexity)
```

The x402 protocol chooses **three independently deployable components** (Client, Facilitator, Server). Each must be separately instantiated, registered, and versioned. This structural choice **guarantees**:
1. Runtime type safety erosion (string-keyed lookups, Analysis 2)
2. Version coordination failures (hardcoded checks, Analysis 1)
3. Silent mismatches (registration vs execution topology, both analyses)

You cannot have independently deployable components AND compile-time protocol coherence. The conservation law is not fixable because it's the *design goal*—the code *wants* these components to deploy independently, so it *must* pay the coordination tax.

---

## REFINED META-LAW

**Diagnostic Opacity × Deployment Independence = Constant**

**What both analyses reveal:**
- Analysis 1: "Deployment authority determines architectural possibility" and "Abstraction Migration Law"
- Analysis 2: "Information laundering" where error messages destroy diagnostic context

**The unified meta-law:**
Every layer of deployment decoupling **must** destroy diagnostic information. If Client and Server deploy independently, the Server *cannot* know what the Client registered. When an error occurs, the Server cannot enumerate "what you have vs what you need" because it only knows half the state.

**Specific mechanism:** The `throw new Error(...)` statements throughout both analyses show that diagnostic information is being computed (`Array.from(this.registeredClientSchemes.keys())`) but then **stringified and lost**. This is not an implementation bug—it's **necessary** because the diagnostic state exists in different processes/machines. You cannot preserve structured error state across deployment boundaries without a shared error type system, which would couple the deployments.

**The meta-invariant:** You can push diagnostic opacity into the string layer (current code) or into a type layer (shared error types), but you cannot eliminate it. The more you decouple deployments, the less you can see across them.

---

## STRUCTURAL vs FIXABLE — DEFINITIVE CLASSIFICATION

### Structural Bugs (Unfixable — Conservation Law Predictions)

| Location | Bug | Why Unfixable |
|----------|-----|---------------|
| `x402Facilitator.ts:539` | Array iteration: `schemeData.facilitator.scheme === paymentRequirements.scheme` match allows silent overwrites when same scheme registered multiple times | **Registration topology ≠ execution topology.** The `Map<version, SchemeData[]>` structure allows multiple facilitators per scheme, but lookup uses linear search with first-match. To fix, you'd need a `Map<version, Map<network, Map<scheme, facilitator>>>`, which couples registration order to lookup semantics—breaking independent deployment. |
| `x402Client.ts:450-453` | Extension key mismatch: `"eip2612"` vs `"EIP2612"` causes silent non-invocation | **Key naming crosses deployment boundaries.** Client and Server must agree on extension keys, but they're independently versioned. To fix, you'd need a shared enum package, which couples Client and Server deployments—violating the design goal. |
| `x402ResourceServer.ts:735-738` | Returns empty `accepts: []` when no SchemeNetworkServer registered (silent failure) | **Server doesn't know what Facilitator supports until runtime.** The `initialize()` method tries to fetch capabilities, but if Facilitator is down or incompatible, Server cannot know what's valid. To fix, Server would need Facilitator's type information at compile time—coupling deployments. |
| `x402Facilitator.ts:232-235` | `register(networks[], facilitator)` stores each network separately but derives pattern `eip155:*`. Lookup for `eip155:42161` fails even though pattern should match | **Pattern derivation happens at registration time, lookup at execution time.** The `derivePattern()` function reduces `["eip155:1", "eip155:137"]` to `eip155:*`, but stores networks as a `Set`. Lookup checks `Set.has()` before pattern match. To fix, you'd need to prioritize patterns over concrete networks, but that breaks exact-match semantics. |
| `x402ResourceServer.ts:667-682` | `initialize()`: Earlier facilitators take precedence, silent overwrites of later facilitators | **Facilitator discovery order ≠ facilitator quality.** The code iterates `facilitatorClients` array and only stores if `!responseNetworkMap.has(kind.scheme)`. To fix, you'd need a quality/priority metric, but that requires Facilitators to self-report quality—which creates an incentive mismatch and still requires runtime coordination. |

### Fixable Bugs (Implementation Issues)

| Location | Bug | Fix (1-line) |
|----------|-----|--------------|
| `x402Client.ts:380-383` | `mergeExtensions`: `typeof serverValue === "object"` is true for `null` | `if (serverValue && typeof serverValue === "object" && schemeValue && typeof schemeValue === "object" && serverValue !== null && schemeValue !== null)` |
| `x402ResourceServer.ts:847-851` | `enrichPaymentRequiredResponse`: Mutates `response.extensions` in loop, order-dependent | `const enrichedExtensions: Record<string, unknown> = {};` then merge after loop |
| `x402Facilitator.ts:607-611` | Pattern regex constructed in loop without caching | Add `cachedPattern: RegExp` to `SchemeData` interface, compute once in `_registerScheme()` |
| `x402Client.ts:336-340` | Before hooks execute in loop, no error handling, state inconsistent on throw | Wrap hook execution in `try-catch`, collect errors, abort or continue based on error type |
| `x402ResourceServer.ts:1093-1095` | `findMatchingRequirements` v1 only checks scheme/network, ignores amount | Add `&& req.amount === paymentPayload.accepted.amount` to v1 match condition |

### Disagreements Resolved

**Analysis 1 vs Analysis 2 on `x402Client.selectPaymentRequirements`:**
- Analysis 1: Called it structural ("nested Maps create filter bug")
- Analysis 2: Not explicitly addressed, but information laundering diagnosis applies
- **Resolution:** **Fixable.** The filter logic is correct (`findSchemesByNetwork` returns the correct Map level). The real bug is that the *default selector* (`accepts[0]`) chooses arbitrarily. Fix: Replace default with `accepts.sort((a, b) => BigInt(a.amount) - BigInt(b.amount))[0]` (choose cheapest).

**Analysis 1 vs Analysis 2 on `x402ResourceServer.initialize()` facilitator precedence:**
- Analysis 1: Not explicitly flagged
- Analysis 2: Identified as "Priority Inversion" (earlier facilitators win)
- **Resolution:** **Structural.** The precedence is arbitrary but necessary because there's no quality metric. Adding a priority metric requires Facilitators to self-report, which creates trust issues. The fix would require a coordination protocol between Facilitators—violating independent deployment.

---

## DEEPEST FINDING

**The Protocol Cannot Distinguish Between "Version 1" and "Broken Version 2"**

**What neither analysis alone could see:**
- Analysis 1 identified hardcoded `if (x402Version == 1)` checks as a problem
- Analysis 2 identified runtime lookup erosion and silent failures
- **Combined:** The protocol uses the *same data structures* for both versions, and distinguishes them via **runtime type tags** (`x402Version` field) that are checked ad-hoc throughout the code.

**The property that only emerges from both analyses:**
The protocol pretends to be "versioned" but is actually implementing **two completely different protocols** with incompatible semantics:
- **Version 1:** `accepted` is `{ scheme, network }` (no amount check, Analysis 2 Bug 6)
- **Version 2:** `accepted` is the full `PaymentRequirements` (deep equality check)

These are not the same protocol. They have different verification rules, different extension handling (`partialPayload.x402Version == 1` branches), and different failure modes. The conservation law (deployment decoupling) forces the code to use **runtime branching** instead of **compile-time types**, which guarantees that Version 1 and Version 2 will eventually diverge in ways that cannot be checked statically.

**Why this justifies three passes:**
- Analysis 1 alone sees "bad version handling"
- Analysis 2 alone sees "type safety erosion"
- **Both together reveal:** The versioning system is *not* versioning—it's a **conditional compilation system implemented at runtime**. Every new version multiplies the coordination surface area quadratically (Analysis 1) AND destroys type safety (Analysis 2). This is a **structural inevitability**, not a bug.

The deepest finding is that **the protocol cannot safely evolve**. Every attempt to add Version 3 will:
1. Add new `if (x402Version == 3)` branches throughout (Analysis 1)
2. Add new lookup paths in the nested Maps (Analysis 1)
3. Create new opportunities for silent key mismatches (Analysis 2)
4. Require new facilitator discovery coordination (Analysis 2)

The conservation law **predicts** that Version 3 will be exponentially harder to coordinate than Version 2, which was already harder than Version 1. The code is on a complexity trajectory that will become unmanageable.
[33mConfabulation warning:[0m 0 suspicious API refs, 100 high line numbers. Use --trust or oracle mode for verified output.


  [2mSaved to .deep/findings/x402.md[0m
  [2mProfile: 128 scans, 0 patterns, 5 laws[0m
  [2mSaved to .deep/findings/x402.md[0m
  [2mProfile: 129 scans, 0 patterns, 5 laws[0m

[32mFull Pipeline complete: 9/10 steps, models: sonnet[0m
  [2mUse /fix to pick issues, or /fix auto to fix all[0m
