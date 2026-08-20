(() => {
  "use strict";

  Object.defineProperty(window, "RMLSetupTemplateMarkup", {
    value: `<!-- Lazy-loaded by setup_assistant.js. -->
<div id="rml-setup-assistant" hidden aria-live="polite">
  <div class="rml-setup-interaction-shield" data-setup-interaction-shield aria-hidden="true"></div>
  <div class="rml-setup-shade" data-setup-shade="top"></div>
  <div class="rml-setup-shade" data-setup-shade="left"></div>
  <div class="rml-setup-shade" data-setup-shade="right"></div>
  <div class="rml-setup-shade" data-setup-shade="bottom"></div>

  <div class="rml-setup-demo-keys" data-setup-demo-keys hidden aria-hidden="true"></div>
  <div class="rml-setup-drag-ghost" data-setup-drag-ghost hidden aria-hidden="true"></div>
  <div class="rml-setup-demo-label" data-setup-demo-label hidden aria-hidden="true"></div>
  <div class="rml-setup-demo-mouse" data-setup-mouse aria-hidden="true">
    <svg viewBox="0 0 46 62">
      <path class="rml-setup-mouse-body" d="M23 2C12.5 2 5 10.3 5 21v18c0 11.2 7.4 20 18 20s18-8.8 18-20V21C41 10.3 33.5 2 23 2Z"></path>
      <path class="rml-setup-mouse-split" d="M23 3v22"></path>
      <rect data-setup-mouse-wheel x="20" y="9" width="6" height="12" rx="3"></rect>
    </svg>
    <span class="rml-setup-mouse-ripple"></span>
  </div>

  <div class="rml-setup-live-controls" data-setup-live-controls hidden>
    <button class="button secondary" type="button" data-setup-live-skip-demo>Skip demonstration</button>
    <button class="button secondary" type="button" data-setup-live-skip-tour>Skip tour</button>
  </div>

  <section class="rml-setup-card" role="dialog" aria-modal="true" aria-labelledby="rml-setup-title">
    <small data-setup-kicker>Interactive guided tour</small>
    <h2 id="rml-setup-title" data-setup-title>Welcome</h2>
    <p data-setup-text></p>
    <span class="rml-setup-step-badge" data-setup-hint></span>
    <div class="rml-setup-viewport-warning" data-setup-viewport-warning hidden role="status" aria-live="polite"></div>
    <div class="rml-setup-progress"><span data-setup-progress></span></div>
    <div class="rml-setup-actions">
      <button class="button secondary" type="button" data-setup-skip>Skip tour</button>
      <div>
        <button class="button secondary" type="button" data-setup-repeat-previous hidden title="Run the previous demonstration again without repeating its explanation">Repeat previous step</button>
        <button class="button secondary" type="button" data-setup-skip-demo hidden title="Skip only this demonstration">Skip</button>
        <button class="button primary" type="button" data-setup-next>Next</button>
      </div>
    </div>
  </section>
</div>
`,
    writable: false,
    enumerable: false,
    configurable: true
  });
})();
