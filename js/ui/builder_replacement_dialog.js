(() => {
  "use strict";

  const MODULE_ID =
    "1.21.87-scanner-demand-no-deadline";

  if (
    window.RMLBuilderReplacementDialog
      ?.moduleId === MODULE_ID
  ) {
    return;
  }

  function create(dependencies = {}) {
    const elements = dependencies.elements;
    const setAlwaysClickableButtonAvailability =
      dependencies
        .setAlwaysClickableButtonAvailability;
    const clearBuilderWorkDeadline =
      dependencies.clearBuilderWorkDeadline;
    const updateBuilderWork =
      dependencies.updateBuilderWork;
    const paintBuilderUi =
      dependencies.paintBuilderUi;
    const getActiveBuilderWorkSession =
      dependencies.getActiveBuilderWorkSession;
    const BUILDER_REPLACEMENT_RENDER_LIMIT =
      Math.max(
        1,
        Number(dependencies.renderLimit) ||
          200
      );
    let activeBuilderReplacementPrompt = 0;

    function resetBuilderReplacementUi() {
      activeBuilderReplacementPrompt += 1;
    
      if (elements.builderWorkReplacement) {
        elements.builderWorkReplacement.hidden =
          true;
      }
      if (elements.builderWorkReplacementSearch) {
        elements.builderWorkReplacementSearch.value =
          "";
        elements.builderWorkReplacementSearch.oninput =
          null;
        elements.builderWorkReplacementSearch.onsearch =
          null;
      }
      if (elements.builderWorkReplacementList) {
        elements.builderWorkReplacementList
          .replaceChildren();
        elements.builderWorkReplacementList.onclick =
          null;
        elements.builderWorkReplacementList.ondblclick =
          null;
        elements.builderWorkReplacementList.onkeydown =
          null;
      }
      if (elements.builderWorkReplacementQueue) {
        elements.builderWorkReplacementQueue
          .replaceChildren();
      }
      if (elements.builderWorkReplacementSummary) {
        elements.builderWorkReplacementSummary.textContent =
          "";
      }
      if (elements.builderWorkReplacementCancel) {
        elements.builderWorkReplacementCancel.onclick =
          null;
        elements.builderWorkReplacementCancel.onpointerdown =
          null;
        elements.builderWorkReplacementCancel.onkeydown =
          null;
        elements.builderWorkReplacementCancel.onblur =
          null;
      }
      if (elements.builderWorkReplacementSkip) {
        elements.builderWorkReplacementSkip.onclick =
          null;
    
        elements.builderWorkReplacementSkip.textContent =
          window.RMLI18n.t("{{i18n:js.presentation.6fc09607aee5}}");
    
        elements.builderWorkReplacementSkip.hidden =
          false;
      }
      if (elements.builderWorkReplacementConfirm) {
        elements.builderWorkReplacementConfirm.onclick =
          null;
        elements.builderWorkReplacementConfirm.textContent =
          window.RMLI18n.t("{{i18n:js.presentation.b648584a4eb8}}");
        setAlwaysClickableButtonAvailability(
          elements.builderWorkReplacementConfirm,
          true
        );
      }
      if (elements.builderWorkOverlay) {
        delete elements.builderWorkOverlay.dataset.mode;
        elements.builderWorkOverlay.setAttribute(
          "role",
          "status"
        );
        elements.builderWorkOverlay.setAttribute(
          "aria-live",
          "polite"
        );
        elements.builderWorkOverlay.setAttribute(
          "aria-atomic",
          "true"
        );
        elements.builderWorkOverlay.removeAttribute(
          "aria-modal"
        );
      }
    }
    
    function assertReplacementDialogActuallyVisible(
      { operatorId = "", index = -1, total = 0, candidateCount = 0 } = {}
    ) {
      const dialog = elements.builderWorkReplacement;
      const confirm = elements.builderWorkReplacementConfirm;
      const cancel = elements.builderWorkReplacementCancel;
      const skip = elements.builderWorkReplacementSkip;
      const style = dialog ? window.getComputedStyle(dialog) : null;
      const rect = dialog?.getBoundingClientRect?.();
      const visible = Boolean(
        dialog &&
        dialog.isConnected &&
        dialog.hidden !== true &&
        style &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity || "1") > 0 &&
        rect &&
        rect.width > 0 &&
        rect.height > 0
      );
    
      if (!dialog || !confirm || !cancel || !skip) {
        throw new Error(
          `[HARD REPLACEMENT UI ERROR] Replacement ${Number(index) + 1} of ${Number(total)} for '${String(operatorId || "<unknown>")}' cannot be shown because required replacement-panel controls are missing. dialog=${Boolean(dialog)}, confirm=${Boolean(confirm)}, cancel=${Boolean(cancel)}, skip=${Boolean(skip)}, candidates=${Number(candidateCount) || 0}.`
        );
      }
    
      if (!visible) {
        throw new Error(
          `[HARD REPLACEMENT UI ERROR] Replacement ${Number(index) + 1} of ${Number(total)} for '${String(operatorId || "<unknown>")}' was requested but the replacement panel is not visibly rendered. hidden=${String(dialog.hidden)}, display=${String(style?.display)}, visibility=${String(style?.visibility)}, opacity=${String(style?.opacity)}, rect=${Number(rect?.width || 0)}x${Number(rect?.height || 0)}, candidates=${Number(candidateCount) || 0}.`
        );
      }
      return true;
    }
    
    async function requestBuilderReplacementChoice(
      workSession,
      {
        requirement,
        candidates,
        index = 0,
        total = 1,
        catalogResult = null,
        nodeLabels = [],
        replacementQueue = [],
        initialOperatorId = "",
        validationDiagnostics = [],
        progressMapper = null
      } = {}
    ) {
      if (
        workSession !==
          getActiveBuilderWorkSession() ||
        !elements.builderWorkReplacement ||
        !elements.builderWorkReplacementSearch ||
        !elements.builderWorkReplacementList ||
        !elements.builderWorkReplacementConfirm ||
        !elements.builderWorkReplacementCancel
      ) {
        throw new Error(
          window.RMLI18n.t("ui.literal.77d04046b037")
        );
      }
    
      const values =
        Array.isArray(candidates)
          ? candidates.filter(candidate =>
              Boolean(
                String(
                  candidate?.operatorId || ""
                ).trim()
              )
            )
          : [];
    
      clearBuilderWorkDeadline(
        workSession
      );
    
      const prompt =
        ++activeBuilderReplacementPrompt;
      const search =
        elements.builderWorkReplacementSearch;
      const list =
        elements.builderWorkReplacementList;
      const confirm =
        elements.builderWorkReplacementConfirm;
      const cancel =
        elements.builderWorkReplacementCancel;
      const skip =
        elements.builderWorkReplacementSkip;
      const summary =
        elements.builderWorkReplacementSummary;
      const queueHost =
        elements.builderWorkReplacementQueue;
      const operatorId = String(
        requirement?.operatorId ||
        "<unknown>"
      );
      const visibleLabels =
        [...new Set(
          (Array.isArray(nodeLabels)
            ? nodeLabels
            : [])
            .map(label =>
              String(label || "").trim()
            )
            .filter(Boolean)
        )];
      const nodeDescription =
        visibleLabels.length > 0
          ? visibleLabels.slice(0, 3).join(", ")
          : operatorId;
      const sourceDescription =
        catalogResult?.live === true
          ? window.RMLI18n.t("ui.literal.e9adce3048e9")
          : window.RMLI18n.t("ui.literal.dc0419d30ba4");
      const previousPlanDiagnostics =
        (Array.isArray(validationDiagnostics)
          ? validationDiagnostics
          : [])
          .map(value =>
            String(value || "").trim()
          )
          .filter(Boolean);
    
      updateBuilderWork(
        workSession,
        {
          kicker:
            window.RMLI18n.format("import.replacement.kicker", {
              current: Math.min(index + 1, total).toLocaleString(window.RMLI18n?.language || undefined),
              total: Math.max(1, total).toLocaleString(window.RMLI18n?.language || undefined)
            }),
          title:
            window.RMLI18n.t("ui.auto.1b35e808e3fe"),
          message:
            previousPlanDiagnostics.length > 0
              ? window.RMLI18n.format("import.replacement.invalid_plan_message", { node: nodeDescription })
              : window.RMLI18n.format("import.replacement.choose_message", {
                  node: nodeDescription,
                  source: sourceDescription
                }),
          detail:
            previousPlanDiagnostics.length > 0
              ? window.RMLI18n.format("import.replacement.invalid_plan_detail", {
                  diagnostics: previousPlanDiagnostics.slice(0, 3).join(" | "),
                  more: previousPlanDiagnostics.length > 3
                    ? window.RMLI18n.format("import.replacement.more", {
                        count: (previousPlanDiagnostics.length - 3).toLocaleString(window.RMLI18n?.language || undefined)
                      })
                    : ""
                })
              : window.RMLI18n.format(
                  values.length === 1
                    ? "import.replacement.candidates_detail.one"
                    : "import.replacement.candidates_detail.other",
                  {
                    count: values.length.toLocaleString(window.RMLI18n?.language || undefined),
                    operatorId
                  }
                ),
          progress:
            typeof progressMapper === "function"
              ? progressMapper(
                  50 +
                  Math.round(
                    4 *
                    Math.min(index, total) /
                    Math.max(1, total)
                  )
                )
              : 50 +
                Math.round(
                  4 *
                  Math.min(index, total) /
                  Math.max(1, total)
                )
        }
      );
    
      elements.builderWorkOverlay.dataset.mode =
        "replacement";
      elements.builderWorkOverlay.setAttribute(
        "role",
        "dialog"
      );
      elements.builderWorkOverlay.setAttribute(
        "aria-modal",
        "true"
      );
      elements.builderWorkOverlay.setAttribute(
        "aria-live",
        "off"
      );
      elements.builderWorkOverlay.setAttribute(
        "aria-atomic",
        "false"
      );
      elements.builderWorkReplacement.hidden =
        false;
      search.value = "";
      let selectedOperatorId =
        values.some(candidate =>
          candidate.operatorId ===
            String(initialOperatorId || "")
        )
          ? String(initialOperatorId)
          : "";
      let visibleCandidates = [];
    
      const renderReplacementQueue = () => {
        if (!queueHost) {
          return;
        }
        const fragment =
          document.createDocumentFragment();
        for (const entry of
          Array.isArray(replacementQueue)
            ? replacementQueue
            : []) {
          const status = String(
            entry?.status || "pending"
          );
          const row =
            document.createElement("div");
          row.className =
            "builder-work-replacement-queue-item";
          row.dataset.status = status;
          row.setAttribute("role", "listitem");
    
          const state =
            document.createElement("span");
          state.className =
            "builder-work-replacement-queue-state";
          state.textContent =
            status === "selected"
              ? ""
              : status === "skipped"
                ? "!"
                : status === "current"
                  ? "›"
                  : status === "unavailable"
                    ? "!"
                    : "·";
          if (status === "selected") {
            state.innerHTML = `<svg class="rml-inline-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="assets/rml-icons.svg?v=1.21.87-scanner-demand-no-deadline#icon-check"></use></svg>`;
          }
          const name =
            document.createElement("span");
          name.className =
            "builder-work-replacement-queue-name";
          name.textContent = String(
            entry?.operatorId || "<unknown>"
          );
          const count =
            document.createElement("span");
          count.className =
            "builder-work-replacement-queue-count";
          const instances = Math.max(
            1,
            Number(entry?.instanceCount) || 0
          );
          count.textContent =
            `${instances.toLocaleString(window.RMLI18n?.language || undefined)}×`;
          row.append(state, name, count);
          fragment.appendChild(row);
        }
        queueHost.replaceChildren(fragment);
        queueHost
          .querySelector(
            '[data-status="current"]'
          )
          ?.scrollIntoView({
            block: "nearest"
          });
      };
    
      const updateReplacementSummary = () => {
        if (!summary) {
          return;
        }
        const selected =
          values.find(candidate =>
            candidate.operatorId ===
              selectedOperatorId
          );
        const missingInputs =
          Array.isArray(
            selected?.unmappedRequiredInputs
          )
            ? selected.unmappedRequiredInputs
            : [];
        const disconnectedPorts = [
          ...(selected
            ?.unmappedReferencedInputs || [])
            .map(portId =>
              window.RMLI18n.format(
                "import.replacement.port.input",
                { port: String(portId) }
              )
            ),
          ...(selected
            ?.unmappedReferencedOutputs || [])
            .map(portId =>
              window.RMLI18n.format(
                "import.replacement.port.output",
                { port: String(portId) }
              )
            )
        ];
        const matchCount =
          visibleCandidates.length;
        const base =
          window.RMLI18n.format(
            matchCount === 1
              ? "import.replacement.summary.base.one"
              : "import.replacement.summary.base.other",
            {
              count: matchCount.toLocaleString(window.RMLI18n?.language || undefined),
              source: sourceDescription
            }
          );
        if (!selected) {
          confirm.textContent =
            window.RMLI18n.t("{{i18n:js.presentation.b648584a4eb8}}");
          summary.textContent = base;
          return;
        }
        confirm.textContent =
          disconnectedPorts.length > 0
            ? window.RMLI18n.t("ui.literal.89ae72606ade")
            : window.RMLI18n.t("js.presentation.b648584a4eb8");
        if (disconnectedPorts.length > 0) {
          summary.textContent =
            window.RMLI18n.format(
              "import.replacement.summary.disconnected",
              {
                base,
                ports: disconnectedPorts.join(", "),
                required:
                  missingInputs.length > 0
                    ? window.RMLI18n.format(
                        missingInputs.length === 1
                          ? "import.replacement.summary.disconnected_required.one"
                          : "import.replacement.summary.disconnected_required.other",
                        {
                          count: missingInputs.length.toLocaleString(window.RMLI18n?.language || undefined),
                          ports: missingInputs.map(port => port.label || port.id).join(", ")
                        }
                      )
                    : ""
              }
            );
          return;
        }
        if (missingInputs.length > 0) {
          summary.textContent =
            window.RMLI18n.format(
              missingInputs.length === 1
                ? "import.replacement.summary.required_inputs.one"
                : "import.replacement.summary.required_inputs.other",
              {
                base,
                count: missingInputs.length.toLocaleString(window.RMLI18n?.language || undefined),
                ports: missingInputs.map(port => port.label || port.id).join(", ")
              }
            );
          return;
        }
        summary.textContent =
          window.RMLI18n.format(
            selected.semanticProof ===
              "exact-contract"
              ? "import.replacement.summary.exact_contract"
              : selected.semanticProof ===
                  "exact-name"
                ? "import.replacement.summary.exact_name"
                : "import.replacement.summary.manual",
            { base }
          );
      };
    
      const selectCandidate = (
        operatorId,
        {
          focus = false,
          scroll = false
        } = {}
      ) => {
        const selected =
          visibleCandidates.find(candidate =>
            candidate.operatorId ===
              operatorId
          );
        selectedOperatorId =
          selected?.operatorId || "";
    
        for (const item of
          list.querySelectorAll(
            ".builder-work-replacement-item"
          )) {
          const active =
            item.dataset.operatorId ===
              selectedOperatorId;
          item.setAttribute(
            "aria-selected",
            String(active)
          );
          item.tabIndex = active
            ? 0
            : -1;
    
          if (active && focus) {
            item.focus({
              preventScroll: true
            });
          }
          if (active && scroll) {
            item.scrollIntoView({
              block: "nearest"
            });
          }
        }
    
        setAlwaysClickableButtonAvailability(
          confirm,
          Boolean(selectedOperatorId),
          window.RMLI18n.t("ui.literal.ce96387763e5")
        );
        updateReplacementSummary();
      };
    
      const renderCandidates = () => {
        const query = String(
          search.value || ""
        ).trim().toLocaleLowerCase();
        const previous =
          selectedOperatorId;
        const matches = query
          ? values.filter(candidate =>
              `${candidate.title || ""} ${candidate.operatorId} ${candidate.group || ""} ${candidate.description || ""}`
                .toLocaleLowerCase()
                .includes(query)
            )
          : values;
        visibleCandidates = matches.slice(
          0,
          BUILDER_REPLACEMENT_RENDER_LIMIT
        );
        const fragment =
          document.createDocumentFragment();
    
        for (const candidate of
          visibleCandidates) {
          const item =
            document.createElement("button");
          item.type = "button";
          item.className =
            "builder-work-replacement-item";
          item.dataset.operatorId =
            candidate.operatorId;
          item.setAttribute(
            "role",
            "option"
          );
          item.setAttribute(
            "aria-selected",
            "false"
          );
    
          const symbol =
            document.createElement("span");
          symbol.className =
            "builder-work-replacement-symbol";
          const paletteIcon =
            candidate.paletteIcon &&
            typeof candidate.paletteIcon ===
              "object"
              ? candidate.paletteIcon
              : {
                  symbol:
                    candidate.symbol ||
                    "API",
                  color: "#8fdcff",
                  tone: "standard"
                };
          symbol.textContent = String(
            paletteIcon.symbol ||
            candidate.symbol ||
            "API"
          );
          symbol.dataset.iconTone = String(
            paletteIcon.tone ||
            "standard"
          );
          symbol.dataset.rmlNodeIconColor =
            String(
              paletteIcon.color ||
              "#8fdcff"
            );
    
          const copy =
            document.createElement("span");
          copy.className =
            "builder-work-replacement-copy";
          const title =
            document.createElement("strong");
          title.textContent =
            candidate.title ||
            candidate.operatorId;
          const group =
            document.createElement("small");
          group.textContent =
            `${candidate.group || window.RMLI18n.t("ui.literal.924e20a624e5")} · ${candidate.operatorId}`;
          const match =
            document.createElement("small");
          match.className =
            "builder-work-replacement-match";
          const missingInputs =
            Array.isArray(
              candidate.unmappedRequiredInputs
            )
              ? candidate
                  .unmappedRequiredInputs
              : [];
          const disconnectedPortCount =
            (
              candidate
                .unmappedReferencedInputs || []
            ).length +
            (
              candidate
                .unmappedReferencedOutputs || []
            ).length;
          match.dataset.warning = String(
            missingInputs.length > 0 ||
            disconnectedPortCount > 0
          );
          match.textContent =
            disconnectedPortCount > 0
              ? `Same operation kind · warning: ${disconnectedPortCount} old used endpoint${disconnectedPortCount === 1 ? "" : "s"} will be disconnected`
              : candidate.semanticProof ===
                  "exact-contract"
                ? window.RMLI18n.t("ui.literal.5c4d324a9ea4")
                : candidate.semanticProof ===
                    "exact-name"
                  ? window.RMLI18n.t("ui.literal.c8ae9a3d5405")
                  : missingInputs.length > 0
                    ? `Same operation kind · ${missingInputs.length} new input${missingInputs.length === 1 ? "" : "s"} to configure`
                    : window.RMLI18n.t("ui.literal.882073eb8847");
          copy.append(
            title,
            group,
            match
          );
          item.append(
            symbol,
            copy
          );
          item.title =
            `${candidate.title || candidate.operatorId}\n${candidate.group || window.RMLI18n.t("ui.literal.924e20a624e5")}\n${candidate.operatorId}\n${match.textContent}`;
          fragment.appendChild(item);
        }
    
        if (visibleCandidates.length === 0) {
          const empty =
            document.createElement("div");
          empty.className =
            "builder-work-replacement-empty";
          empty.textContent =
            window.RMLI18n.t("{{i18n:js.presentation.ef10da90616f}}");
          fragment.appendChild(empty);
        }
    
        list.setAttribute(
          "aria-busy",
          "true"
        );
        list.replaceChildren(fragment);
        list.setAttribute(
          "aria-busy",
          "false"
        );
        if (
          previous &&
          visibleCandidates.some(candidate =>
            candidate.operatorId === previous
          )
        ) {
          selectedOperatorId = previous;
        } else {
          selectedOperatorId = "";
        }
    
        selectCandidate(
          selectedOperatorId
        );
        if (
          matches.length >
            visibleCandidates.length
        ) {
          summary.textContent =
            `${matches.length.toLocaleString(window.RMLI18n?.language || undefined)} matches · showing the first ${visibleCandidates.length.toLocaleString(window.RMLI18n?.language || undefined)}. Refine the search to reach later entries.`;
        } else {
          updateReplacementSummary();
        }
      };
    
      let choiceSettled = false;
      const choice = new Promise(
        (resolve, reject) => {
          let settled = false;
          let cancelPointerArmed = false;
          let cancelKeyboardArmed = false;
          const finish = (
            callback,
            value
          ) => {
            if (
              settled ||
              prompt !==
                activeBuilderReplacementPrompt
            ) {
              return;
            }
            settled = true;
            choiceSettled = true;
            document.removeEventListener(
              "keydown",
              onKeyDown,
              true
            );
            resetBuilderReplacementUi();
            callback(value);
          };
          const accept = () => {
            const selected =
              values.find(candidate =>
                candidate.operatorId ===
                  selectedOperatorId
              );
            if (selected) {
              finish(resolve, selected);
            }
          };
          const skipReplacement = () => {
            finish(
              resolve,
              Object.freeze({
                skipped: true,
                operatorId
              })
            );
          };
          const rejectImport = source => {
            const error = new Error(
              `Project import was cancelled by the ${source} before the required API replacement was confirmed. The JSON was not loaded.`
            );
            error.code =
              "RML_PROJECT_IMPORT_CANCELLED";
            error.cancelSource = source;
            finish(
              reject,
              error
            );
          };
          const onKeyDown = event => {
            if (event.key === window.RMLI18n.t("ui.literal.b4cfe1f435f0")) {
              event.preventDefault();
              event.stopImmediatePropagation();
              rejectImport(window.RMLI18n.t("ui.literal.b42472fcdcdb"));
            }
          };
    
          search.oninput =
            renderCandidates;
          search.onsearch =
            renderCandidates;
          list.onclick = event => {
            const item =
              event.target.closest(
                ".builder-work-replacement-item"
              );
            if (item) {
              selectCandidate(
                item.dataset.operatorId,
                { focus: true }
              );
            }
          };
          list.ondblclick = event => {
            if (
              event.target.closest(
                ".builder-work-replacement-item"
              )
            ) {
              accept();
            }
          };
          list.onkeydown = event => {
            if (
              ![
                window.RMLI18n.t("ui.literal.14a67093e73a"),
                window.RMLI18n.t("ui.literal.e710c17948e9"),
                window.RMLI18n.t("ui.literal.70f8bb9a8a53"),
                window.RMLI18n.t("ui.literal.a2bb9d34b8a1")
              ].includes(event.key) ||
              visibleCandidates.length === 0
            ) {
              return;
            }
            event.preventDefault();
            const currentIndex =
              visibleCandidates.findIndex(
                candidate =>
                  candidate.operatorId ===
                    selectedOperatorId
              );
            const nextIndex =
              event.key === window.RMLI18n.t("ui.literal.70f8bb9a8a53")
                ? 0
                : event.key === window.RMLI18n.t("ui.literal.a2bb9d34b8a1")
                  ? visibleCandidates.length - 1
                  : event.key === window.RMLI18n.t("ui.literal.14a67093e73a")
                    ? currentIndex < 0
                      ? 0
                      : Math.min(
                          visibleCandidates.length - 1,
                          currentIndex + 1
                        )
                    : currentIndex < 0
                      ? visibleCandidates.length - 1
                      : Math.max(
                          0,
                          currentIndex - 1
                        );
            selectCandidate(
              visibleCandidates[nextIndex]
                .operatorId,
              {
                focus: true,
                scroll: true
              }
            );
          };
          confirm.onclick = accept;
          if (skip) {
            skip.onclick = skipReplacement;
          }
          cancel.onpointerdown = event => {
            cancelPointerArmed =
              event.isPrimary !== false &&
              Number(event.button) === 0;
          };
          cancel.onkeydown = event => {
            cancelKeyboardArmed =
              event.key === window.RMLI18n.t("ui.literal.2b9eceb7a86a") ||
              event.key === " ";
          };
          cancel.onblur = () => {
            cancelPointerArmed = false;
            cancelKeyboardArmed = false;
          };
          cancel.onclick = event => {
            const explicitlyActivated =
              cancelPointerArmed ||
              cancelKeyboardArmed ||
              (
                event.isTrusted === true &&
                document.activeElement ===
                  cancel
              );
            cancelPointerArmed = false;
            cancelKeyboardArmed = false;
    
            if (!explicitlyActivated) {
              updateBuilderWork(
                workSession,
                {
                  detail:
                    window.RMLI18n.t("ui.literal.0200e0e0b92e")
                }
              );
              return;
            }
    
            rejectImport(
              "explicit Cancel import button"
            );
          };
          document.addEventListener(
            "keydown",
            onKeyDown,
            true
          );
        }
      );
    
      renderReplacementQueue();
      renderCandidates();
      await paintBuilderUi();
    
      await new Promise(resolve =>
        window.requestAnimationFrame(() =>
          window.requestAnimationFrame(resolve)
        )
      );
    
      if (!choiceSettled) {
        assertReplacementDialogActuallyVisible({
          operatorId,
          index,
          total,
          candidateCount: values.length
        });
    
        search.focus({
          preventScroll: true
        });
      }
      return choice;
    }
    
    
    return Object.freeze({
      reset: resetBuilderReplacementUi,
      requestChoice:
        requestBuilderReplacementChoice
    });
  }

  Object.defineProperty(
    window,
    "RMLBuilderReplacementDialog",
    {
      value: Object.freeze({
        version: 1,
        moduleId: MODULE_ID,
        create
      }),
      writable: false,
      enumerable: true,
      configurable: true
    }
  );
})();
