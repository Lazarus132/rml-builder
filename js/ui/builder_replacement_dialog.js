(() => {
  "use strict";

  const MODULE_ID =
    "1.24.90-reliable-folder-direct-dll-build";

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

    function replacementShortTypeName(value) {
      const text = String(value || "").trim().replace(/^global::/, "");
      if (!text) return "";
      const generic = text.indexOf("<");
      const base = generic >= 0 ? text.slice(0, generic) : text;
      const suffix = generic >= 0 ? text.slice(generic) : "";
      const short = base.split(/[.+]/).filter(Boolean).pop() || base;
      return `${short}${suffix}`;
    }

    function replacementContractKindLabel(kind) {
      const keys = {
        type: "import.replacement.contract.kind.type",
        enum: "import.replacement.contract.kind.enum",
        method: "import.replacement.contract.kind.method",
        constructor: "import.replacement.contract.kind.constructor",
        "property-get": "import.replacement.contract.kind.property_get",
        "property-set": "import.replacement.contract.kind.property_set",
        "field-get": "import.replacement.contract.kind.field_get",
        "field-set": "import.replacement.contract.kind.field_set",
        event: "import.replacement.contract.kind.event",
        "hook-method": "import.replacement.contract.kind.hook_method"
      };
      return window.RMLI18n.t(
        keys[String(kind || "").trim()] ||
          "import.replacement.contract.kind.api"
      );
    }

    function replacementLooksLikeInternalId(value) {
      const text = String(value || "").trim();
      if (!text) return false;
      return (
        /^(?:api(?:\.[a-z0-9_-]+)+\.[a-f0-9]{8,}|contract(?:\.[a-z0-9_-]+)*\.[a-f0-9]{8,}|unavailable\.preserved\.[A-Za-z0-9_.:-]+|(?:apiEnum[.:]|api:|normal(?:Exact|Array):|collectList:)[A-Za-z0-9_.:<>,\[\]-]+)$/.test(text) ||
        /^(?:graph-node|wire|boundary)-[A-Za-z0-9_.:-]+$/.test(text) ||
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(text)
      );
    }

    function replacementVisibleText(value, fallback = "") {
      const text = String(value || "").trim();
      return text && !replacementLooksLikeInternalId(text)
        ? text
        : String(fallback || "").trim();
    }

    function replacementGenericPortLabel(direction, index) {
      return window.RMLI18n.format(
        direction === "output"
          ? "import.replacement.port.output_generic"
          : "import.replacement.port.input_generic",
        {
          index: (Math.max(0, Number(index) || 0) + 1)
            .toLocaleString(window.RMLI18n?.language || undefined)
        }
      );
    }

    function replacementPortDisplayName(
      portValue,
      contract,
      direction,
      index = 0
    ) {
      const portId = String(
        portValue && typeof portValue === "object"
          ? portValue.id || ""
          : portValue || ""
      ).trim();
      const ports = Array.isArray(
        contract?.[direction === "output" ? "outputPorts" : "inputPorts"]
      )
        ? contract[direction === "output" ? "outputPorts" : "inputPorts"]
        : [];
      const descriptor =
        portValue && typeof portValue === "object"
          ? portValue
          : ports.find(port => String(port?.id || "") === portId) || null;
      const descriptorId = String(descriptor?.id || portId).trim();
      const explicitLabel = [
        descriptor?.label,
        descriptor?.displayName,
        descriptor?.parameterName,
        descriptor?.name
      ]
        .map(value => replacementVisibleText(value))
        .find(value =>
          value &&
          value.toLocaleLowerCase() !== descriptorId.toLocaleLowerCase()
        );
      if (explicitLabel) return explicitLabel;

      if (direction !== "output") {
        const parameterPosition = Number(
          descriptor?.parameterPosition ??
          descriptor?.parameterIndex
        );
        const parameters = Array.isArray(contract?.parameters)
          ? contract.parameters
          : [];
        const parameter = Number.isFinite(parameterPosition)
          ? parameters.find(value =>
              Number(value?.position) === parameterPosition
            ) || parameters[parameterPosition]
          : null;
        const parameterName = replacementVisibleText(parameter?.name);
        if (parameterName && !/^arg\d+$/i.test(parameterName)) {
          return parameterName;
        }
      }

      return replacementGenericPortLabel(direction, index);
    }

    function replacementSanitizeDiagnostic(value, replacements = []) {
      let text = String(value || "").trim();
      if (!text) return "";
      for (const replacement of replacements) {
        const internal = String(replacement?.internal || "").trim();
        if (!internal) continue;
        const visible = replacementVisibleText(
          replacement?.visible,
          window.RMLI18n.t("import.replacement.api.unavailable")
        );
        text = text.split(internal).join(visible);
      }
      text = text
        .replace(
          /\b(?:api(?:\.[a-z0-9_-]+)+\.[a-f0-9]{8,}|contract(?:\.[a-z0-9_-]+)*\.[a-f0-9]{8,}|unavailable\.preserved\.[A-Za-z0-9_.:-]+)\b/g,
          window.RMLI18n.t("import.replacement.api.unavailable")
        )
        .replace(
          /(?:apiEnum[.:]|api:|normal(?:Exact|Array):|collectList:)[A-Za-z0-9_.:<>,\[\]-]+/g,
          window.RMLI18n.t("graph.type.unavailable")
        )
        .replace(
          /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\b/g,
          window.RMLI18n.t("import.replacement.api.unavailable")
        )
        .replace(
          /(\b(?:input|output)\s+port)\s+([\u0022\u0027])([^\u0022\u0027]+)\2/gi,
          (match, prefix, quote, identifier) =>
            replacementLooksLikeInternalId(identifier)
              ? prefix
              : match
        )
        .replace(
          /(\b(?:node|wire|boundary))\s+([\u0022\u0027])([^\u0022\u0027]+)\2/gi,
          (match, prefix, quote, identifier) =>
            replacementLooksLikeInternalId(identifier)
              ? prefix
              : match
        );
      return text;
    }

    function replacementContractDisplay(contract, operatorId = "") {
      const value = contract && typeof contract === "object" && !Array.isArray(contract)
        ? contract
        : null;
      if (!value) {
        return {
          primary: window.RMLI18n.t("import.replacement.api.unavailable"),
          secondary: window.RMLI18n.t("import.replacement.contract.unavailable"),
          technical: window.RMLI18n.t("import.replacement.contract.unavailable")
        };
      }

      const kind = String(value.kind || "").trim();
      const kindLabel = replacementContractKindLabel(kind);
      const owner = replacementVisibleText(value.ownerType || value.declaringType);
      const member = replacementVisibleText(value.memberName);
      const signature = replacementVisibleText(value.signature);
      const returnType = replacementVisibleText(value.returnType);
      const shortOwner = replacementShortTypeName(owner);
      const isType = kind === "type" || kind === "enum";
      const primary = isType
        ? (shortOwner || member || window.RMLI18n.t("import.replacement.api.unavailable"))
        : (shortOwner && member
            ? `${shortOwner}.${member}`
            : member || shortOwner || window.RMLI18n.t("import.replacement.api.unavailable"));
      const semanticTarget = isType
        ? owner
        : (owner && member ? `${owner}.${member}` : owner || member);
      const secondaryParts = [kindLabel];
      if (semanticTarget) secondaryParts.push(semanticTarget);
      if (signature && !secondaryParts.some(part => part.includes(signature))) {
        secondaryParts.push(signature);
      } else if (returnType && !isType) {
        secondaryParts.push(`→ ${returnType}`);
      }

      const parameters = (Array.isArray(value.parameters) ? value.parameters : [])
        .map((parameter, index) => {
          const storedName = replacementVisibleText(parameter?.name);
          const name = storedName && !/^arg\d+$/i.test(storedName)
            ? storedName
            : replacementGenericPortLabel("input", index);
          const storedType = String(
            parameter?.elementType || parameter?.type || ""
          ).trim();
          const displayedType = replacementLooksLikeInternalId(storedType)
            ? window.RMLModNodeRegistry?.displayType?.(
                storedType,
                { qualified: true }
              )
            : storedType;
          const type = replacementVisibleText(
            displayedType,
            window.RMLI18n.t("graph.type.unavailable")
          );
          const modifier = parameter?.isOut === true
            ? "out "
            : parameter?.isByRef === true
              ? "ref "
              : parameter?.isIn === true
                ? "in "
                : "";
          return `${modifier}${type} ${name}`.trim();
        });
      const bindings = Object.entries(
        value.genericBindings && typeof value.genericBindings === "object" && !Array.isArray(value.genericBindings)
          ? value.genericBindings
          : {}
      ).map(([name, type]) => {
        const storedType = String(type || "").trim();
        const displayedType = replacementLooksLikeInternalId(storedType)
          ? window.RMLModNodeRegistry?.displayType?.(
              storedType,
              { qualified: true }
            )
          : storedType;
        return `${replacementVisibleText(name, "T")}=${replacementVisibleText(
          displayedType,
          window.RMLI18n.t("graph.type.unavailable")
        )}`;
      });
      const portType = port => {
        const csType = String(
          port?.csType || ""
        ).trim();
        if (csType && !replacementLooksLikeInternalId(csType)) return csType;
        const displayed = String(
          window.RMLModNodeRegistry
            ?.displayType?.(
              csType || port?.type,
              { qualified: true }
            ) ||
          window.RMLI18n.t(
            "graph.type.unavailable"
          )
        );
        return replacementVisibleText(
          displayed,
          window.RMLI18n.t("graph.type.unavailable")
        );
      };
      const inputPorts = (Array.isArray(value.inputPorts) ? value.inputPorts : [])
        .map((port, index) =>
          `${replacementPortDisplayName(port, value, "input", index)}: ${portType(port)}`
        );
      const outputPorts = (Array.isArray(value.outputPorts) ? value.outputPorts : [])
        .map((port, index) =>
          `${replacementPortDisplayName(port, value, "output", index)}: ${portType(port)}`
        );
      const technical = [
        `${window.RMLI18n.t("import.replacement.contract.detail.kind")}: ${kindLabel}`,
        owner ? `${window.RMLI18n.t("import.replacement.contract.detail.owner")}: ${owner}` : "",
        member ? `${window.RMLI18n.t("import.replacement.contract.detail.member")}: ${member}` : "",
        signature ? `${window.RMLI18n.t("import.replacement.contract.detail.signature")}: ${signature}` : "",
        returnType ? `${window.RMLI18n.t("import.replacement.contract.detail.return")}: ${returnType}` : "",
        parameters.length ? `${window.RMLI18n.t("import.replacement.contract.detail.parameters")}: ${parameters.join(", ")}` : "",
        bindings.length ? `${window.RMLI18n.t("import.replacement.contract.detail.generic_bindings")}: ${bindings.join(", ")}` : "",
        inputPorts.length ? `${window.RMLI18n.t("import.replacement.contract.detail.inputs")}: ${inputPorts.join(" | ")}` : "",
        outputPorts.length ? `${window.RMLI18n.t("import.replacement.contract.detail.outputs")}: ${outputPorts.join(" | ")}` : ""
      ].filter(Boolean).join("\n");

      return {
        primary,
        secondary: secondaryParts.filter(Boolean).join(" · "),
        technical
      };
    }

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
          `[HARD REPLACEMENT UI ERROR] Replacement ${Number(index) + 1} of ${Number(total)} cannot be shown because required replacement-panel controls are missing. dialog=${Boolean(dialog)}, confirm=${Boolean(confirm)}, cancel=${Boolean(cancel)}, skip=${Boolean(skip)}, candidates=${Number(candidateCount) || 0}.`
        );
      }

      if (!visible) {
        throw new Error(
          `[HARD REPLACEMENT UI ERROR] Replacement ${Number(index) + 1} of ${Number(total)} was requested but the replacement panel is not visibly rendered. hidden=${String(dialog.hidden)}, display=${String(style?.display)}, visibility=${String(style?.visibility)}, opacity=${String(style?.opacity)}, rect=${Number(rect?.width || 0)}x${Number(rect?.height || 0)}, candidates=${Number(candidateCount) || 0}.`
        );
      }
      return true;
    }

    async function requestBuilderReplacementChoice(
      workSession,
      {
        requirement,
        candidates,
        searchCandidates = [],
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

      /*
       * Search must never lose the suggestions already visible before the
       * user starts typing. Build one deduplicated index from BOTH the
       * conservative suggestion set and the full-catalog browse set.
       */
      const catalogSearchValues = [
        ...new Map(
          [
            ...values,
            ...(Array.isArray(searchCandidates)
              ? searchCandidates
              : [])
          ]
            .filter(candidate =>
              Boolean(
                String(
                  candidate?.operatorId || ""
                ).trim()
              )
            )
            .map(candidate => [
              String(candidate.operatorId),
              candidate
            ])
        ).values()
      ];

      const prompt =
        ++activeBuilderReplacementPrompt;
      const search =
        elements.builderWorkReplacementSearch;
      const list =
        elements.builderWorkReplacementList;

      /*
       * Explicit replacement scope: safe suggestions by default, or the
       * complete catalog when the user deliberately asks for maximum freedom.
       * The search field always searches only inside the active scope.
       */
      const scopeHost =
        document.createElement("div");
      scopeHost.className =
        "builder-work-replacement-scope";
      scopeHost.setAttribute(
        "role",
        "group"
      );
      scopeHost.setAttribute(
        "aria-label",
        window.RMLI18n.t(
          "import.replacement.scope.label"
        )
      );
      const suggestedScopeButton =
        document.createElement("button");
      suggestedScopeButton.type = "button";
      suggestedScopeButton.className =
        "builder-work-replacement-scope-button";
      suggestedScopeButton.textContent =
        window.RMLI18n.t(
          "import.replacement.scope.suggested"
        );
      const allScopeButton =
        document.createElement("button");
      allScopeButton.type = "button";
      allScopeButton.className =
        "builder-work-replacement-scope-button";
      allScopeButton.textContent =
        window.RMLI18n.t(
          "import.replacement.scope.all"
        );
      scopeHost.append(
        suggestedScopeButton,
        allScopeButton
      );
      search.parentElement?.insertBefore(
        scopeHost,
        search
      );

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
      const storedContractDisplay =
        replacementContractDisplay(
          requirement?.apiContract,
          operatorId
        );
      const friendlyVisibleLabels = visibleLabels
        .map(label => replacementVisibleText(label))
        .filter(label =>
          label && !label.includes(operatorId)
        );
      const nodeDescription =
        (
          storedContractDisplay.primary !==
            window.RMLI18n.t("import.replacement.api.unavailable")
            ? storedContractDisplay.primary
            : ""
        ) ||
        (friendlyVisibleLabels.length > 0
          ? friendlyVisibleLabels.slice(0, 3).join(", ")
          : window.RMLI18n.t("import.replacement.api.unavailable"));
      const sourceDescription =
        catalogResult?.live === true
          ? window.RMLI18n.t("ui.literal.e9adce3048e9")
          : window.RMLI18n.t("ui.literal.dc0419d30ba4");
      const previousPlanDiagnostics =
        (Array.isArray(validationDiagnostics)
          ? validationDiagnostics
          : [])
          .map(value =>
            replacementSanitizeDiagnostic(
              value,
              [
                {
                  internal: operatorId,
                  visible: nodeDescription
                },
                ...values.map(candidate => ({
                  internal: candidate?.operatorId,
                  visible: replacementContractDisplay(
                    candidate?.apiContract,
                    candidate?.operatorId
                  ).primary
                }))
              ]
            )
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
                  count: previousPlanDiagnostics.length.toLocaleString(
                    window.RMLI18n?.language || undefined
                  )
                })
              : window.RMLI18n.format(
                  values.length === 1
                    ? "import.replacement.candidates_detail.one"
                    : "import.replacement.candidates_detail.other",
                  {
                    count: values.length.toLocaleString(window.RMLI18n?.language || undefined),
                    node: nodeDescription
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

        const queueEntries =
          Array.isArray(replacementQueue)
            ? replacementQueue
            : [];
        const fragment =
          document.createDocumentFragment();

        const nonReplaceableEntries =
          queueEntries.filter(entry =>
            entry?.status === "dead" ||
            (
              Array.isArray(entry?.candidates) &&
              entry.candidates.length === 0
            )
          );
        const nonReplaceableInstances =
          nonReplaceableEntries.reduce(
            (sum, entry) =>
              sum +
              Math.max(
                1,
                Number(entry?.instanceCount) || 0
              ),
            0
          );
        const finishedStatuses =
          new Set([
            "compatible",
            "auto-replaced",
            "manual-replaced",
            "selected",
            "dead",
            "skipped"
          ]);
        const finishedFamilies =
          queueEntries.filter(entry =>
            finishedStatuses.has(
              String(entry?.status || "")
            )
          ).length;

        const currentEntry =
          queueEntries.find(entry =>
            String(entry?.status || "") ===
              "current"
          ) ||
          queueEntries.find(entry =>
            String(entry?.status || "") ===
              "manual-required"
          ) ||
          queueEntries.find(entry =>
            !finishedStatuses.has(
              String(entry?.status || "pending")
            )
          );

        const panel =
          document.createElement("div");
        panel.className =
          "builder-work-replacement-fixed-status";

        if (currentEntry) {
          const currentCard =
            document.createElement("section");
          currentCard.className =
            "builder-work-replacement-current-card";
          const heading =
            document.createElement("strong");
          heading.className =
            "builder-work-replacement-status-heading";
          heading.textContent =
            window.RMLI18n.t(
              "import.replacement.current.heading"
            );

          const display =
            replacementContractDisplay(
              currentEntry?.requirement?.apiContract,
              currentEntry?.operatorId
            );
          const title =
            document.createElement("div");
          title.className =
            "builder-work-replacement-current-name";
          title.textContent = display.primary;

          const contract =
            document.createElement("div");
          contract.className =
            "builder-work-replacement-current-contract";
          contract.textContent = display.secondary;

          const meta =
            document.createElement("div");
          meta.className =
            "builder-work-replacement-current-meta";
          meta.textContent =
            window.RMLI18n.format(
              "import.replacement.current.instances",
              {
                count: Math.max(
                  1,
                  Number(
                    currentEntry?.instanceCount
                  ) || 0
                ).toLocaleString(
                  window.RMLI18n?.language ||
                  undefined
                )
              }
            );

          currentCard.append(
            heading,
            title,
            contract,
            meta
          );
          panel.appendChild(currentCard);
        }

        if (nonReplaceableEntries.length > 0) {
          const deadSummary =
            document.createElement("section");
          deadSummary.className =
            "builder-work-replacement-dead-summary";
          deadSummary.setAttribute(
            "role",
            "status"
          );

          const deadHeading =
            document.createElement("strong");
          deadHeading.className =
            "builder-work-replacement-status-heading";
          deadHeading.textContent =
            window.RMLI18n.t(
              "import.replacement.dead_summary.heading"
            );

          const deadText =
            document.createElement("span");
          deadText.textContent =
            window.RMLI18n.format(
              nonReplaceableInstances === 1
                ? "import.replacement.dead_summary.one"
                : "import.replacement.dead_summary.other",
              {
                count:
                  nonReplaceableInstances.toLocaleString(
                    window.RMLI18n?.language ||
                    undefined
                  ),
                families:
                  nonReplaceableEntries.length.toLocaleString(
                    window.RMLI18n?.language ||
                    undefined
                  )
              }
            );
          deadSummary.append(
            deadHeading,
            deadText
          );
          panel.appendChild(deadSummary);
        }

        const progress =
          document.createElement("div");
        progress.className =
          "builder-work-replacement-family-progress";
        progress.textContent =
          window.RMLI18n.format(
            "import.replacement.family_progress",
            {
              current:
                Math.min(
                  queueEntries.length,
                  finishedFamilies +
                    (currentEntry ? 1 : 0)
                ).toLocaleString(
                  window.RMLI18n?.language ||
                  undefined
                ),
              total:
                queueEntries.length.toLocaleString(
                  window.RMLI18n?.language ||
                  undefined
                )
            }
          );
        panel.appendChild(progress);

        fragment.appendChild(panel);
        queueHost.replaceChildren(fragment);
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
            .map((portId, portIndex) =>
              window.RMLI18n.format(
                "import.replacement.port.input",
                {
                  port: replacementPortDisplayName(
                    portId,
                    requirement?.apiContract,
                    "input",
                    portIndex
                  )
                }
              )
            ),
          ...(selected
            ?.unmappedReferencedOutputs || [])
            .map((portId, portIndex) =>
              window.RMLI18n.format(
                "import.replacement.port.output",
                {
                  port: replacementPortDisplayName(
                    portId,
                    requirement?.apiContract,
                    "output",
                    portIndex
                  )
                }
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
                          ports: missingInputs.map((port, portIndex) =>
                            replacementPortDisplayName(
                              port,
                              selected?.apiContract,
                              "input",
                              portIndex
                            )
                          ).join(", ")
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
                ports: missingInputs.map((port, portIndex) =>
                  replacementPortDisplayName(
                    port,
                    selected?.apiContract,
                    "input",
                    portIndex
                  )
                ).join(", ")
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
          selected?.selectable === false
            ? ""
            : selected?.operatorId || "";

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

      let replacementScope =
        "suggested";
      let searchRenderLimit =
        BUILDER_REPLACEMENT_RENDER_LIMIT;
      let lastSearchQuery = "";
      let lastSearchScope =
        replacementScope;

      const updateScopeButtons = () => {
        const suggestedActive =
          replacementScope === "suggested";
        suggestedScopeButton.setAttribute(
          "aria-pressed",
          String(suggestedActive)
        );
        allScopeButton.setAttribute(
          "aria-pressed",
          String(!suggestedActive)
        );
        suggestedScopeButton.dataset.active =
          String(suggestedActive);
        allScopeButton.dataset.active =
          String(!suggestedActive);
      };
      updateScopeButtons();
      let searchRequestSerial = 0;

      const catalogEntryCandidate = entry => {
        const definition =
          entry?.definition &&
          typeof entry.definition === "object"
            ? entry.definition
            : {};
        const operatorId = String(
          entry?.operatorId || ""
        );
        const known =
          catalogSearchValues.find(candidate =>
            candidate.operatorId === operatorId
          );
        if (known) {
          return known;
        }
        const verification =
          definition.apiVerification &&
          typeof definition.apiVerification === "object"
            ? definition.apiVerification
            : {};
        const apiContract =
          definition.apiContract &&
          typeof definition.apiContract === "object"
            ? definition.apiContract
            : {
                kind:
                  verification.kind ||
                  definition.apiMemberKind || "",
                ownerType:
                  verification.ownerType ||
                  definition.catalogType || "",
                memberName:
                  verification.memberName ||
                  definition.memberName ||
                  definition.title || "",
                signature:
                  verification.signature ||
                  definition.signature || "",
                returnType:
                  verification.returnType || "",
                csType:
                  verification.csType ||
                  definition.catalogType || ""
              };
        return Object.freeze({
          operatorId,
          apiContract,
          title: replacementVisibleText(
            definition.title,
            window.RMLI18n.t(
              "import.replacement.api.unavailable"
            )
          ),
          symbol: String(
            definition.symbol || "API"
          ),
          group: String(
            definition.group ||
            window.RMLI18n.t(
              "ui.literal.924e20a624e5"
            )
          ),
          description: String(
            definition.description || ""
          ),
          paletteIcon:
            definition.paletteIcon || null,
          semanticProof: "catalog-search",
          /*
           * Full-catalog search is an explicit user override surface.
           * Auto-replacement remains strict elsewhere, but a user may
           * deliberately choose any catalog node here. Keep the warning
           * instead of disabling the result.
           */
          selectable: true,
          manualOverride: true,
          compatibilityWarning: true,
          incompatibilityReason:
            window.RMLI18n.t(
              "import.replacement.search.manual_override_warning"
            ),
          inputMap: Object.freeze({}),
          outputMap: Object.freeze({}),
          unmappedInputPorts: Object.freeze([]),
          unmappedOutputPorts: Object.freeze([]),
          unmappedRequiredInputs: Object.freeze([]),
          unmappedReferencedInputs: Object.freeze([]),
          unmappedReferencedOutputs: Object.freeze([])
        });
      };

      const renderCandidates = async ({
        append = false
      } = {}) => {
        const query = String(
          search.value || ""
        ).trim();
        const normalizedQuery =
          query.toLocaleLowerCase();
        const previous = selectedOperatorId;

        if (
          query !== lastSearchQuery ||
          replacementScope !== lastSearchScope
        ) {
          lastSearchQuery = query;
          lastSearchScope = replacementScope;
          searchRenderLimit =
            BUILDER_REPLACEMENT_RENDER_LIMIT;
        }

        const filterSuggested = source => {
          if (!query) {
            return source;
          }
          return source.filter(candidate => {
            const display =
              replacementContractDisplay(
                candidate.apiContract,
                candidate.operatorId
              );
            return `${candidate.title || ""} ${candidate.operatorId || ""} ${candidate.group || ""} ${candidate.description || ""} ${display.primary} ${display.secondary} ${display.technical}`
              .toLocaleLowerCase()
              .includes(normalizedQuery);
          });
        };

        let matches =
          replacementScope === "suggested"
            ? filterSuggested(values)
            : [];
        let totalMatches = matches.length;

        if (replacementScope === "all") {
          const serial = ++searchRequestSerial;
          const demandCache =
            window.RMLCatalogDemandCache;

          if (
            demandCache &&
            typeof demandCache.queryPalette ===
              "function"
          ) {
            list.setAttribute(
              "aria-busy",
              "true"
            );

            /*
             * queryPalette intentionally caps one request at 100 rows.
             * Build the requested render window page-by-page so "All"
             * immediately browses the catalog even with an empty query,
             * and "Load more" can genuinely grow beyond the first page.
             */
            const pageSize = 100;
            const requestedEntries = [];
            let reportedTotal = 0;
            for (
              let pageOffset = 0;
              pageOffset < searchRenderLimit;
              pageOffset += pageSize
            ) {
              const result =
                await demandCache.queryPalette({
                  query,
                  offset: pageOffset,
                  limit: Math.min(
                    pageSize,
                    searchRenderLimit -
                      pageOffset
                  ),
                  showAdvanced: true,
                  context: "replacement"
                });

              if (
                serial !== searchRequestSerial ||
                query !== String(
                  search.value || ""
                ).trim() ||
                replacementScope !== "all"
              ) {
                return;
              }

              const pageEntries =
                Array.isArray(result?.entries)
                  ? result.entries
                  : [];
              requestedEntries.push(
                ...pageEntries
              );
              reportedTotal = Math.max(
                reportedTotal,
                Number(result?.total) || 0
              );

              if (
                pageEntries.length < pageSize &&
                (
                  Number(result?.total) <=
                    pageOffset +
                      pageEntries.length
                )
              ) {
                break;
              }
            }

            const fullCatalog =
              requestedEntries.map(
                catalogEntryCandidate
              );

            /*
             * Known suggestions remain in the union so a proven compatible
             * candidate keeps its richer compatibility metadata.
             */
            const suggestedMatches =
              filterSuggested(values);
            const union = [
              ...suggestedMatches,
              ...fullCatalog
            ];
            matches = [
              ...new Map(
                union.map(candidate => [
                  String(candidate.operatorId),
                  candidate
                ])
              ).values()
            ];
            totalMatches = Math.max(
              reportedTotal,
              matches.length
            );
          } else {
            /*
             * Offline/fallback path: browse the complete locally indexed
             * candidate set. Empty query means "all", non-empty query filters.
             */
            matches = query
              ? catalogSearchValues.filter(
                  candidate => {
                    const display =
                      replacementContractDisplay(
                        candidate.apiContract,
                        candidate.operatorId
                      );
                    return `${candidate.title || ""} ${candidate.operatorId || ""} ${candidate.group || ""} ${candidate.description || ""} ${display.primary} ${display.secondary} ${display.technical}`
                      .toLocaleLowerCase()
                      .includes(normalizedQuery);
                  }
                )
              : [...catalogSearchValues];
            totalMatches = matches.length;
          }
        }

        visibleCandidates =
          matches.slice(
            0,
            searchRenderLimit
          );
        const fragment =
          document.createDocumentFragment();

        for (const candidate of visibleCandidates) {
          const item = document.createElement("button");
          item.type = "button";
          item.className =
            "builder-work-replacement-item";
          const candidateSelectable =
            candidate.selectable !== false;
          const manualOverrideWarning =
            candidate.manualOverride === true ||
            candidate.compatibilityWarning === true;
          item.disabled = !candidateSelectable;
          item.classList.toggle(
            "builder-work-replacement-item-unavailable",
            !candidateSelectable
          );
          item.classList.toggle(
            "builder-work-replacement-item-manual-warning",
            manualOverrideWarning
          );
          item.setAttribute(
            "aria-disabled",
            String(!candidateSelectable)
          );
          item.dataset.operatorId =
            candidate.operatorId;
          item.setAttribute("role", "option");
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
            typeof candidate.paletteIcon === "object"
              ? candidate.paletteIcon
              : {
                  symbol: candidate.symbol || "API",
                  color: "#8fdcff",
                  tone: "standard"
                };
          symbol.textContent = String(
            paletteIcon.symbol ||
            candidate.symbol || "API"
          );
          symbol.dataset.iconTone = String(
            paletteIcon.tone || "standard"
          );
          symbol.dataset.rmlNodeIconColor =
            String(
              paletteIcon.color || "#8fdcff"
            );

          const copy =
            document.createElement("span");
          copy.className =
            "builder-work-replacement-copy";
          const candidateContractDisplay =
            replacementContractDisplay(
              candidate.apiContract,
              candidate.operatorId
            );
          const title =
            document.createElement("strong");
          title.textContent =
            candidateContractDisplay.primary ||
            candidate.title ||
            window.RMLI18n.t(
              "ui.literal.924e20a624e5"
            );
          const group =
            document.createElement("small");
          group.textContent =
            candidateContractDisplay.secondary ||
            candidate.group ||
            window.RMLI18n.t(
              "ui.literal.924e20a624e5"
            );
          const match =
            document.createElement("small");
          match.className =
            "builder-work-replacement-match";
          match.textContent =
            manualOverrideWarning
              ? replacementSanitizeDiagnostic(
                  candidate.incompatibilityReason ||
                  window.RMLI18n.t(
                    "import.replacement.search.manual_override_warning"
                  ),
                  [{
                    internal: candidate.operatorId,
                    visible: candidateContractDisplay.primary
                  }]
                )
              : candidateSelectable
                ? candidate.semanticProof ===
                    "exact-contract"
                  ? window.RMLI18n.t(
                      "ui.literal.5c4d324a9ea4"
                    )
                  : window.RMLI18n.t(
                      "ui.literal.882073eb8847"
                    )
                : replacementSanitizeDiagnostic(
                    candidate.incompatibilityReason ||
                    window.RMLI18n.t(
                      "import.replacement.search.contract_mismatch"
                    ),
                    [{
                      internal: candidate.operatorId,
                      visible: candidateContractDisplay.primary
                    }]
                  );
          copy.append(
            title,
            group,
            match
          );
          item.append(symbol, copy);
          item.title =
            `${candidateContractDisplay.primary}\n${candidateContractDisplay.secondary}\n${candidateContractDisplay.technical}\n${match.textContent}`;
          fragment.appendChild(item);
        }

        if (query && totalMatches === 0) {
          const empty =
            document.createElement("div");
          empty.className =
            "builder-work-replacement-empty";
          empty.textContent =
            window.RMLI18n.t(
              "import.replacement.search.no_results"
            );
          fragment.appendChild(empty);
        }

        if (
          replacementScope === "all" &&
          !query &&
          totalMatches === 0
        ) {
          const empty =
            document.createElement("div");
          empty.className =
            "builder-work-replacement-empty";
          empty.textContent =
            window.RMLI18n.t(
              "import.replacement.scope.catalog_empty"
            );
          fragment.appendChild(empty);
        }

        if (
          (query || replacementScope === "all") &&
          visibleCandidates.length < totalMatches
        ) {
          const more =
            document.createElement("button");
          more.type = "button";
          more.className =
            "builder-work-replacement-load-more";
          more.textContent =
            window.RMLI18n.t(
              "import.replacement.search.load_more"
            );
          more.onclick = async () => {
            searchRenderLimit +=
              BUILDER_REPLACEMENT_RENDER_LIMIT;
            await renderCandidates({
              append: true
            });
          };
          fragment.appendChild(more);
        }

        list.replaceChildren(fragment);
        list.setAttribute("aria-busy", "false");
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
        selectCandidate(selectedOperatorId);

        if (
          query ||
          replacementScope === "all"
        ) {
          summary.textContent =
            window.RMLI18n.format(
              "import.replacement.search.result_count",
              {
                total:
                  totalMatches.toLocaleString(
                    window.RMLI18n?.language ||
                    undefined
                  ),
                visible:
                  visibleCandidates.length.toLocaleString(
                    window.RMLI18n?.language ||
                    undefined
                  )
              }
            );
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
            scopeHost.remove();
            resetBuilderReplacementUi();
            callback(value);
          };
          const accept = () => {
            const selected =
              visibleCandidates.find(candidate =>
                candidate.operatorId ===
                  selectedOperatorId
              ) ||
              values.find(candidate =>
                candidate.operatorId ===
                  selectedOperatorId
              );
            if (selected) {
              finish(
                resolve,
                Object.freeze({
                  ...selected,
                  userConfirmed: true,
                  manualOverride:
                    selected.manualOverride === true
                })
              );
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

          const scheduleCandidateRender = () => {
            renderCandidates().catch(error => {
              console.error(
                "[RML Replacement] Catalog search failed.",
                error
              );
            });
          };
          suggestedScopeButton.onclick = () => {
            replacementScope = "suggested";
            selectedOperatorId = "";
            updateScopeButtons();
            scheduleCandidateRender();
          };
          allScopeButton.onclick = () => {
            replacementScope = "all";
            selectedOperatorId = "";
            updateScopeButtons();
            scheduleCandidateRender();
          };

          search.oninput =
            scheduleCandidateRender;
          search.onsearch =
            scheduleCandidateRender;
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
      await renderCandidates();
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
