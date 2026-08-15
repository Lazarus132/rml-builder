(() => {
  "use strict";

  const VERSION = 6;
  const KINDS = Object.freeze({
    choice: "choice",
    action: "action",
    toggle: "toggle"
  });

  if ((window.__RMLDynamicSettingsVersion || 0) >= VERSION) {
    return;
  }
  window.__RMLDynamicSettingsVersion = VERSION;

  const previewSelection = new Map();
  let bootAttempts = 0;
  let observer = null;
  let inspectorRendering = false;
  let runtimeBridgeUnsubscribe = null;
  let runtimeBridgeSubscribedChannel = "";
  let runtimeUiRefreshTimer = 0;
  let runtimeUiSignature = "";

  function id(prefix = "dynamic") {
    return `${prefix}-${Date.now().toString(36)}-${Math.random()
      .toString(36).slice(2, 9)}`;
  }

  function allNodes() {
    const result = [];
    const visit = (nodes, parent = null) => {
      for (const node of Array.isArray(nodes) ? nodes : []) {
        if (!node || typeof node !== "object") continue;
        result.push({ node, parent: nodes });
        for (const option of Array.isArray(node.options) ? node.options : []) {
          visit(option?.children, option);
        }
        visit(node.children, node);
      }
    };
    visit(state?.nodes);
    return result;
  }

  function graphNodes() {
    return Array.isArray(
      state?.extensions?.typedNodeGraph?.nodes
    )
      ? state.extensions.typedNodeGraph.nodes
      : [];
  }

  function monitorNodes() {
    const definitions =
      window.RMLModNodeRegistry?.getNodeDefinitions?.() || {};

    return graphNodes()
      .filter(node =>
        node?.kind === "operator" &&
        node?.operatorId === "resonite.displayValue"
      )
      .map((node, index) => ({
        id: String(node.id || ""),
        label: String(
          node.label ||
          definitions[node.operatorId]?.label ||
          `Display Value ${index + 1}`
        )
      }))
      .filter(item => item.id);
  }

  function sanitizeIdentifier(value, fallback) {
    let result = String(value || "")
      .replace(/[^A-Za-z0-9_]/g, "_")
      .replace(/^[^A-Za-z_]+/, "");
    if (!result) result = fallback;
    return result;
  }

  function uniqueFieldName(base) {
    const names = new Set(
      allNodes().map(({ node }) =>
        String(node.fieldName || "")
      )
    );
    let candidate = sanitizeIdentifier(base, "DynamicValue");
    let suffix = 2;
    while (names.has(candidate)) {
      candidate = `${sanitizeIdentifier(base, "DynamicValue")}${suffix++}`;
    }
    return candidate;
  }

  function activeNodeArray() {
    const active = String(state?.activeContainerId || "root");
    if (active === "root") return state.nodes;
    for (const { node } of allNodes()) {
      for (const option of Array.isArray(node.options) ? node.options : []) {
        if (String(option.id) === active) {
          option.children ||= [];
          return option.children;
        }
      }
      if (String(node.id) === active) {
        node.children ||= [];
        return node.children;
      }
    }
    return state.nodes;
  }

  function makeSetting(valueType, fieldName, keyName, defaultValue) {
    return {
      id: id("setting"),
      kind: "setting",
      valueType,
      fieldName,
      keyName,
      description: "Generated dynamic RML menu state.",
      defaultValue: String(defaultValue ?? ""),
      hidden: true,
      validatorMode: "none",
      customValidator: "",
      useSlider: false,
      minimum: valueType === "bool" ? "0" : "0",
      maximum: valueType === "bool" ? "1" : "100",
      enumName: "",
      enumOptions: [],
      reaction: "saved",
      dynamicInternal: true
    };
  }

  function normalizeControl(node) {
    if (!node?.dynamicSettingKind) return node;
    node.hidden = true;
    node.description ||= "Collection-driven RML menu control.";
    node.dynamicLabelMonitorId ||= "";
    node.dynamicValueMonitorId ||= "";
    node.dynamicStateMonitorId ||= "";
    node.dynamicAllowEmpty = node.dynamicAllowEmpty === true;
    node.dynamicButtonLabel ||= "Run";
    node.defaultValue ??= "";
    return node;
  }

  function ensureCompanions(node, parent) {
    normalizeControl(node);
    const array = Array.isArray(parent) ? parent : activeNodeArray();
    const find = nodeId => allNodes().find(x => x.node.id === nodeId)?.node;

    if (node.dynamicSettingKind === KINDS.action) {
      let counter = find(node.dynamicCounterNodeId);
      if (!counter) {
        counter = makeSetting(
          "int",
          uniqueFieldName(`${node.fieldName}_ActionCounter`),
          `${node.keyName} action counter`,
          "0"
        );
        counter.dynamicInternalRole = "actionCounter";
        counter.dynamicOwnerId = node.id;
        array.push(counter);
        node.dynamicCounterNodeId = counter.id;
      }
    }

    if (node.dynamicSettingKind === KINDS.toggle) {
      let stateNode = find(node.dynamicStateNodeId);
      if (!stateNode) {
        stateNode = makeSetting(
          "bool",
          uniqueFieldName(`${node.fieldName}_State`),
          `${node.keyName} changed state`,
          "false"
        );
        stateNode.dynamicInternalRole = "toggleState";
        stateNode.dynamicOwnerId = node.id;
        array.push(stateNode);
        node.dynamicStateNodeId = stateNode.id;
      }

      let counter = find(node.dynamicCounterNodeId);
      if (!counter) {
        counter = makeSetting(
          "int",
          uniqueFieldName(`${node.fieldName}_ChangeCounter`),
          `${node.keyName} change counter`,
          "0"
        );
        counter.dynamicInternalRole = "toggleCounter";
        counter.dynamicOwnerId = node.id;
        array.push(counter);
        node.dynamicCounterNodeId = counter.id;
      }
    }
  }

  function normalizeAll() {
    for (const entry of allNodes()) {
      if (entry.node.dynamicSettingKind) {
        ensureCompanions(entry.node, entry.parent);
      }
    }
  }

  function selectedNode() {
    return allNodes().find(
      entry => String(entry.node.id) === String(state?.selectedId)
    )?.node || null;
  }

  function graphViewActive() {
    return Boolean(
      state?.extensions?.typedNodeGraph?.active === true ||
      document.body.classList.contains("rml-node-graph-mode")
    );
  }

  function requestRefresh() {
    try { saveState?.(); } catch {}

    if (!graphViewActive()) {
      try { renderOutline?.(); } catch {}
      try { renderInspector?.(); } catch {}
      try { renderPreview?.(); } catch {}
    }

    try {
      window.RMLNodeGraphBridge
        ?.requestGeneratedOutputRefresh?.();
    } catch {}

    scheduleRuntimeBridgeSubscriptionRefresh();
  }

  function removeControl(node) {
    const ids = new Set([
      node.id,
      node.dynamicCounterNodeId,
      node.dynamicStateNodeId
    ].filter(Boolean));

    const remove = nodes => {
      if (!Array.isArray(nodes)) return;
      for (let i = nodes.length - 1; i >= 0; i -= 1) {
        const candidate = nodes[i];
        if (ids.has(candidate?.id)) {
          nodes.splice(i, 1);
          continue;
        }
        for (const option of Array.isArray(candidate?.options)
          ? candidate.options : []) {
          remove(option?.children);
        }
        remove(candidate?.children);
      }
    };
    remove(state.nodes);
    state.selectedId = null;
    requestRefresh();
  }

  function createControl(kind) {
    const array = activeNodeArray();
    const suffix = kind === KINDS.choice
      ? "Choice"
      : kind === KINDS.action
        ? "ActionList"
        : "ToggleList";
    const fieldName = uniqueFieldName(`Dynamic${suffix}`);
    const main = makeSetting(
      "string",
      fieldName,
      kind === KINDS.choice
        ? "Dynamic Choice"
        : kind === KINDS.action
          ? "Dynamic Actions"
          : "Dynamic Toggles",
      ""
    );
    main.dynamicInternal = false;
    main.dynamicSettingKind = kind;
    main.description = "Collection-driven RML menu control.";
    main.reaction = kind === KINDS.choice
      ? "startup-saved"
      : "stored";
    array.push(main);
    ensureCompanions(main, array);
    state.selectedId = main.id;
    requestRefresh();
  }

  function paletteRoot() {
    return document.querySelector(
      ".type-palette, .palette, #type-palette, #palette"
    );
  }

  function installPalette() {
    document.querySelectorAll("[data-rml-dynamic-palette], .rml-dynamic-settings-palette")
      .forEach(element => element.remove());
  }

  function monitorSelect(value) {
    const select = document.createElement("select");
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "— Select Display Value —";
    select.appendChild(empty);
    for (const monitor of monitorNodes()) {
      const option = document.createElement("option");
      option.value = monitor.id;
      option.textContent = `${monitor.label} · ${monitor.id}`;
      option.selected = monitor.id === value;
      select.appendChild(option);
    }
    return select;
  }

  function field(labelText, control) {
    const label = document.createElement("label");
    label.append(document.createTextNode(labelText));
    label.appendChild(control);
    return label;
  }

  function renderDynamicInspector(force = false) {
    if (inspectorRendering || graphViewActive()) return false;
    const node = selectedNode();
    if (!node?.dynamicSettingKind) return false;

    const host = document.getElementById("inspector-content");
    if (!host) return false;
    if (
      !force &&
      host.dataset.rmlDynamicInspectorId === String(node.id) &&
      host.querySelector("[data-rml-dynamic-inspector-body]")
    ) {
      return true;
    }
    inspectorRendering = true;
    host.replaceChildren();
    host.dataset.rmlDynamicInspectorId = String(node.id);
    const inspectorBody = document.createElement("div");
    inspectorBody.dataset.rmlDynamicInspectorBody = "true";
    inspectorBody.className = "rml-dynamic-settings-inspector";
    host.appendChild(inspectorBody);

    const heading = document.createElement("div");
    heading.className = "inspector-heading";
    const title = document.createElement("h3");
    title.textContent = node.dynamicSettingKind === KINDS.choice
      ? "Dynamic Choice"
      : node.dynamicSettingKind === KINDS.action
        ? "Dynamic Action List"
        : "Dynamic Toggle List";
    heading.appendChild(title);
    inspectorBody.appendChild(heading);

    const name = document.createElement("input");
    name.value = node.keyName || "";
    name.addEventListener("input", () => {
      node.keyName = name.value;
      node._rmlDynamicLabelCustomized = true;
      requestRefresh();
    });
    inspectorBody.appendChild(field("Menu label", name));

    const description = document.createElement("textarea");
    description.value = node.description || "";
    description.rows = 3;
    description.addEventListener("input", () => {
      node.description = description.value;
      requestRefresh();
    });
    inspectorBody.appendChild(field("Description", description));

    const directCollectionBound =
      Boolean(
        node._rmlEditableCollectionSourceNodeId
      );

    if (!directCollectionBound) {
      /*
       * Manually supplied collection controls use explicit monitor bindings.
       * Direct Collect To List controls use the marked collection itself as
       * their single authoritative source.
       */
      const labels =
        monitorSelect(
          node.dynamicLabelMonitorId
        );

      labels.addEventListener(
        "change",
        () => {
          node.dynamicLabelMonitorId =
            labels.value;
          requestRefresh();
        }
      );

      inspectorBody.appendChild(
        field(
          "Labels collection",
          labels
        )
      );

      const values =
        monitorSelect(
          node.dynamicValueMonitorId
        );

      values.addEventListener(
        "change",
        () => {
          node.dynamicValueMonitorId =
            values.value;
          requestRefresh();
        }
      );

      inspectorBody.appendChild(
        field(
          "Stable values collection (optional)",
          values
        )
      );
    } else {
      const sourceNote =
        document.createElement("div");

      sourceNote.className =
        "inspector-note";

      sourceNote.textContent =
        "Options come directly from the linked Collect To List at runtime. No separate Labels or Stable Values source is required.";

      inspectorBody.appendChild(
        sourceNote
      );
    }

    if (node.dynamicSettingKind === KINDS.choice) {
      const empty = document.createElement("input");
      empty.type = "checkbox";
      empty.checked = node.dynamicAllowEmpty === true;
      empty.addEventListener("change", () => {
        node.dynamicAllowEmpty = empty.checked;
        requestRefresh();
      });
      inspectorBody.appendChild(field("Allow empty selection", empty));

      if (directCollectionBound) {
        const channel =
          runtimeBridgeChannelForDynamicSettings();

        const runtimeState =
          window.RMLRuntimeBridge
            ?.getState?.(channel);

        const options =
          controlOptions(node);

        const runtimeAvailable =
          runtimeState?.connected === true &&
          runtimeState?.active === true &&
          options.length > 0;

        if (runtimeAvailable) {
          const fallback =
            document.createElement(
              "select"
            );

          const automatic =
            document.createElement(
              "option"
            );

          automatic.value = "";
          automatic.textContent =
            `Automatic · first runtime item (${options[0].label})`;

          fallback.appendChild(
            automatic
          );

          for (const option of options) {
            const item =
              document.createElement(
                "option"
              );

            item.value =
              option.value;
            item.textContent =
              option.label;
            fallback.appendChild(item);
          }

          const configuredDefault =
            String(
              node.defaultValue || ""
            );

          fallback.value =
            options.some(
              option =>
                option.value ===
                configuredDefault
            )
              ? configuredDefault
              : "";

          if (
            configuredDefault &&
            fallback.value === ""
          ) {
            node.defaultValue = "";
          }

          fallback.addEventListener(
            "change",
            () => {
              node.defaultValue =
                fallback.value;
              requestRefresh();
            }
          );

          inspectorBody.appendChild(
            field(
              "Default selection",
              fallback
            )
          );
        } else {
          const defaultNote =
            document.createElement("div");

          defaultNote.className =
            "inspector-note";

          defaultNote.textContent =
            node.dynamicAllowEmpty
              ? "Runtime options are not currently available. No default can be chosen here until the matching generated mod is running in Resonite. With no explicit default, the control stays empty when empty selection is allowed."
              : "Runtime options are not currently available. No default can be chosen here until the matching generated mod is running in Resonite. With no explicit default, the first runtime item is selected automatically.";

          inspectorBody.appendChild(
            defaultNote
          );
        }
      } else {
        const fallback =
          document.createElement("input");

        fallback.value =
          node.defaultValue || "";

        fallback.addEventListener(
          "input",
          () => {
            node.defaultValue =
              fallback.value;
            requestRefresh();
          }
        );

        inspectorBody.appendChild(
          field(
            "Default stable value",
            fallback
          )
        );
      }
    }

    if (node.dynamicSettingKind === KINDS.action) {
      const buttonLabel = document.createElement("input");
      buttonLabel.value = node.dynamicButtonLabel || "Run";
      buttonLabel.addEventListener("input", () => {
        node.dynamicButtonLabel = buttonLabel.value;
        requestRefresh();
      });
      inspectorBody.appendChild(field("Action label", buttonLabel));
    }

    if (node.dynamicSettingKind === KINDS.toggle) {
      const states = monitorSelect(node.dynamicStateMonitorId);
      states.addEventListener("change", () => {
        node.dynamicStateMonitorId = states.value;
        requestRefresh();
      });
      inspectorBody.appendChild(field("Boolean states collection", states));
    }

    const outputs = document.createElement("div");
    outputs.className = "inspector-note";
    const companions = allNodes()
      .map(x => x.node)
      .filter(candidate =>
        candidate.dynamicOwnerId === node.id
      );
    outputs.innerHTML = "<strong>Typed Runtime Graph outputs</strong><br>" +
      [node, ...companions]
        .map(item => `${item.fieldName} (${item.valueType})`)
        .join("<br>");
    inspectorBody.appendChild(outputs);

    inspectorRendering = false;
    return true;
  }

  function hideInternalOutlineNodes() {
    const internal = allNodes()
      .map(x => x.node)
      .filter(node => node.dynamicInternal === true);
    if (!internal.length) return;

    const candidates = document.querySelectorAll(
      "[data-node-id], [data-id], [data-item-id], .tree-item, .outline-item, [draggable='true']"
    );
    for (const element of candidates) {
      const data = element.dataset || {};
      const directId = data.nodeId || data.id || data.itemId || "";
      const match = internal.some(node =>
        directId === node.id ||
        (element.textContent || "").includes(node.fieldName || "__never__")
      );
      if (match) element.hidden = true;
    }
  }

  function monitorText(monitorId) {
    if (!monitorId) return "";
    const graphNode = graphNodes().find(node => node.id === monitorId);
    const possible = [
      graphNode?.parameters?.runtimeValue,
      graphNode?.parameters?.displayValue,
      graphNode?.parameters?.previewValue,
      graphNode?.runtimeValue,
      graphNode?.displayValue
    ];
    for (const value of possible) {
      if (value != null && String(value) !== "") return String(value);
    }

    const element = document.querySelector(
      `[data-node-id="${CSS.escape(monitorId)}"]`
    );
    const output = element?.querySelector(
      "[data-runtime-value], .rml-graph-runtime-value, output, .runtime-value"
    );
    return String(
      output?.getAttribute("data-runtime-value") ||
      output?.textContent ||
      ""
    ).trim();
  }

  function splitLines(value) {
    return String(value || "")
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map(item => item.trim())
      .filter(item => item && item !== "Runtime value unavailable");
  }

  function runtimeBridgeChannelForDynamicSettings() {
    const namespaceName =
      String(
        state?.metadata?.namespaceName ||
        "YourModNamespace"
      ).trim() || "YourModNamespace";
    const className =
      String(
        state?.metadata?.className ||
        "YourMod"
      ).trim() || "YourMod";

    return `${namespaceName}.${className}`;
  }

  function runtimeBoundDynamicControls() {
    return allNodes()
      .map(entry => entry.node)
      .filter(node =>
        node?.dynamicSettingKind &&
        node?._rmlEditableCollectionSourceNodeId
      );
  }

  function runtimeBridgeNeeded() {
    if (runtimeBoundDynamicControls().length > 0) {
      return true;
    }

    return graphNodes().some(node =>
      node?.kind === "operator" &&
      node?.operatorId ===
        "collection.collectToList" &&
      (
        node?.parameters?.markAsEditable === true ||
        node?.parameters?.markAsEditable === "true" ||
        node?.parameters?.markAsEditable === 1
      )
    );
  }

  function currentRuntimeUiSignature() {
    const bridge =
      window.RMLRuntimeBridge;
    const channel =
      runtimeBridgeChannelForDynamicSettings();

    if (!bridge || !channel) {
      return "bridge-unavailable";
    }

    const bridgeState =
      bridge.getState?.(channel) || {};
    const records =
      runtimeBoundDynamicControls()
        .map(node => {
          const sourceId = String(
            node._rmlEditableCollectionSourceNodeId ||
            ""
          );
          const record =
            bridge.getValue?.(
              channel,
              `dynamic-source:${sourceId}`
            );

          return [
            String(node.id || ""),
            sourceId,
            String(record?.sequence || 0),
            String(record?.updatedAtUtc || ""),
            String(record?.display ?? ""),
            String(record?.value ?? "")
          ].join("\u001E");
        });

    return [
      channel,
      bridgeState.connected === true ? "1" : "0",
      bridgeState.active === true ? "1" : "0",
      String(bridgeState.sessionId || ""),
      String(bridgeState.valueCount || 0),
      ...records
    ].join("\u001F");
  }

  function refreshRuntimeBoundDynamicPreview() {
    const dialog =
      document.getElementById(
        "settings-preview-dialog"
      );

    if (
      !dialog?.open ||
      dialog.classList.contains(
        "rml-preview-color-open"
      )
    ) {
      return;
    }

    const existing =
      [...dialog.querySelectorAll(
        "[data-rml-dynamic-preview]"
      )];

    for (const element of existing) {
      element
        .querySelectorAll("select")
        .forEach(select => {
          try {
            select
              ._rmlUniversalCustomSelect
              ?.close?.(false);
          } catch {}
        });

      element.remove();
    }

    appendDynamicPreview();
  }

  function refreshRuntimeBoundDynamicUi() {
    const nextSignature =
      currentRuntimeUiSignature();

    if (
      nextSignature ===
      runtimeUiSignature
    ) {
      return;
    }

    runtimeUiSignature =
      nextSignature;

    if (!graphViewActive()) {
      renderDynamicInspector(true);
    }

    refreshRuntimeBoundDynamicPreview();
  }

  function scheduleRuntimeBoundDynamicUiRefresh() {
    clearTimeout(runtimeUiRefreshTimer);

    runtimeUiRefreshTimer =
      setTimeout(
        refreshRuntimeBoundDynamicUi,
        25
      );
  }

  function stopRuntimeBridgeSubscription() {
    try {
      runtimeBridgeUnsubscribe?.();
    } catch {}

    runtimeBridgeUnsubscribe = null;
    runtimeBridgeSubscribedChannel = "";
    runtimeUiSignature = "";
  }

  function ensureRuntimeBridgeSubscription() {
    const bridge =
      window.RMLRuntimeBridge;

    if (
      !runtimeBridgeNeeded() ||
      typeof bridge?.subscribe !==
        "function"
    ) {
      stopRuntimeBridgeSubscription();
      return;
    }

    const channel =
      runtimeBridgeChannelForDynamicSettings();

    if (!channel) {
      stopRuntimeBridgeSubscription();
      return;
    }

    if (
      runtimeBridgeUnsubscribe &&
      runtimeBridgeSubscribedChannel ===
        channel
    ) {
      return;
    }

    stopRuntimeBridgeSubscription();
    runtimeBridgeSubscribedChannel =
      channel;

    try {
      runtimeBridgeUnsubscribe =
        bridge.subscribe(
          channel,
          () => {
            scheduleRuntimeBoundDynamicUiRefresh();
          }
        );
    } catch (error) {
      runtimeBridgeUnsubscribe = null;
      runtimeBridgeSubscribedChannel = "";

      console.warn(
        "Dynamic settings could not subscribe to the runtime bridge.",
        error
      );

      return;
    }

    scheduleRuntimeBoundDynamicUiRefresh();
  }

  function scheduleRuntimeBridgeSubscriptionRefresh() {
    queueMicrotask(() => {
      ensureRuntimeBridgeSubscription();
      scheduleRuntimeBoundDynamicUiRefresh();
    });
  }

  function directEditableCollectionRuntimeItems(node) {
    const sourceId =
      String(
        node?._rmlEditableCollectionSourceNodeId ||
        ""
      );

    if (!sourceId) {
      return [];
    }

    const bridge =
      window.RMLRuntimeBridge;

    const record =
      bridge?.getValue?.(
        runtimeBridgeChannelForDynamicSettings(),
        `dynamic-source:${sourceId}`
      );

    const structuredValue =
      record?.value;

    if (Array.isArray(structuredValue)) {
      if (structuredValue.length === 0) {
        return [];
      }

      const primitiveItems =
        structuredValue.every(value =>
          value == null ||
          [
            "string",
            "number",
            "boolean",
            "bigint"
          ].includes(typeof value)
        );

      if (primitiveItems) {
        return structuredValue
          .map(value =>
            value == null
              ? "<null>"
              : String(value)
          )
          .filter(value =>
            value &&
            value !==
              "Runtime value unavailable"
          );
      }
    }

    const display = String(
      record?.display ??
      structuredValue ??
      ""
    ).trim();

    if (
      display === "[]" ||
      display === "{}"
    ) {
      return [];
    }

    return splitLines(display);
  }

  function controlOptions(node) {
    const directItems =
      node?._rmlEditableCollectionSourceNodeId
        ? directEditableCollectionRuntimeItems(
            node
          )
        : null;
    const labels = directItems ?? splitLines(
      monitorText(
        node.dynamicLabelMonitorId
      )
    );
    const values = directItems ?? splitLines(
      monitorText(
        node.dynamicValueMonitorId
      )
    );
    const count = Math.max(labels.length, values.length);
    const result = [];
    const seen = new Set();
    for (let index = 0; index < count; index += 1) {
      const label = labels[index] ?? values[index] ?? "";
      const value = values[index] ?? label;
      if (seen.has(value)) continue;
      seen.add(value);
      result.push({ label, value });
    }
    return result;
  }

  function visiblePreviewEntries() {
    const flattened =
      typeof flattenNodes === "function"
        ? flattenNodes(state?.nodes || [])
        : [];

    return flattened
      .filter(entry =>
        entry &&
        entry.node &&
        (
          !Array.isArray(entry.conditions) ||
          entry.conditions.every(condition =>
            settingsPreviewDraft
              ?.controllers?.[
                condition.controller.id
              ] ===
                condition.option.name
          )
        )
      )
      .map(entry => entry.node)
      .filter(node =>
        !(
          node?.kind === "setting" &&
          node.hidden === true &&
          !node.dynamicSettingKind
        )
      );
  }

  function insertDynamicPreviewBlock(
    host,
    block,
    node,
    visibleNodes
  ) {
    const currentIndex =
      visibleNodes.findIndex(candidate =>
        String(candidate?.id || "") ===
        String(node?.id || "")
      );

    if (currentIndex < 0) {
      host.appendChild(block);
      return;
    }

    for (
      let index = currentIndex + 1;
      index < visibleNodes.length;
      index += 1
    ) {
      const nextId =
        String(
          visibleNodes[index]?.id || ""
        );

      if (!nextId) {
        continue;
      }

      const nextElement =
        [...host.children].find(element =>
          element instanceof HTMLElement &&
          (
            element.dataset
              ?.previewNodeId ===
                nextId ||
            element.dataset
              ?.rmlDynamicPreview ===
                nextId ||
            element.dataset
              ?.rmlRuntimeDisplayPreview ===
                nextId
          )
        );

      if (nextElement) {
        host.insertBefore(
          block,
          nextElement
        );
        return;
      }
    }

    host.appendChild(block);
  }

  function dynamicPreviewChoiceItems(
    node,
    options
  ) {
    const items = [];

    if (node.dynamicAllowEmpty === true) {
      items.push({
        label: "(None)",
        value: ""
      });
    }

    for (const option of options) {
      items.push({
        label: String(
          option?.label ??
          option?.value ??
          ""
        ),
        value: String(
          option?.value ??
          option?.label ??
          ""
        )
      });
    }

    return items;
  }

  function setDynamicPreviewChoiceValue(
    node,
    value
  ) {
    const normalized = String(value ?? "");

    previewSelection.set(
      node.id,
      normalized
    );

    /*
     * Dynamic Preview selections use the same local draft as all ordinary
     * Preview editors. Saving the Preview therefore persists the visible
     * selection locally, but this path never calls the runtime bridge or the
     * generated Resonite configuration setter.
     */
    if (
      settingsPreviewDraft?.values &&
      typeof settingsPreviewDraft.values ===
        "object"
    ) {
      settingsPreviewDraft.values[
        node.id
      ] = normalized;
    }
  }

  function currentDynamicPreviewChoice(
    node,
    items
  ) {
    if (items.length === 0) {
      return {
        index: -1,
        item: null
      };
    }

    const requestedSelection =
      String(
        settingsPreviewDraft?.values?.[
          node.id
        ] ??
        previewSelection.get(node.id) ??
        node.defaultValue ??
        ""
      );

    let index = items.findIndex(
      item =>
        item.value ===
        requestedSelection
    );

    if (index < 0) {
      index = 0;
    }

    const item = items[index];

    setDynamicPreviewChoiceValue(
      node,
      item.value
    );

    return {
      index,
      item
    };
  }

  function appendDynamicPreview() {
    const previewDialog =
      document.getElementById(
        "settings-preview-dialog"
      );

    if (
      previewDialog?.classList.contains(
        "rml-preview-color-open"
      )
    ) {
      return;
    }

    const host = document.querySelector(
      ".rml-preview-form, #settings-preview-content, .settings-preview-content, .rml-preview-body"
    );

    if (!host) {
      return;
    }

    /*
     * Dynamic controls are hidden from app.js' ordinary setting renderer, but
     * they still belong to the exact same Configuration Outline ordering.
     * Use the same flattened/condition-filtered sequence as Preview and place
     * every dynamic row relative to the normal rows' stable node ids.
     */
    const visibleNodes =
      visiblePreviewEntries();

    const controls =
      visibleNodes.filter(node =>
        node?.dynamicSettingKind
      );

    if (!controls.length) {
      return;
    }

    for (const node of controls) {
      if (
        host.querySelector(
          `[data-rml-dynamic-preview="${CSS.escape(
            String(node.id)
          )}"]`
        )
      ) {
        continue;
      }

      const block =
        document.createElement("div");

      block.dataset.rmlDynamicPreview =
        String(node.id);

      block.dataset.previewNodeId =
        String(node.id);

      block.className =
        "rml-preview-setting rml-preview-dynamic-control";

      if (
        node.dynamicSettingKind ===
        KINDS.choice
      ) {
        block.classList.add(
          "rml-preview-dynamic-choice"
        );
      }

      const title =
        document.createElement("div");

      title.className =
        "rml-preview-label";

      title.textContent =
        node.keyName ||
        "Dynamic control";

      block.appendChild(title);

      const editor =
        document.createElement("div");

      editor.className =
        "rml-preview-editor";

      const options =
        controlOptions(node);

      if (
        node.dynamicSettingKind ===
        KINDS.choice
      ) {
        const items =
          dynamicPreviewChoiceItems(
            node,
            options
          );

        const switchControl =
          document.createElement("div");

        switchControl.className =
          "rml-preview-enum rml-preview-dynamic-choice-switch";

        const valueButton =
          document.createElement("button");

        valueButton.type = "button";
        valueButton.tabIndex = -1;
        valueButton.className =
          "rml-preview-control rml-preview-enum-value";
        valueButton.setAttribute(
          "aria-label",
          "Current value"
        );

        const previousButton =
          document.createElement("button");

        previousButton.type = "button";
        previousButton.className =
          "rml-preview-control rml-preview-enum-step";
        previousButton.textContent = "◀";
        previousButton.setAttribute(
          "aria-label",
          "Previous value"
        );

        const nextButton =
          document.createElement("button");

        nextButton.type = "button";
        nextButton.className =
          "rml-preview-control rml-preview-enum-step";
        nextButton.textContent = "▶";
        nextButton.setAttribute(
          "aria-label",
          "Next value"
        );

        let selection =
          currentDynamicPreviewChoice(
            node,
            items
          );

        const refreshSwitch = () => {
          valueButton.textContent =
            selection.item?.label ||
            "Runtime options unavailable";

          const canStep =
            items.length > 1;

          previousButton.disabled =
            !canStep;
          nextButton.disabled =
            !canStep;
        };

        const step = direction => {
          if (items.length <= 1) {
            return;
          }

          const nextIndex =
            (
              selection.index +
              direction +
              items.length
            ) % items.length;

          selection = {
            index: nextIndex,
            item: items[nextIndex]
          };

          setDynamicPreviewChoiceValue(
            node,
            selection.item.value
          );

          refreshSwitch();
        };

        previousButton.addEventListener(
          "click",
          () => step(-1)
        );

        nextButton.addEventListener(
          "click",
          () => step(1)
        );

        refreshSwitch();

        switchControl.append(
          valueButton,
          previousButton,
          nextButton
        );

        editor.appendChild(
          switchControl
        );
      } else if (
        node.dynamicSettingKind ===
        KINDS.action
      ) {
        for (const option of options) {
          const button =
            document.createElement(
              "button"
            );

          button.type = "button";
          button.className =
            "button secondary";
          button.textContent =
            `${option.label}  ${
              node.dynamicButtonLabel ||
              "Run"
            }`;

          editor.appendChild(button);
        }
      } else {
        const states =
          splitLines(
            monitorText(
              node.dynamicStateMonitorId
            )
          ).map(value =>
            /^(true|1|yes|on)$/i.test(
              value
            )
          );

        options.forEach(
          (option, index) => {
            const button =
              document.createElement(
                "button"
              );

            button.type = "button";
            button.className =
              "button secondary";

            let checked =
              states[index] === true;

            button.textContent =
              `${
                checked ? "☑" : "☐"
              }  ${option.label}`;

            button.addEventListener(
              "click",
              () => {
                checked = !checked;
                button.textContent =
                  `${
                    checked
                      ? "☑"
                      : "☐"
                  }  ${option.label}`;
              }
            );

            editor.appendChild(
              button
            );
          }
        );
      }

      block.appendChild(editor);

      insertDynamicPreviewBlock(
        host,
        block,
        node,
        visibleNodes
      );
    }
  }

  function csString(value) {
    return `"${String(value ?? "")
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\r/g, "\\r")
      .replace(/\n/g, "\\n")}"`;
  }

  function generatedControlNodes() {
    return allNodes()
      .map(x => x.node)
      .filter(node => node.dynamicSettingKind);
  }

  function configurationOutlineOrder(
    node
  ) {
    const index = allNodes()
      .findIndex(entry =>
        String(entry.node?.id || "") ===
        String(node?.id || "")
      );

    return index >= 0
      ? index
      : 2147483647;
  }

  function nodeById(nodeId) {
    return allNodes().find(x => x.node.id === nodeId)?.node || null;
  }

  function injectInterface(code, interfaceName) {
    if (code.includes(interfaceName)) return code;
    const className = String(state?.metadata?.className || "YourMod");
    const classStart = code.indexOf(`class ${className}`);
    if (classStart < 0) return code;
    const brace = code.indexOf("{", classStart);
    if (brace < 0) return code;
    const before = code.slice(0, brace).replace(/\s+$/, "");
    const after = code.slice(brace);
    return `${before},\n      ${interfaceName}\n${after}`;
  }

  function injectUsing(code, namespaceName) {
    const line = `using ${namespaceName};`;
    if (code.includes(line)) return code;
    const usingIndex = code.indexOf("using ");
    if (usingIndex < 0) return `${line}\n${code}`;
    return `${code.slice(0, usingIndex)}${line}\n${code.slice(usingIndex)}`;
  }

  function dynamicConfigurationKeyIdentifier(node) {
    return toPascalCase(
      node?.fieldName,
      "Setting"
    );
  }

  function dynamicProviderSource() {
    const controls = generatedControlNodes();
    if (!controls.length) return "";
    const graphClass = `${String(state?.metadata?.className || "YourMod")}NodeGraph`;
    const entries = [];

    controls.forEach(node => {
      const field =
        dynamicConfigurationKeyIdentifier(
          node
        );
      const order =
        configurationOutlineOrder(
          node
        );
      const labels = csString(node.dynamicLabelMonitorId || "");
      const values = csString(node.dynamicValueMonitorId || "");
      const sourceId =
        csString(
          node._rmlEditableCollectionSourceNodeId ||
          ""
        );
      const directSource =
        Boolean(
          node._rmlEditableCollectionSourceNodeId
        );
      const common = [
        `Id = ${csString(node.id)}`,
        `Name = ${csString(node.keyName || node.fieldName || "Dynamic setting")}`,
        `Description = ${csString(node.description || "")}`,
        `ConfigurationKey = ${field}`,
        `Order = ${order}`,
        directSource
          ? `GetLabels = () => ${graphClass}.GetDynamicCollectionItemsBySourceId(${sourceId})`
          : `GetLabels = () => RmlDynamicItems(${graphClass}.GetDisplayTextByMonitorId(${labels}, string.Empty))`,
        directSource
          ? `GetValues = () => ${graphClass}.GetDynamicCollectionItemsBySourceId(${sourceId})`
          : `GetValues = () => string.IsNullOrEmpty(${values}) ? RmlDynamicItems(${graphClass}.GetDisplayTextByMonitorId(${labels}, string.Empty)) : RmlDynamicItems(${graphClass}.GetDisplayTextByMonitorId(${values}, string.Empty))`
      ];

      if (node.dynamicSettingKind === KINDS.choice) {
        const preferredDefault =
          csString(
            node.defaultValue || ""
          );

        const valueSource =
          directSource
            ? `${graphClass}.GetDynamicCollectionItemsBySourceId(${sourceId})`
            : `string.IsNullOrEmpty(${values}) ? RmlDynamicItems(${graphClass}.GetDisplayTextByMonitorId(${labels}, string.Empty)) : RmlDynamicItems(${graphClass}.GetDisplayTextByMonitorId(${values}, string.Empty))`;

        entries.push(`new ModConfigurationDynamicChoice\n            {\n                ${common.join(",\n                ")},\n                AllowEmpty = ${node.dynamicAllowEmpty === true ? "true" : "false"},\n                GetSelectedValue = () => RmlDynamicSelectedValue(_configuration.GetValue(${field}), ${preferredDefault}, ${valueSource}, ${node.dynamicAllowEmpty === true ? "true" : "false"}),\n                SetSelectedValue = value => _configuration.Set(${field}, value ?? string.Empty)\n            }`);
      }

      if (node.dynamicSettingKind === KINDS.action) {
        const counter = nodeById(node.dynamicCounterNodeId);
        if (!counter) return;
        const counterField =
          dynamicConfigurationKeyIdentifier(
            counter
          );
        entries.push(`new ModConfigurationDynamicActionList\n            {\n                ${common.join(",\n                ")},\n                ButtonLabel = ${csString(node.dynamicButtonLabel || "Run")},\n                Invoke = value =>\n                {\n                    _configuration.Set(${field}, value ?? string.Empty);\n                    _configuration.Set(${counterField}, _configuration.GetValue(${counterField}) + 1);\n                }\n            }`);
      }

      if (node.dynamicSettingKind === KINDS.toggle) {
        const counter = nodeById(node.dynamicCounterNodeId);
        const stateNode = nodeById(node.dynamicStateNodeId);
        if (!counter || !stateNode) return;
        const counterField =
          dynamicConfigurationKeyIdentifier(
            counter
          );
        const stateField =
          dynamicConfigurationKeyIdentifier(
            stateNode
          );
        const states = csString(node.dynamicStateMonitorId || "");
        entries.push(`new ModConfigurationDynamicToggleList\n            {\n                ${common.join(",\n                ")},\n                GetStates = () => RmlDynamicBools(${graphClass}.GetDisplayTextByMonitorId(${states}, string.Empty)),\n                SetState = (value, state) =>\n                {\n                    _configuration.Set(${field}, value ?? string.Empty);\n                    _configuration.Set(${stateField}, state);\n                    _configuration.Set(${counterField}, _configuration.GetValue(${counterField}) + 1);\n                }\n            }`);
      }
    });

    return `\n    // RML_DYNAMIC_SETTINGS_COLLECTIONS_V1\n    public System.Collections.Generic.IReadOnlyList<ModConfigurationDynamicControl>\n        GetDynamicSettings()\n    {\n        return new ModConfigurationDynamicControl[]\n        {\n            ${entries.join(",\n            ")}\n        };\n    }\n\n    private static System.Collections.Generic.IReadOnlyList<string>\n        RmlDynamicItems(string text)\n    {\n        return (text ?? string.Empty)\n            .Replace("\\r\\n", "\\n", System.StringComparison.Ordinal)\n            .Replace('\\r', '\\n')\n            .Split('\\n', System.StringSplitOptions.None)\n            .Where(value =>\n                !string.IsNullOrWhiteSpace(value) &&\n                !string.Equals(value, "Runtime value unavailable", System.StringComparison.Ordinal))\n            .ToArray();\n    }\n\n    private static string\n        RmlDynamicSelectedValue(\n            string current,\n            string preferredDefault,\n            System.Collections.Generic.IReadOnlyList<string> values,\n            bool allowEmpty)\n    {\n        values ??= System.Array.Empty<string>();\n\n        if (!string.IsNullOrEmpty(current) && values.Contains(current))\n            return current;\n\n        if (!string.IsNullOrEmpty(preferredDefault) && values.Contains(preferredDefault))\n            return preferredDefault;\n\n        if (!allowEmpty && values.Count > 0)\n            return values[0];\n\n        return string.Empty;\n    }\n\n    private static System.Collections.Generic.IReadOnlyList<bool>\n        RmlDynamicBools(string text)\n    {\n        return RmlDynamicItems(text)\n            .Select(value =>\n                string.Equals(value, "true", System.StringComparison.OrdinalIgnoreCase) ||\n                string.Equals(value, "1", System.StringComparison.OrdinalIgnoreCase) ||\n                string.Equals(value, "yes", System.StringComparison.OrdinalIgnoreCase) ||\n                string.Equals(value, "on", System.StringComparison.OrdinalIgnoreCase))\n            .ToArray();\n    }\n`;
  }

  function injectDynamicProvider(code) {
    if (typeof code !== "string" ||
        code.includes("RML_DYNAMIC_SETTINGS_COLLECTIONS_V1")) {
      return code;
    }
    if (!generatedControlNodes().length) return code;

    code = injectUsing(code, "System.Collections.Generic");
    code = injectInterface(
      code,
      "IModConfigurationDynamicSettingsProvider"
    );
    const source = dynamicProviderSource();
    const lastBrace = code.lastIndexOf("}");
    if (lastBrace < 0) return code;
    return `${code.slice(0, lastBrace)}${source}\n${code.slice(lastBrace)}`;
  }

  function wrapGenerators() {
    if (typeof generateCode === "function" &&
        !generateCode.__rmlDynamicWrapped) {
      const base = generateCode;
      const wrapped = function(...args) {
        normalizeAll();
        return injectDynamicProvider(
          base.apply(this, args)
        );
      };
      wrapped.__rmlDynamicWrapped = true;
      generateCode = wrapped;
    }

    for (const name of [
      "generateProjectFiles",
      "buildGeneratedProjectFiles",
      "getGeneratedProjectFiles"
    ]) {
      const fn = window[name];
      if (typeof fn !== "function" || fn.__rmlDynamicWrapped) continue;
      const wrapped = function(...args) {
        const result = fn.apply(this, args);
        const patch = value => {
          if (Array.isArray(value)) {
            for (const file of value) {
              const fileName = String(file?.name || file?.fileName || "");
              if (/\.cs$/i.test(fileName) && !/\.NodeGraph\.cs$/i.test(fileName)) {
                if (typeof file.content === "string") file.content = injectDynamicProvider(file.content);
                if (typeof file.text === "string") file.text = injectDynamicProvider(file.text);
              }
            }
          }
          return value;
        };
        return result?.then ? result.then(patch) : patch(result);
      };
      wrapped.__rmlDynamicWrapped = true;
      window[name] = wrapped;
    }
  }

  function wrapUi() {
    if (typeof renderPreview === "function" &&
        !renderPreview.__rmlDynamicWrapped) {
      const basePreview = renderPreview;
      const wrappedPreview = function(...args) {
        const result = basePreview.apply(this, args);
        queueMicrotask(appendDynamicPreview);
        return result;
      };
      wrappedPreview.__rmlDynamicWrapped = true;
      renderPreview = wrappedPreview;
    }

    if (typeof renderSettingsPreview === "function" &&
        !renderSettingsPreview.__rmlDynamicWrapped) {
      const baseSettingsPreview = renderSettingsPreview;
      const wrappedSettingsPreview = function(...args) {
        const result = baseSettingsPreview.apply(this, args);
        queueMicrotask(appendDynamicPreview);
        return result;
      };
      wrappedSettingsPreview.__rmlDynamicWrapped = true;
      renderSettingsPreview = wrappedSettingsPreview;
    }

    if (typeof renderInspector === "function" &&
        !renderInspector.__rmlDynamicWrapped) {
      const base = renderInspector;
      const wrapped = function(...args) {
        const result = base.apply(this, args);
        queueMicrotask(() => renderDynamicInspector(true));
        return result;
      };
      wrapped.__rmlDynamicWrapped = true;
      renderInspector = wrapped;
    }

    for (const name of ["renderPreview", "renderSettingsPreview"] ) {
      if (typeof window[name] !== "function" || window[name].__rmlDynamicWrapped) continue;
      const base = window[name];
      const wrapped = function(...args) {
        const result = base.apply(this, args);
        queueMicrotask(appendDynamicPreview);
        return result;
      };
      wrapped.__rmlDynamicWrapped = true;
      window[name] = wrapped;
    }
  }

  function installObserver() {
    if (observer) return;
    observer = new MutationObserver(() => {
      installPalette();
      hideInternalOutlineNodes();
      renderDynamicInspector();
      ensureRuntimeBridgeSubscription();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function boot() {
    if (typeof state === "undefined" || !document.body) {
      if (++bootAttempts < 600) setTimeout(boot, 25);
      return;
    }
    normalizeAll();
    wrapGenerators();
    wrapUi();
    installPalette();
    hideInternalOutlineNodes();
    ensureRuntimeBridgeSubscription();
    installObserver();
    queueMicrotask(() => {
      try {
        if (!graphViewActive()) {
          renderPalette?.();
        }
      } catch {}
      installPalette();
      scheduleRuntimeBoundDynamicUiRefresh();
    });
  }

  window.addEventListener(
    "rml-runtime-bridge",
    scheduleRuntimeBoundDynamicUiRefresh
  );

  document.addEventListener(
    "rml-builder:rendered",
    scheduleRuntimeBridgeSubscriptionRefresh
  );

  document.addEventListener(
    "input",
    event => {
      if (
        event.target?.id ===
          "namespace-name" ||
        event.target?.id ===
          "class-name"
      ) {
        scheduleRuntimeBridgeSubscriptionRefresh();
      }
    },
    true
  );

  boot();
})();


(() => {
  "use strict";

  const VERSION = 7;

  if (
    (window.__RMLCollectionEditableBridgeVersion || 0) >=
    VERSION
  ) {
    return;
  }

  window.__RMLCollectionEditableBridgeVersion =
    VERSION;

  let refreshTimer = 0;

  const EDITABLE_KINDS = Object.freeze({
    choice: "choice"
  });

  function editableAllNodes() {
    const result = [];

    const visit = nodes => {
      for (const node of Array.isArray(nodes) ? nodes : []) {
        if (!node || typeof node !== "object") continue;

        result.push({
          node,
          parent: nodes
        });

        for (const option of
          Array.isArray(node.options)
            ? node.options
            : []) {
          visit(option?.children);
        }

        visit(node.children);
      }
    };

    visit(state?.nodes);
    return result;
  }

  function editableSanitizeIdentifier(
    value,
    fallback
  ) {
    let result =
      String(value || "")
        .replace(/[^A-Za-z0-9_]/g, "_")
        .replace(/^[^A-Za-z_]+/, "");

    if (!result) result = fallback;
    return result;
  }

  function editableUniqueFieldName(base) {
    const names =
      new Set(
        editableAllNodes()
          .map(({ node }) =>
            String(node.fieldName || "")
          )
      );

    const safeBase =
      editableSanitizeIdentifier(
        base,
        "DynamicValue"
      );

    let candidate = safeBase;
    let suffix = 2;

    while (names.has(candidate)) {
      candidate = `${safeBase}${suffix++}`;
    }

    return candidate;
  }

  function editableActiveNodeArray() {
    const active =
      String(
        state?.activeContainerId ||
        "root"
      );

    if (active === "root") {
      return state.nodes;
    }

    for (const { node } of editableAllNodes()) {
      for (const option of
        Array.isArray(node.options)
          ? node.options
          : []) {
        if (String(option.id) === active) {
          option.children ||= [];
          return option.children;
        }
      }

      if (String(node.id) === active) {
        node.children ||= [];
        return node.children;
      }
    }

    return state.nodes;
  }

  function editableId(prefix = "dynamic") {
    return `${prefix}-${Date.now().toString(36)}-${Math.random()
      .toString(36).slice(2, 9)}`;
  }

  function editableMakeSetting(
    valueType,
    fieldName,
    keyName,
    defaultValue
  ) {
    return {
      id: editableId("setting"),
      kind: "setting",
      valueType,
      fieldName,
      keyName,
      description:
        "Generated dynamic RML menu state.",
      defaultValue:
        String(defaultValue ?? ""),
      hidden: true,
      validatorMode: "none",
      customValidator: "",
      useSlider: false,
      minimum: "0",
      maximum:
        valueType === "bool"
          ? "1"
          : "100",
      enumName: "",
      enumOptions: [],
      reaction: "saved",
      dynamicInternal: true
    };
  }

  function graphState() {
    return (
      window.RMLDynamicGraphHost?.getState?.() ||
      state?.extensions?.typedNodeGraph ||
      null
    );
  }

  function graphViewActive() {
    return Boolean(
      graphState()?.active === true ||
      document.body.classList.contains(
        "rml-node-graph-mode"
      )
    );
  }

  function editableSources() {
    const graph = graphState();

    if (!graph || !Array.isArray(graph.nodes)) {
      return [];
    }

    return graph.nodes.filter(
      node =>
        node?.kind === "operator" &&
        node?.operatorId ===
          "collection.collectToList" &&
        (
          node?.parameters?.markAsEditable === true ||
          node?.parameters?.markAsEditable === "true" ||
          node?.parameters?.markAsEditable === 1
        )
    );
  }

  function alreadyMaterializedSourceIds() {
    return new Set(
      editableAllNodes()
        .map(entry => entry.node)
        .filter(
          node =>
            node?._rmlEditableCollectionSourceNodeId
        )
        .map(node =>
          String(
            node._rmlEditableCollectionSourceNodeId
          )
        )
    );
  }

  function sourceLabel(source) {
    return (
      String(
        source?.parameters?.editableLabel ||
        source?.label ||
        "Dynamic Choice"
      ).trim() ||
      "Dynamic Choice"
    );
  }

  function createBoundControlRecord(source) {
    const label = sourceLabel(source);
    const fieldName =
      editableUniqueFieldName(
        `Dynamic${editableSanitizeIdentifier(
          label,
          "Choice"
        )}`
      );

    const control =
      editableMakeSetting(
        "string",
        fieldName,
        label,
        ""
      );

    control.dynamicInternal = false;
    control.dynamicSettingKind =
      EDITABLE_KINDS.choice;
    control.description =
      "Runtime collection-backed enum-like RML setting.";
    control.reaction =
      "startup-saved";
    control.dynamicAllowEmpty = false;
    control.dynamicLabelMonitorId = "";
    control.dynamicValueMonitorId = "";
    control.dynamicStateMonitorId = "";
    control._rmlEditableCollectionSourceNodeId =
      source.id;
    control._rmlEditableCollectionLastSourceLabel =
      label;
    control._rmlDynamicLabelCustomized = false;

    return control;
  }

  function insertControlAt(
    control,
    containerId,
    insertionIndex
  ) {
    const targetContainer =
      String(
        containerId ||
        state.activeContainerId ||
        "root"
      );

    if (
      Number.isFinite(
        Number(insertionIndex)
      ) &&
      typeof insertIntoContainerAt ===
        "function"
    ) {
      const insertion =
        insertIntoContainerAt(
          state.nodes,
          targetContainer,
          control,
          Math.max(
            0,
            Math.trunc(
              Number(insertionIndex)
            )
          )
        );

      if (insertion?.inserted) {
        state.nodes = insertion.nodes;
        state.activeContainerId =
          targetContainer;
        return true;
      }
    }

    if (
      typeof insertIntoContainer ===
        "function"
    ) {
      const insertion =
        insertIntoContainer(
          state.nodes,
          targetContainer,
          control
        );

      if (insertion?.inserted) {
        state.nodes = insertion.nodes;
        state.activeContainerId =
          targetContainer;
        return true;
      }
    }

    editableActiveNodeArray().push(control);
    return true;
  }

  function migrateEditableCollectionDirectBindings() {
    let changed = false;

    const sourceById =
      new Map(
        editableSources().map(source => [
          String(source.id || ""),
          source
        ])
      );

    const validSourceIds =
      new Set(
        sourceById.keys()
      );

    const staleControlIds =
      new Set();

    for (const { node } of editableAllNodes()) {
      const sourceId =
        String(
          node?._rmlEditableCollectionSourceNodeId ||
          ""
        );

      if (!sourceId) {
        continue;
      }

      /*
       * Mark as Editable is authoritative.
       * If the Collect To List source is no longer editable (or was deleted),
       * its materialized Dynamic Choice must not remain in Configuration Outline.
       */
      if (!validSourceIds.has(sourceId)) {
        staleControlIds.add(
          String(node.id || "")
        );

        if (node.dynamicCounterNodeId) {
          staleControlIds.add(
            String(node.dynamicCounterNodeId)
          );
        }

        if (node.dynamicStateNodeId) {
          staleControlIds.add(
            String(node.dynamicStateNodeId)
          );
        }

        continue;
      }

      const source =
        sourceById.get(sourceId);
      const nextSourceLabel =
        sourceLabel(source);
      const previousSourceLabel =
        String(
          node
            ._rmlEditableCollectionLastSourceLabel ||
          ""
        );
      const currentLabel =
        String(node.keyName || "");
      const autoManagedLabel =
        node._rmlDynamicLabelCustomized !== true &&
        (
          !currentLabel ||
          currentLabel === "Dynamic Choice" ||
          (
            previousSourceLabel &&
            currentLabel ===
              previousSourceLabel
          )
        );

      if (
        autoManagedLabel &&
        currentLabel !== nextSourceLabel
      ) {
        node.keyName = nextSourceLabel;
        changed = true;
      }

      if (
        previousSourceLabel !==
        nextSourceLabel
      ) {
        node._rmlEditableCollectionLastSourceLabel =
          nextSourceLabel;
        changed = true;
      }

      if (
        node.dynamicLabelMonitorId ||
        node.dynamicValueMonitorId
      ) {
        node.dynamicLabelMonitorId = "";
        node.dynamicValueMonitorId = "";
        changed = true;
      }

    }

    if (staleControlIds.size > 0) {
      const removeStale = nodes => {
        if (!Array.isArray(nodes)) {
          return;
        }

        for (
          let index = nodes.length - 1;
          index >= 0;
          index -= 1
        ) {
          const candidate = nodes[index];

          if (
            staleControlIds.has(
              String(candidate?.id || "")
            )
          ) {
            nodes.splice(index, 1);
            changed = true;
            continue;
          }

          for (const option of
            Array.isArray(candidate?.options)
              ? candidate.options
              : []) {
            removeStale(option?.children);
          }

          removeStale(candidate?.children);
        }
      };

      removeStale(state.nodes);

      if (
        staleControlIds.has(
          String(state.selectedId || "")
        )
      ) {
        state.selectedId = null;
      }
    }

    if (changed) {
      try { saveState?.(); } catch {}

      if (!graphViewActive()) {
        try { renderAll?.(); } catch {}
      }

      try {
        window.RMLNodeGraphBridge
          ?.requestGeneratedOutputRefresh?.();
      } catch {}

      schedulePaletteRefresh();
    }

    return changed;
  }

  function scheduleEditableCollectionDirectBindingMigration() {
    clearTimeout(
      window.__rmlEditableCollectionBindTimer || 0
    );

    window.__rmlEditableCollectionBindTimer =
      setTimeout(
        migrateEditableCollectionDirectBindings,
        50
      );
  }

  function createFromSource(
    sourceId,
    containerId = null,
    insertionIndex = null
  ) {
    const source =
      editableSources().find(
        node =>
          String(node.id) ===
          String(sourceId)
      );

    if (!source) {
      return null;
    }

    const existing =
      editableAllNodes()
        .map(entry => entry.node)
        .find(
          node =>
            String(
              node?._rmlEditableCollectionSourceNodeId ||
              ""
            ) === String(source.id)
        );

    if (existing) {
      state.selectedId = existing.id;

      if (!graphViewActive()) {
        try { renderAll?.(); } catch {}
      }

      return existing;
    }

    const control =
      createBoundControlRecord(source);

    insertControlAt(
      control,
      containerId,
      insertionIndex
    );

    control.dynamicLabelMonitorId = "";
    control.dynamicValueMonitorId = "";

    state.selectedId = control.id;

    try { saveState?.(); } catch {}

    if (!graphViewActive()) {
      try { renderAll?.(); } catch {}
    }

    try {
      window.RMLNodeGraphBridge
        ?.requestGeneratedOutputRefresh?.();
    } catch {}

    schedulePaletteRefresh();

    return control;
  }

  function paletteList() {
    const core =
      document.querySelector(
        '#palette-content [data-palette-group="Core"] .palette-list'
      );

    return core || null;
  }

  function removeEditablePaletteButtons() {
    document
      .querySelectorAll(
        "[data-rml-editable-collection-palette]"
      )
      .forEach(element =>
        element.remove()
      );
  }

  function installEditablePalette() {
    const existing =
      [...document.querySelectorAll(
        "[data-rml-editable-collection-palette]"
      )];

    if (graphViewActive()) {
      if (existing.length) {
        existing.forEach(element =>
          element.remove()
        );
      }
      return;
    }

    const host = paletteList();

    if (!host) {
      return;
    }

    const used =
      alreadyMaterializedSourceIds();

    const desired =
      editableSources()
        .filter(
          source =>
            !used.has(String(source.id))
        )
        .map(source => ({
          source,
          id: String(source.id),
          label: sourceLabel(source)
        }));

    const current =
      existing.map(button => ({
        id: String(
          button.dataset
            .rmlEditableCollectionSource ||
          ""
        ),
        label: String(
          button.querySelector("strong")
            ?.textContent ||
          ""
        ).replace(/^DYN\s*·\s*/, "")
      }));

    const unchanged =
      current.length === desired.length &&
      current.every(
        (entry, index) =>
          entry.id === desired[index].id &&
          entry.label ===
            desired[index].label &&
          existing[index].parentElement ===
            host
      );

    if (unchanged) {
      return;
    }

    existing.forEach(element =>
      element.remove()
    );

    const enumButton =
      host.querySelector(
        '[data-palette="enum"]'
      );
    const insertionAnchor =
      enumButton?.nextSibling || null;

    for (const entry of desired) {
      const source = entry.source;
      const button =
        document.createElement(
          "button"
        );

      button.type = "button";
      button.draggable = true;
      button.className =
        "palette-item";
      button.dataset
        .rmlEditableCollectionPalette =
        "true";
      button.dataset
        .rmlEditableCollectionSource =
        entry.id;

      const badge =
        document.createElement(
          "span"
        );
      badge.textContent = "DYN";

      const title =
        document.createElement(
          "strong"
        );
      title.textContent =
        `DYN · ${entry.label}`;

      const plus =
        document.createElement("b");
      plus.textContent = "＋";

      button.append(
        badge,
        title,
        plus
      );

      button.title =
        "Runtime collection-backed dynamic enum. Drag it into the Configuration Outline to create the setting.";

      button.addEventListener(
        "click",
        () => {
          createFromSource(
            source.id,
            state.activeContainerId,
            null
          );
        }
      );

      button.addEventListener(
        "dragstart",
        event => {
          try {
            beginDragScrolling?.(
              event
            );
          } catch {}

          event.dataTransfer.setData(
            "application/x-rml-dynamic-editable",
            String(source.id)
          );
          event.dataTransfer.effectAllowed =
            "copy";
        }
      );

      button.addEventListener(
        "dragend",
        () => {
          try {
            finishDragInteraction?.();
          } catch {}
        }
      );

      if (enumButton) {
        host.insertBefore(
          button,
          insertionAnchor
        );
      } else {
        host.appendChild(button);
      }
    }
  }

  function schedulePaletteRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer =
      setTimeout(
        installEditablePalette,
        20
      );
  }

  const observer =
    new MutationObserver(
      schedulePaletteRefresh
    );

  observer.observe(
    document.body,
    {
      childList: true,
      subtree: true
    }
  );

  window.addEventListener(
    "rml-dynamic-graph-commit",
    schedulePaletteRefresh
  );

  window.addEventListener(
    "rml-dynamic-graph-commit",
    scheduleEditableCollectionDirectBindingMigration
  );

  window.addEventListener(
    "rml-api-node-factory-ready",
    scheduleEditableCollectionDirectBindingMigration
  );

  window.addEventListener(
    "rml-dynamic-outline-commit",
    schedulePaletteRefresh
  );

  document.addEventListener(
    "rml-builder:rendered",
    schedulePaletteRefresh
  );

  document.addEventListener(
    "rml-builder:rendered",
    scheduleEditableCollectionDirectBindingMigration
  );

  document.addEventListener(
    "change",
    schedulePaletteRefresh,
    true
  );

  Object.defineProperty(
    window,
    "RMLDynamicSettingsBridge",
    {
      value: Object.freeze({
        version: VERSION,
        createFromSource,
        refreshPalette:
          installEditablePalette
      }),
      writable: false,
      enumerable: false,
      configurable: true
    }
  );

  setTimeout(
    () => {
      installEditablePalette();
    },
    50
  );
})();
