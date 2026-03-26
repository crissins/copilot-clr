# Problem Statement

## 1. Challenge Category

**Category:** Cognitive Accessibility — AI Assistant for Neurodiverse Users

## 2. Problem Description

**Who is affected:** Approximately 15–20% of the global population is neurodiverse — including individuals with ADHD, autism, and dyslexia. These users regularly encounter cognitive overload when navigating complex task instructions, dense documents, scheduling tools, and conversational UIs that are not designed for their needs.

**What is the pain point:** Neurodiverse individuals spend significantly more time and energy processing unstructured information than neurotypical peers. Dense instructions cause task paralysis. Unformatted documents are inaccessible without assistive tools. Standard AI assistants produce responses that are verbose, unpredictable in structure, and sometimes anxiety-inducing in tone.

**Why it matters now:** Accessibility in digital tools is increasingly a regulatory, HR, and ethical priority. Workplace and educational neurodiversity has gained broad recognition, yet mainstream AI assistants lack purpose-built accessibility modes. The tools already exist across Azure — they have not been assembled into a focused, adaptive experience.

## 3. Quantified Impact (Before)

| Metric | Current State | Source |
|--------|--------------|--------|
| Time to parse a complex multi-step instruction | ~8–15 min (research-cited) | Cognitive load studies, ADHD literature |
| Document reading comprehension rate (dyslexia) | 40–60% without assistive tools | British Dyslexia Association |
| Task completion rate under cognitive overload | ~55% | Journal of Attention Disorders |
| Availability of AI tools with integrated neurodiverse accessibility | Near zero in general-purpose AI assistants | Market gap |

## 4. Proposed Solution (High Level)

_To be completed during planning phase._

## 5. Quantified Impact (After)

_To be completed during planning phase with measured benchmarks._

## 6. Success Criteria

1. [ ] User can submit a complex paragraph and receive a numbered, time-boxed task list in < 5 seconds
2. [ ] Document simplification produces output at the user's selected reading level (verified by FKGL score)
3. [ ] Immersive Reader launches successfully for any agent response
4. [ ] Speech-to-text input and text-to-speech output operate without manual transcription
5. [ ] Harmful or anxiety-inducing language is blocked by Content Safety before reaching the user
6. [ ] Accessibility preferences persist across sessions and are applied automatically
7. [ ] All 16 Azure services are actively used (not just provisioned)

## 7. Out of Scope

- Mobile native app (web-only for v1)
- Full WCAG 2.1 AA certification audit (accessibility-first design, not certified audit)
- Production SLA (hackathon prototype)
- Multi-tenant enterprise deployment
