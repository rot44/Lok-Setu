# Adaptive Civic Assistant & Mission Steering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Lok-Setu Civic Assistant from rigidly rejecting general questions into a warm, conversational civic guide that dynamically answers greetings and proactively steers unaligned conversations toward welfare schemes, eligibility, and notice analysis.

**Architecture:** Augment `civicAnalysis.service.js` with conversational intent detection and a dedicated Gemini Civic Steering pipeline. When zero catalog documents match, conversational or unaligned turns bypass the zero-evidence rejection, receive an intelligent, culturally warm response in the citizen's language, and ask subsequent guiding questions with `insufficientEvidence: false`.

**Tech Stack:** Node.js (v20+), Express, Google Gemini API (`@google/genai`), Sarvam AI Voice, Vitest/Node test runner.

**Spec:** `docs/superpowers/specs/2026-11-01-adaptive-civic-assistant-steering-design.md`

## Global Constraints

- Supported languages: 8 Indic languages (`en`, `hi`, `gu`, `mr`, `bn`, `ta`, `te`, `kn`).
- Grounded RAG integrity: Queries requesting specific policy/legal facts that have zero catalog evidence must continue returning `insufficientEvidence: true`.
- Zero warning banner on conversational turns: `insufficientEvidence` must be `false` and `citations` empty (`[]`) for conversational queries.
- Clean text for speech: Response must be natural text without unreadable markdown blocks so Sarvam TTS reads it smoothly.
- Backwards compatibility: Existing sessions and database schemas remain unaffected.

## Review Focus

1. Query `"how are you"` in English: Returns a polite greeting, introduces Lok-Setu, asks a steering question, and has `insufficientEvidence: false`.
2. Query `"नमस्ते"` or `"kya haal hai"` in Hindi: Returns a Hindi response steering to welfare schemes/notices with `insufficientEvidence: false`.
3. Non-existent policy query `"How to claim solar subsidy on Mars?"`: Retains `insufficientEvidence: true` with `EXACT_MISSING_INFO_SENTENCE`.
4. Blended query `"Hello! Who is eligible for PM-Kisan?"`: Retrieves PM-Kisan evidence chunks, answers with verified citations, and retains grounding.
5. Gemini service error during conversational steering: Falls back gracefully to localized warm greeting rather than crashing or throwing 500 error.

---

### Task 1: Conversational Intent Detection & Steering Instructions

**Files:**
- Modify: `Lok Setu/backend/src/services/civicAnalysis.service.js:15-180`
- Test: `Lok Setu/backend/test/civic-analysis.test.js:60-120`

**Interfaces:**
- Produces: `isConversationalOrGeneralQuery(query: string) -> boolean`
- Produces: `CIVIC_STEERING_SYSTEM_INSTRUCTION: string`
- Produces: `buildCivicSteeringPrompt({ query: string, language: string, conversationHistory: Array }) -> string`

- [ ] **Step 1: Write the failing test for conversational intent detection**
Add test in `Lok Setu/backend/test/civic-analysis.test.js`:
```javascript
await t.test("isConversationalOrGeneralQuery identifies greetings, pleasantries, and open-ended conversation", () => {
    assert.equal(isConversationalOrGeneralQuery("hi"), true);
    assert.equal(isConversationalOrGeneralQuery("hello"), true);
    assert.equal(isConversationalOrGeneralQuery("how are you"), true);
    assert.equal(isConversationalOrGeneralQuery("namaste"), true);
    assert.equal(isConversationalOrGeneralQuery("नमस्ते"), true);
    assert.equal(isConversationalOrGeneralQuery("who are you"), true);
    assert.equal(isConversationalOrGeneralQuery("what can you do?"), true);
    assert.equal(isConversationalOrGeneralQuery("What is the interest subsidy under PM SVANidhi?"), false);
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd "Lok Setu/backend" && node --test test/civic-analysis.test.js`
Expected: FAIL with "isConversationalOrGeneralQuery is not defined"

- [ ] **Step 3: Implement `isConversationalOrGeneralQuery` and steering prompts in `civicAnalysis.service.js`**
Define regex and keyword heuristics covering English and Indic romanized/vernacular greetings and identity questions. Define `CIVIC_STEERING_SYSTEM_INSTRUCTION` instructing Gemini to welcome the user, introduce Lok-Setu's purpose, and ask guiding questions to discover welfare schemes or clarify official notices.

- [ ] **Step 4: Run test to verify it passes**
Run: `cd "Lok Setu/backend" && node --test test/civic-analysis.test.js`
Expected: PASS

- [ ] **Step 5: Commit changes**
```bash
git add "Lok Setu/backend/src/services/civicAnalysis.service.js" "Lok Setu/backend/test/civic-analysis.test.js"
git commit -m "feat: add conversational intent detection and civic steering instructions"
```

---

### Task 2: Adaptive Civic Analysis Pipeline Integration

**Files:**
- Modify: `Lok Setu/backend/src/services/civicAnalysis.service.js:400-470`
- Test: `Lok Setu/backend/test/civic-analysis.test.js:155-220`

**Interfaces:**
- Modifies: `analyzeCivicQuery(query, options) -> Promise<CivicAnalysisResult>`
- When `evidenceList.length === 0`:
  - If `isConversationalOrGeneralQuery(validQuery)` is true:
    - Calls Gemini with `CIVIC_STEERING_SYSTEM_INSTRUCTION` and `buildCivicSteeringPrompt`.
    - Returns structured output with `insufficientEvidence: false` and `citations: []`.
  - Else:
    - Returns `buildInsufficientEvidenceResponse(validLanguage)` with `insufficientEvidence: true`.

- [ ] **Step 1: Write the failing tests for adaptive conversational flow in `civic-analysis.test.js`**
Add tests:
```javascript
await t.test("analyzeCivicQuery routes conversational query 'how are you' to dynamic steering with insufficientEvidence: false", async () => {
    let steeringCalled = false;
    const mockGemini = async ({ systemInstruction, prompt }) => {
        steeringCalled = true;
        assert.ok(systemInstruction.includes("Mission Steering"));
        return {
            answer: "Hello! I am doing well, thank you. I am your Lok-Setu civic guide. How can I help you today? Are you looking for welfare schemes in healthcare, farming, or pensions, or do you have an official notice to analyze?",
            summary: "Greeting response with civic guidance.",
            sourceFacts: [],
            interpretation: "Lok-Setu provides assistance with Indian government schemes and notice analysis.",
            limitations: [],
            referencedChunkIds: [],
            insufficientEvidence: false,
        };
    };
    const mockRetriever = async () => [];

    const result = await analyzeCivicQuery("how are you", {
        retrievalService: mockRetriever,
        geminiGenerator: mockGemini,
        language: "en",
    });

    assert.equal(steeringCalled, true);
    assert.equal(result.insufficientEvidence, false);
    assert.ok(result.answer.includes("Lok-Setu"));
    assert.deepEqual(result.citations, []);
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd "Lok Setu/backend" && node --test test/civic-analysis.test.js`
Expected: FAIL because conversational queries currently trigger `buildInsufficientEvidenceResponse` directly.

- [ ] **Step 3: Implement adaptive branch in `analyzeCivicQuery`**
In `backend/src/services/civicAnalysis.service.js`:
- In the zero-evidence block (`if (!evidenceList || evidenceList.length === 0)`), check if `isConversationalOrGeneralQuery(validQuery)`.
- If true, dispatch to `generatorFn` with `CIVIC_STEERING_SYSTEM_INSTRUCTION` and structured steering response schema, setting `insufficientEvidence: false`. Include robust localized fallbacks if generator fails.
- If false, call `buildInsufficientEvidenceResponse(validLanguage)`.

- [ ] **Step 4: Run test to verify it passes**
Run: `cd "Lok Setu/backend" && node --test test/civic-analysis.test.js`
Expected: PASS

- [ ] **Step 5: Commit changes**
```bash
git add "Lok Setu/backend/src/services/civicAnalysis.service.js" "Lok Setu/backend/test/civic-analysis.test.js"
git commit -m "feat: integrate adaptive mission steering into analyzeCivicQuery"
```

---

### Task 3: Full Assistant Controller & End-to-End Verification

**Files:**
- Test: `Lok Setu/backend/test/assistant.test.js`
- Test: Browser UI at `http://localhost:5173/assistant`

**Interfaces:**
- Consumes: `POST /api/v1/assistant/chat` with `{ query: "how are you", language: "en" }`
- Expects: HTTP 200, `data.analysis.insufficientEvidence === false`, no error banner, audio synthesizable.

- [ ] **Step 1: Write integration test in `assistant.test.js` for conversational turns**
Test that `POST /api/v1/assistant/chat` with `"how are you"` returns a response with `insufficientEvidence: false` and can produce synthesizable audio.

- [ ] **Step 2: Run backend assistant tests**
Run: `cd "Lok Setu/backend" && node --test test/assistant.test.js`
Expected: PASS

- [ ] **Step 3: Run all backend tests**
Run: `cd "Lok Setu/backend" && npm test`
Expected: All tests pass with 0 failures.

- [ ] **Step 4: Run frontend tests**
Run: `cd "Lok Setu/frontend" && npm test`
Expected: All tests pass with 0 failures.

- [ ] **Step 5: Browser verification on live UI**
Verify on `http://localhost:5173/assistant`:
1. Submit `"how are you"`.
2. Confirm the assistant replies warmly and asks what scheme or notice to explore.
3. Confirm NO yellow missing-evidence warning box appears.
4. Click "Listen to Explanation" (Sarvam Voice) and verify speech synthesis plays.

- [ ] **Step 6: Commit all verification and final changes**
```bash
git add -A
git commit -m "feat: complete conversational flexibility and mission steering for Civic Assistant"
```

