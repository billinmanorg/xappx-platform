import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CATALOG } from "./catalog";
import { ConceptDetails } from "./ConceptDetails";
import { ConfirmDialog } from "./ConfirmDialog";
import { PreviewPlans } from "./PreviewPlans";
import { DiscoveryFlow, initialDiscoveryStep, type DiscoveryStep } from "./DiscoveryFlow";
import { guidanceFor } from "./guidance";
import { MAX_NOTE_LENGTH, PRIORITIES, PROBLEMS, SCALES } from "./problems";
import { RecommendationList } from "./RecommendationList";
import { recommend } from "./recommendations";
import { restoreDiscovery, toLegacyDiscovery } from "./restore";
import { createPreviewSession, previewReducer } from "./previewSession";
import { WorkingPreview } from "./WorkingPreview";
import type { CatalogSolution, DiscoveryContext, PreviewEvent, PreviewSession, WorkflowId } from "./types";
import { XappyGuide } from "./XappyGuide";
import "./preview.css";

type View = "discovery" | "recommendations" | "refine" | "concept" | "working" | "plans";
type Concept = Extract<CatalogSolution, { buildStatus: "recommended-solution" }>;
type Route = { view: View; step: DiscoveryStep; concept?: Concept; sessionId?: number };
type Confirmation = { type: "reset" } | { type: "switch"; workflow: WorkflowId };
type HistoryEntry = { id: string; route: Route };
function readInitialDiscovery(): ReturnType<typeof restoreDiscovery> {
  try { return restoreDiscovery(window.sessionStorage.getItem("xappx_discovery")); }
  catch { return { ...restoreDiscovery(null), message: "Saved choices are unavailable in this browser. You can still explore every event problem." }; }
}

export function PreviewApp(): JSX.Element {
  const [restored] = useState(readInitialDiscovery);
  const [context, setContext] = useState(restored.context);
  const [route, setRoute] = useState<Route>(() => ({ view: "discovery", step: initialDiscoveryStep(restored.context) }));
  const { view, step, concept } = route;
  const routeRef = useRef(route);
  const routes = useRef<{ entries: HistoryEntry[]; cursor: number }>({ entries: [], cursor: -1 });
  const [batch, setBatch] = useState(1);
  const [reviewSaved, setReviewSaved] = useState(false);
  const [refinement, setRefinement] = useState({ problemId: context.problemId, sourceGoalId: context.goalId, goalId: context.goalId });
  const [session, setSession] = useState<PreviewSession | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const main = useRef<HTMLElement>(null);
  const background = useRef<HTMLDivElement>(null);
  const sessionRef = useRef(session);
  const sessionId = useRef(0);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const confirmationRef = useRef(confirmation);
  const returnFocus = useRef(false);
  const saveSession = (next: PreviewSession | null) => { sessionRef.current = next; setSession(next); };
  const closeConfirmation = () => {
    // Restore interactivity before the dialog's unmount cleanup returns focus.
    background.current?.removeAttribute("inert");
    confirmationRef.current = null; setConfirmation(null);
  };
  const openConfirmation = (next: Confirmation) => {
    if (confirmationRef.current) return;
    confirmationRef.current = next; setConfirmation(next);
  };
  const applyRoute = (next: Route) => {
    closeConfirmation();
    const current = sessionRef.current;
    // Discarded sessions are never reconstructed by history navigation.
    let safe = (next.view === "working" || next.view === "plans") && (!current || next.sessionId !== sessionId.current)
      ? { view: "recommendations" as const, step: next.step } : next;
    // History keeps destinations, while answers remain current. Something else
    // makes an old goal route inapplicable; recover in place without new history.
    if (safe.view === "discovery" && safe.step === "goal" && !context.problemId) safe = { ...safe, step: "problem" };
    if (current) {
      const updated = safe.view === "plans" ? previewReducer(current, { type: "showPlans" }) : previewReducer(current, { type: "returnToPreview" });
      if (updated !== current) saveSession(updated);
    }
    routeRef.current = safe; setRoute({ ...safe });
  };
  const writeHistory = (entry: HistoryEntry, replace: boolean) => {
    try { window.history[replace ? "replaceState" : "pushState"]({ xappxPreview: entry.id }, ""); }
    catch { setSessionNotice("Browser history is unavailable. You can still navigate using the controls on this page."); }
  };
  const navigate = (next: Route, replace = false) => {
    const stack = routes.current;
    const entry = { id: crypto.randomUUID(), route: next };
    if (replace && stack.cursor >= 0) stack.entries[stack.cursor] = entry;
    else { stack.entries = [...stack.entries.slice(0, stack.cursor + 1), entry]; stack.cursor = stack.entries.length - 1; }
    writeHistory(entry, replace); applyRoute(next);
  };
  const setView = (next: View) => navigate({ view: next, step: routeRef.current.step, sessionId: sessionId.current });
  const setStep = (next: DiscoveryStep) => navigate({ view: "discovery", step: next });
  const popHandler = useRef<(event: PopStateEvent) => void>(() => {});
  popHandler.current = (event) => {
    returnFocus.current = false;
    const id: unknown = event.state?.xappxPreview;
    const stack = routes.current;
    const index = typeof id === "string" ? stack.entries.findIndex((entry) => entry.id === id) : -1;
    if (index < 0) {
      // Reload starts a new memory-only history. Old/foreign positions cannot revive it.
      navigate({ view: "discovery", step: initialDiscoveryStep(context) }, true);
      return;
    }
    stack.cursor = index; applyRoute(stack.entries[index]!.route);
  };
  useEffect(() => {
    const entry = { id: crypto.randomUUID(), route: routeRef.current };
    routes.current = { entries: [entry], cursor: 0 };
    writeHistory(entry, true);
    const onPop = (event: PopStateEvent) => popHandler.current(event);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // A mount has one history boundary, just as it has one guarded discovery read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useLayoutEffect(() => {
    if (!confirmation) return;
    const element = background.current;
    element?.setAttribute("inert", "");
    return () => element?.removeAttribute("inert");
  }, [confirmation]);
  const dispatch = (event: PreviewEvent) => {
    const current = sessionRef.current;
    if (!current) return;
    const next = previewReducer(current, event); saveSession(next);
    if (event.type === "showPlans" && next.gate === "plans" && routeRef.current.view !== "plans") setView("plans");
  };
  const createSession = (workflow: WorkflowId) => {
    sessionId.current += 1;
    saveSession(createPreviewSession(workflow, toLegacyDiscovery(context)));
  };
  const requestReset = () => openConfirmation({ type: "reset" });
  const launchWorkflow = (workflow: WorkflowId) => {
    if (sessionRef.current && sessionRef.current.workflow !== workflow) { openConfirmation({ type: "switch", workflow }); return; }
    if (!sessionRef.current) createSession(workflow);
    setSessionNotice(null); setView("working");
  };
  const confirmReplacement = () => {
    const pending = confirmationRef.current;
    if (!pending || !sessionRef.current) return;
    closeConfirmation();
    createSession(pending.type === "reset" ? sessionRef.current.workflow : pending.workflow);
    setSessionNotice(pending.type === "reset" ? "Sample reset. Your records and guided progress have restarted. Discovery choices and notes are kept." : "Working preview changed. A fresh sample session is ready; discovery choices and notes are kept.");
    navigate({ view: "working", step: routeRef.current.step, sessionId: sessionId.current }, routeRef.current.view === "working");
  };
  const selectSolution = (solution: CatalogSolution) => {
    if (solution.buildStatus === "working-preview") launchWorkflow(solution.workflowId);
    else navigate({ view: "concept", step, concept: solution });
  };
  useEffect(() => {
    const target = returnFocus.current ? main.current?.querySelector<HTMLElement>("[data-plans-trigger]") : null;
    (target ?? main.current?.querySelector<HTMLElement>("[data-current-view] h1"))?.focus();
    returnFocus.current = false;
  }, [route]);
  const problem = PROBLEMS.find((item) => item.id === context.problemId);
  const goal = problem?.goals.find((item) => item.id === context.goalId);
  const items = recommend(context, CATALOG);
  const hasLegacy = !!context.legacy.industry || !!context.legacy.challenge || context.legacy.outcomes.length > 0 || context.legacy.stakeholders.length > 0;
  const updateContext = (next: DiscoveryContext) => {
    // A real problem/goal transition supersedes a pending draft immediately, even
    // when later discovery changes return to the same original value.
    if (next.problemId !== context.problemId || next.goalId !== context.goalId) {
      setRefinement({ problemId: next.problemId, sourceGoalId: next.goalId, goalId: next.goalId });
    }
    if (next.problemId !== context.problemId || next.goalId !== context.goalId || next.scale !== context.scale || next.priority !== context.priority) setBatch(1);
    setContext(next);
  };
  const refine = () => {
    // Retain edits during ordinary Back navigation, but a new discovery goal supersedes
    // drafts created for the old goal, including drafts the user never changed.
    if (refinement.problemId !== context.problemId || refinement.sourceGoalId !== context.goalId) {
      setRefinement({ problemId: context.problemId, sourceGoalId: context.goalId, goalId: context.goalId });
    }
    setView("refine");
  };
  const applyRefinement = () => {
    updateContext({ ...context, goalId: refinement.goalId });
    // Applying the draft commits a new baseline, so it is no longer a pending edit.
    setRefinement({ ...refinement, sourceGoalId: refinement.goalId });
    setView("recommendations");
  };
  const chooseProblem = () => navigate({ view: "discovery", step: "problem" });
  const browseProblem = () => {
    updateContext({ ...context, goalId: null });
    setRefinement({ problemId: context.problemId, sourceGoalId: null, goalId: null });
    // This heading survives the in-place recovery; the triggering button does not.
    main.current?.querySelector<HTMLElement>("#recommendations-title")?.focus();
  };
  return <div className="preview-app">
    <div className="preview-background" ref={background} aria-hidden={confirmation ? true : undefined}>
    <a className="skip-link" href="#preview-content" onClick={(event) => {
      // Move keyboard focus without adding an unmanaged fragment-history entry.
      event.preventDefault(); main.current?.focus();
    }}>Skip to main content</a>
    <header className="preview-header">
      <div className="header-inner">
        <span className="wordmark" aria-label="XAPPX">XAPP<span>X</span></span>
        <span className="header-context">Events &amp; Conferences</span>
        <span className="preview-label">Sample data · Preview</span>
      </div>
    </header>
    <div className="preview-shell">
      <nav className="journey-progress" aria-label="Preview journey">
        <ol>{["Choose", "Explore", "Try", "Unlock"].map((label, index) => {
          const current = view === "discovery" ? 0 : view === "plans" ? 3 : view === "working" ? 2 : 1;
          const active = index === current;
          return <li key={label} aria-current={active ? "step" : undefined} className={active ? "current" : index < current ? "visited" : ""}>
            <span className="progress-number" aria-hidden="true">{index + 1}</span><span>{label}</span>
          </li>;
        })}</ol>
        <p>From a challenge to a possibility.</p>
      </nav>
      <main id="preview-content" className="preview-main" ref={main} tabIndex={-1}>
        {restored.message ? <section className="restore-notice" aria-label="Saved discovery notice"><p>{restored.message}</p></section> : null}
        {hasLegacy ? <div className="saved-context">
          <button className="button button-quiet" type="button" aria-expanded={reviewSaved} aria-controls="saved-discovery" onClick={() => setReviewSaved(!reviewSaved)}>Review saved context</button>
          {reviewSaved ? <div id="saved-discovery" className="saved-context-details"><h2>Original saved context</h2>
            <p>Your original context is retained for review. New choices apply only to this preview.</p>
            <dl>
              {context.legacy.industry ? <><dt>Industry</dt><dd>{context.legacy.industry.label}</dd></> : null}
              {context.legacy.challenge ? <><dt>Challenge</dt><dd>{context.legacy.challenge}</dd></> : null}
              {context.legacy.outcomes.length ? <><dt>Outcomes</dt><dd>{context.legacy.outcomes.join(" · ")}</dd></> : null}
              {context.legacy.stakeholders.length ? <><dt>People</dt><dd>{context.legacy.stakeholders.join(" · ")}</dd></> : null}
            </dl>
          </div> : null}
        </div> : null}
        {sessionNotice ? <p className="session-notice" role="status" aria-label="Session notice">{sessionNotice}</p> : null}
        <div hidden={view !== "discovery"} data-current-view={view === "discovery" ? "" : undefined}>
          <DiscoveryFlow context={context} onChange={updateContext} onExplore={() => setView("recommendations")} step={step} onStepChange={setStep} />
        </div>
        {view === "recommendations" ? <section data-current-view="" aria-labelledby="recommendations-title">
          <button className="button button-quiet back-link" type="button" onClick={() => setView("discovery")}>Back to choices</button>
          <div className="question-row">
            <div className="question-copy"><h1 id="recommendations-title" tabIndex={-1}>Explore your possibilities</h1>
              <p className="question-description">A starting point for {problem ? problem.label.toLowerCase() : "your event needs"}. Explore the fit before choosing a direction.</p>
            </div>
            <XappyGuide text={guidanceFor(context, "recommendations")} />
          </div>
          <div className="recommendation-intro"><h2>Curated recommendations</h2><p>Ordered by your choices. Ideas and sample workflows are labeled separately.</p></div>
          <ul className="context-chips" aria-label="Your choices">
            {[problem?.label, goal?.label, SCALES.find((choice) => choice.id === context.scale)?.label, PRIORITIES.find((choice) => choice.id === context.priority)?.label]
              .filter(Boolean).map((label) => <li key={label}>{label}</li>)}
          </ul>
          {context.note || context.uncoveredNeed ? <section className="retained-notes" aria-label="Retained needs">
            <h2>Your notes, kept in this session</h2>
            {context.note ? <p>{context.note}</p> : null}
            {context.uncoveredNeed ? <p>{context.uncoveredNeed}</p> : null}
            <p className="small-note">Don't include personal or confidential information. Notes don't override your choices or generate catalog entries.</p>
          </section> : null}
          <RecommendationList items={items} batch={batch} onMore={() => setBatch((current) => current + 1)} onNoneFit={refine} onSelect={selectSolution} />
          {items.length === 0 ? <div className="broader-browsing">
            {problem ? <button className="button button-secondary" type="button" onClick={browseProblem}>Browse this problem</button> : null}
            <button className="button button-quiet" type="button" onClick={chooseProblem}>Browse all event problems</button>
          </div> : null}
        </section> : null}
        {view === "refine" ? <section data-current-view="" aria-labelledby="refine-title">
          <button className="button button-quiet back-link" type="button" onClick={() => setView("recommendations")}>Back to recommendations</button>
          <div className="question-row">
            <div className="question-copy"><h1 id="refine-title" tabIndex={-1}>What would fit better?</h1><p className="question-description">Try a different goal, or keep track of what our catalog is missing.</p></div>
            <XappyGuide text={guidanceFor(context, "refine")} />
          </div>
          <div className="choice-panel">
            {problem ? <fieldset className="choice-grid chip-grid"><legend>Choose a goal for {problem.label.toLowerCase()}</legend>
              {problem.goals.map((choice) => <button className="choice" type="button" key={choice.id} aria-pressed={refinement.goalId === choice.id} onClick={() => setRefinement({ ...refinement, goalId: choice.id })}>
                <span className="choice-title">{choice.label}</span><span aria-hidden="true" className="choice-check">{refinement.goalId === choice.id ? "✓" : "+"}</span>
              </button>)}
            </fieldset> : <p>Choose an event problem to explore catalog options, or keep your unmet need below.</p>}
            <div className="optional-note">
              <label htmlFor="uncovered-need">What is still missing? (optional)</label>
              <p id="uncovered-help">You can leave this blank. Don't include personal or confidential information. This note stays in memory for this session only.</p>
              <textarea id="uncovered-need" rows={3} maxLength={MAX_NOTE_LENGTH} aria-describedby="uncovered-help uncovered-count" value={context.uncoveredNeed}
                onChange={(event) => setContext({ ...context, uncoveredNeed: event.target.value.slice(0, MAX_NOTE_LENGTH) })} />
              <span id="uncovered-count" className="character-count">{context.uncoveredNeed.length} / {MAX_NOTE_LENGTH} characters</span>
            </div>
            <div className="flow-footer"><button className="button button-secondary" type="button" onClick={chooseProblem}>Choose another problem</button>
              <button className="button button-primary" type="button" onClick={applyRefinement}>Update suggestions</button>
            </div>
          </div>
        </section> : null}
        {session ? <div hidden={view !== "working" || session.gate === "plans"} data-current-view={view === "working" && session.gate !== "plans" ? "" : undefined}>
          <WorkingPreview key={sessionId.current} session={session} dispatch={dispatch} onBack={() => setView("recommendations")} onReset={requestReset} onChangeWorkflow={launchWorkflow} />
        </div> : null}
        {view === "plans" ? <div data-current-view=""><PreviewPlans onBack={() => { returnFocus.current = true; navigate({ view: "working", step, sessionId: sessionId.current }, true); }} /></div> : null}
        {view === "concept" && concept ? <div data-current-view=""><ConceptDetails solution={concept} onBack={() => setView("recommendations")} /></div> : null}
      </main>
      <footer className="preview-footer"><p><span className="disconnected-dot" aria-hidden="true" />Vault: Not connected</p><p>Live Xappy chat is not connected in this preview.</p></footer>
    </div>
    </div>
    {confirmation ? <ConfirmDialog title={confirmation.type === "reset" ? "Reset this sample?" : "Change working preview?"}
      description={confirmation.type === "reset"
        ? "This will discard the current sample records and guided progress. Your discovery choices and notes will be kept."
        : `This will discard the ${session?.spec.name} sample records and guided progress and start ${CATALOG.find((item) => item.buildStatus === "working-preview" && item.workflowId === confirmation.workflow)?.title}. Your discovery choices and notes will be kept.`}
      onConfirm={confirmReplacement} onCancel={closeConfirmation} /> : null}
  </div>;
}
