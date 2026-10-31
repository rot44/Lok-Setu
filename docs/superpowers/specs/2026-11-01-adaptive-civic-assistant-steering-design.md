# Design Document: Adaptive Civic Assistant & Mission Steering

**Date:** 2026-11-01  
**Topic:** Adaptive Conversational Flow & Mission Steering for Lok-Setu Civic Assistant  
**Status:** Pending Approval  

---

## 1. Intent and Why
Currently, Lok-Setu's Civic Assistant enforces a zero-evidence fast-path rejection in `backend/src/services/civicAnalysis.service.js`. When a citizen submits a casual greeting (e.g., *"hi"*, *"how are you"*, *"namaste"*), a pleasantry, or a general conversational question, the vector/text retrieval against the scheme catalog returns zero document chunks. The system immediately outputs:
> *"The knowledge base does not currently contain verified official documents to answer this query. This document does not clearly specify this information."*

and presents a prominent yellow warning box. 

For real citizens—many using regional languages or voice input—this makes the assistant feel broken and inaccessible. The assistant must be flexible and welcoming: answering general pleasantries naturally in the user's chosen language, and then proactively guiding the conversation back to Lok-Setu's mission by asking targeted follow-up questions about welfare schemes, rights, or official notices.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **Warm & Intelligent Interaction:** Greet the citizen and address general questions with cultural empathy in their preferred language (English, Hindi, Gujarati, Marathi, Bengali, Tamil, Telugu, Kannada).
- **Proactive Mission Steering:** Every unaligned or conversational turn must smoothly pivot back to Lok-Setu's core civic capabilities (welfare discovery, eligibility, rights, official notice analysis) and ask subsequent steering questions to help the citizen take action.
- **Clean UI Presentation:** For conversational and steering turns, `insufficientEvidence` is set to `false`, eliminating the yellow warning box and red error banners.
- **Voice Synthesis Compatibility:** Output remains clean and concise so that Sarvam AI Indic voice synthesis reads it naturally.
- **Preserved RAG Grounding:** Factual questions about specific government schemes and citizen rights remain 100% strictly grounded in verified gazettes and policies with citations.

### Non-Goals
- Becoming an unconstrained general-purpose chatbot (e.g., writing essays or engaging in unrelated trivia indefinitely).
- Allowing hallucinated policy facts when an actual policy query lacks catalog evidence.

### Anti-Goals
- Breaking existing test suites in backend (`assistant.test.js`, `civic-analysis.test.js`) or frontend.
- Hardcoding static, robotic responses that feel like phone-tree IVR menus.

---

## 3. Constraints
- **Supported Languages:** 8 Indic languages (`en`, `hi`, `gu`, `mr`, `bn`, `ta`, `te`, `kn`).
- **Performance:** Response latency should remain low, leveraging Gemini 2.5 Flash / Flash Lite as configured.
- **Architecture:** Fits cleanly within `analyzeCivicQuery` in `civicAnalysis.service.js` and `handleAssistantChat` in `assistant.controller.js`.

---

## 4. Approaches Considered

### Approach 1: Unified Adaptive Civic Engine (Selected)
- **Description:** When the retrieval returns zero evidence chunks or when intent is conversational/exploratory, instead of immediately returning `buildInsufficientEvidenceResponse`, the query is passed to Gemini with a dedicated **Civic Concierge & Mission Steering Instruction**.
- **Behavior:**
  - If the query is conversational/unaligned: Gemini acknowledges the greeting/question politely, introduces Lok-Setu's civic focus, and asks 1-2 practical follow-up questions (e.g., *"Are you looking for health coverage under Ayushman Bharat, farmer support under PM-Kisan, loan subsidies, or do you have an official notice you need explained?"*).
  - Sets `insufficientEvidence: false` and `citations: []`.
  - If the query is a factual policy inquiry that genuinely lacks catalog evidence, the model explains that the specific scheme is not yet in the official database and directs the citizen to official government portals.
- **Tradeoffs:** Single cohesive pipeline, seamless handling of blended queries (e.g., *"Hello, how are you? What is PM SVANidhi?"*), and no extra classification latency.

### Approach 2: Two-Stage Intent Classifier
- **Description:** An explicit classifier routes queries upfront to either a conversational bot or a grounded policy engine.
- **Tradeoffs:** Adds classification overhead, requires duplicate pipeline logic, and struggles when queries mix greetings with policy questions.

### Decision
The user chose **Approach 1** for its seamless integration, dynamic flexibility, and reliable mission steering.

---

## 5. Technical Specification & Implementation Plan

### 5.1 Backend Changes (`civicAnalysis.service.js`)
1. **Query Intent Distinction:**
   - Detect conversational / greeting patterns (e.g., `hi`, `hello`, `how are you`, `who are you`, `namaste`, `kem cho`, `vanakkam`, etc.) or general open-ended exploratory queries.
2. **Dynamic Mission Steering Prompt:**
   - When `evidenceList.length === 0`:
     - If the query is conversational or exploratory, invoke Gemini with `CIVIC_STEERING_INSTRUCTION`.
     - Instruct Gemini to:
       1. Warmly respond to the user's conversational turn in their selected language.
       2. Bridge to Lok-Setu's purpose: helping citizens understand government schemes, subsidies, and official circulars/notices.
       3. Ask engaging follow-up questions to understand the citizen's profile (e.g., farmer, student, senior citizen, artisan, vendor) or whether they have an order/notice to clarify.
     - Return structured output with `insufficientEvidence: false`, `citations: []`, and actionable suggestions.
3. **Specific Policy Fallback:**
   - If the query asks for specific legal/policy facts that genuinely have zero evidence in the database (e.g., "What is clause 4 of Scheme XYZ not in catalog?"), adhere to the grounded disclaimer without hallucination.

### 5.2 Voice Synthesis (`assistant.controller.js`)
- Ensure the steering answer is cleaned and passed to Sarvam TTS cache cleanly so citizens using voice hear the warm, guiding response immediately.

### 5.3 Verification
- Run backend test suite (`npm test` in `backend`).
- Add tests in `test/civic-analysis.test.js` and `test/assistant.test.js` validating conversational queries ("how are you", "namaste", "hi") return warm steering responses with `insufficientEvidence: false`.
- End-to-end verification in browser.

