(() => {
  "use strict";

  if (window.RMLBuilderProfilePresentation?.version >= 1) {
    return;
  }

  const RML_BUILDER_PROFILE_STORAGE_KEY = "rml-builder-resonite-profile-v1";
  const RML_BUILDER_PROFILE_AVATAR_MAX_BYTES = 384 * 1024;
  const RML_BUILDER_PROFILE_AVATAR_DATA_URL_MAX_CHARACTERS =
    Math.ceil(RML_BUILDER_PROFILE_AVATAR_MAX_BYTES / 3) * 4 + 96;
  const RML_BUILDER_PROFILE_FETCH_FAILED = Symbol(
    "rml-builder-profile-fetch-failed"
  );
  let rmlBuilderProfilePresentation = null;
  let rmlBuilderProfileSyncPromise = null;
  let rmlBuilderProfileSyncInstalled = false;
  let rmlBuilderProfileScannerPort = 0;
  let rmlBuilderProfileRequestedPort = 0;
  let rmlBuilderProfileRequestRevision = 0;
  let rmlBuilderProfileRenderRevision = 0;

  function normalizeRmlBuilderProfileAvatarDataUrl(value) {
    const dataUrl =
      typeof value === "string"
        ? value.trim()
        : "";
    if (
      !dataUrl ||
      dataUrl.length > RML_BUILDER_PROFILE_AVATAR_DATA_URL_MAX_CHARACTERS
    ) {
      return "";
    }
    const match = dataUrl.match(
      /^data:image\/(?:png|jpe?g|webp|gif|avif);base64,([a-z0-9+/]*={0,2})$/i
    );
    if (!match) return "";
    const payload = match[1];
    const padding = payload.endsWith("==")
      ? 2
      : payload.endsWith("=")
        ? 1
        : 0;
    const byteLength =
      Math.floor(payload.length * 3 / 4) - padding;
    return byteLength >= 0 && byteLength <= RML_BUILDER_PROFILE_AVATAR_MAX_BYTES
      ? dataUrl
      : "";
  }

  function normalizeRmlBuilderProfile(profile) {
    if (!profile || typeof profile !== "object") return null;
    const displayName =
      typeof profile.displayName === "string"
        ? profile.displayName.trim()
        : "";
    const userId =
      typeof profile.userId === "string"
        ? profile.userId.trim()
        : "";
    const avatarUrl =
      typeof profile.avatarUrl === "string"
        ? profile.avatarUrl.trim()
        : "";
    const avatarSource =
      typeof profile.avatarSource === "string"
        ? profile.avatarSource.trim()
        : "";
    const avatarDataUrl = normalizeRmlBuilderProfileAvatarDataUrl(
      profile.avatarDataUrl
    );
    if (!displayName && !userId && !avatarUrl && !avatarDataUrl) {
      return null;
    }
    return {
      displayName: displayName || null,
      userId: userId || null,
      avatarUrl: avatarUrl || null,
      avatarSource: avatarSource || null,
      avatarDataUrl: avatarDataUrl || null
    };
  }

  function current() {
    return rmlBuilderProfilePresentation
      ? Object.freeze({ ...rmlBuilderProfilePresentation })
      : null;
  }

  function loadRmlBuilderProfilePresentation() {
    try {
      rmlBuilderProfilePresentation = normalizeRmlBuilderProfile(
        JSON.parse(localStorage.getItem(RML_BUILDER_PROFILE_STORAGE_KEY) || "null")
      );
    } catch {
      rmlBuilderProfilePresentation = null;
    }
    return current();
  }

  function saveRmlBuilderProfilePresentation(profile) {
    const normalized = normalizeRmlBuilderProfile(profile);
    if (!normalized) return false;
    const before = rmlBuilderProfilePresentation
      ? JSON.stringify(rmlBuilderProfilePresentation)
      : "";
    const after = JSON.stringify(normalized);
    rmlBuilderProfilePresentation = normalized;
    if (before === after) return false;
    try {
      localStorage.setItem(RML_BUILDER_PROFILE_STORAGE_KEY, after);
    } catch {}
    return true;
  }

  function renderRmlBuilderProfilePresentation(profile = rmlBuilderProfilePresentation) {
    const normalized = normalizeRmlBuilderProfile(profile);
    const kicker = document.getElementById(
      "builder-profile-kicker"
    );
    const displayName = normalized?.displayName || "";
    if (kicker) {
      kicker.textContent =
        displayName ||
        window.RMLI18n.t(
          "index.text.da6bafbab43a"
        );
    }
    const topName = document.getElementById(
      "top-builder-profile-name"
    );
    const topButton = document.getElementById(
      "project-manager"
    );
    const defaultTopName = window.RMLI18n.t(
      "index.text.a325933df99a"
    );
    const defaultTopLabel = window.RMLI18n.t(
      "index.aria_label.5c7e41ca0332"
    );
    if (topName) {
      topName.textContent = displayName || defaultTopName;
    }
    if (topButton) {
      const accessibleLabel = displayName
        ? `${displayName}. ${defaultTopLabel}`
        : defaultTopLabel;
      topButton.setAttribute(
        "aria-label",
        accessibleLabel
      );
      topButton.title = accessibleLabel;
    }

    let url =
      normalized?.avatarDataUrl ||
      normalized?.avatarUrl ||
      "";
    try {
      const candidate = new URL(url, window.location.href);
      if (
        !normalized?.avatarDataUrl &&
        (
          candidate.origin !== window.location.origin ||
          candidate.pathname !== "/rml-scanner-avatar" ||
          Number(candidate.searchParams.get("port")) !== rmlBuilderProfileScannerPort
        )
      ) {
        url = "";
      }
    } catch {
      url = "";
    }
    const targets = [
      document.getElementById(
        "builder-profile-avatar-image"
      ),
      document.getElementById(
        "top-builder-profile-avatar-image"
      )
    ].filter(Boolean);
    const showFallback = target => {
      const slot = target.parentElement;
      target.hidden = true;
      target.removeAttribute("src");
      slot?.classList.remove("has-profile-image");
    };
    const renderRevision = ++rmlBuilderProfileRenderRevision;
    if (!(url && /^(https?:|data:image\/)/i.test(url))) {
      for (const target of targets) {
        showFallback(target);
      }
      return;
    }
    if (
      targets.length > 0 &&
      targets.every(target =>
        target.getAttribute("src") === url &&
        !target.hidden &&
        target.parentElement?.classList.contains(
          "has-profile-image"
        )
      )
    ) {
      return;
    }
    const preload = new Image();
    preload.decoding = "async";
    preload.onload = async () => {
      try {
        await preload.decode?.();
      } catch {}
      const activeProfile = normalizeRmlBuilderProfile(rmlBuilderProfilePresentation);
      const currentUrl =
        activeProfile?.avatarDataUrl ||
        activeProfile?.avatarUrl ||
        "";
      if (
        renderRevision !== rmlBuilderProfileRenderRevision ||
        currentUrl !== url
      ) {
        return;
      }
      for (const target of targets) {
        const slot = target.parentElement;
        target.src = url;
        target.hidden = false;
        slot?.classList.add("has-profile-image");
      }
    };
    preload.onerror = () => {};
    preload.src = url;
  }

  async function fetchRmlBuilderProfileJson(
    url,
    { optional = false } = {}
  ) {
    const controller = new AbortController();
    try {
      const response = await fetch(url, {
        cache: "no-store",
        credentials: "omit",
        headers: { Accept: "application/json" },
        mode: "cors",
        redirect: "error",
        signal: controller.signal
      });
      if (!response.ok) {
        if (!optional) {
          console.error(
            `[RML BUILDER INTERNAL FAILURE] The selected scanner profile endpoint returned HTTP ${response.status} ${response.statusText}.`
          );
        }
        return RML_BUILDER_PROFILE_FETCH_FAILED;
      }
      return await response.json();
    } catch (error) {
      if (!optional) {
        console.error(
          "[RML BUILDER INTERNAL FAILURE] A profile request for the scanner selected by the health sweep failed.",
          error
        );
      }
      return RML_BUILDER_PROFILE_FETCH_FAILED;
    } finally {
    }
  }

  async function fetchRmlBuilderProfileAvatarDataUrl(url, port) {
    let candidate;
    try {
      candidate = new URL(url, window.location.href);
    } catch {
      return null;
    }
    const directScannerOrigin =
      `http://127.0.0.1:${port}`;
    const sameOriginBridge =
      candidate.origin === window.location.origin &&
      candidate.pathname === "/rml-scanner-avatar" &&
      Number(candidate.searchParams.get("port")) === port;
    const directScannerAvatar =
      candidate.origin === directScannerOrigin &&
      candidate.pathname === "/profile/avatar" &&
      !candidate.search;
    if (!sameOriginBridge && !directScannerAvatar) {
      console.error(
        "[RML BUILDER INTERNAL FAILURE] The selected scanner profile returned an avatar outside its same-origin bridge contract."
      );
      return null;
    }

    const controller = new AbortController();
    try {
      const response = await fetch(candidate.href, {
        cache: "no-store",
        credentials: sameOriginBridge
          ? "same-origin"
          : "omit",
        headers: { Accept: "image/*" },
        mode: sameOriginBridge
          ? "same-origin"
          : "cors",
        redirect: "error",
        signal: controller.signal
      });
      if (!response.ok) return null;
      const contentType = String(
        response.headers.get("content-type") || ""
      ).split(";", 1)[0].trim().toLowerCase();
      if (
        !/^image\/(?:png|jpe?g|webp|gif|avif)$/.test(
          contentType
        )
      ) {
        console.error(
          "[RML BUILDER INTERNAL FAILURE] The selected scanner avatar bridge returned a non-image response."
        );
        return null;
      }
      const advertisedLength = Number(
        response.headers.get("content-length") || 0
      );
      if (advertisedLength > RML_BUILDER_PROFILE_AVATAR_MAX_BYTES) {
        return null;
      }
      const blob = await response.blob();
      if (blob.size < 1 || blob.size > RML_BUILDER_PROFILE_AVATAR_MAX_BYTES) {
        return null;
      }
      const dataUrl = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(
          typeof reader.result === "string"
            ? reader.result
            : ""
        );
        reader.onerror = () => resolve("");
        reader.onabort = () => resolve("");
        reader.readAsDataURL(blob);
      });
      const normalized = normalizeRmlBuilderProfileAvatarDataUrl(dataUrl);
      if (!normalized) return null;
      const decoded = await new Promise(resolve => {
        const image = new Image();
        image.decoding = "async";
        image.onload = async () => {
          try {
            await image.decode?.();
          } catch {}
          resolve(
            Number(image.naturalWidth) > 0 &&
            Number(image.naturalHeight) > 0
          );
        };
        image.onerror = () => resolve(false);
        image.src = normalized;
      });
      return decoded ? normalized : null;
    } catch {
      return null;
    } finally {
    }
  }

  async function synchronizeOneRmlBuilderProfile(port, revision) {
    const scannerOrigin =
      `http://127.0.0.1:${port}`;
    const rawProfileResponse = await fetchRmlBuilderProfileJson(
      `${scannerOrigin}/profile`,
      { optional: true }
    );
    if (
      revision !== rmlBuilderProfileRequestRevision ||
      rawProfileResponse === RML_BUILDER_PROFILE_FETCH_FAILED
    ) {
      return false;
    }
    const rawProfile = {
      ...rawProfileResponse,
      sourceScannerPort: port,
      avatarUrl:
        typeof rawProfileResponse?.avatarUrl === "string" &&
        rawProfileResponse.avatarUrl.trim()
          ? `${scannerOrigin}/profile/avatar`
          : "",
      avatarSource:
        typeof rawProfileResponse?.avatarUrl === "string" &&
        rawProfileResponse.avatarUrl.trim()
          ? "rml-scanner-direct-profile-avatar"
          : ""
    };
    if (rawProfile?.available === false) {
      return false;
    }
    if (
      Number(rawProfile?.sourceScannerPort) !== port
    ) {
      console.error(
        "[RML BUILDER INTERNAL FAILURE] Health selected a scanner profile, but the profile bridge returned a different scanner port.",
        {
          requestedPort: port,
          response: rawProfile
        }
      );
      return false;
    }
    const profile = normalizeRmlBuilderProfile(rawProfile);
    if (!profile) return false;

    let avatarDataUrl = null;
    if (profile.avatarUrl) {
      avatarDataUrl = await fetchRmlBuilderProfileAvatarDataUrl(
        profile.avatarUrl,
        port
      );
      if (
        revision !== rmlBuilderProfileRequestRevision ||
        !avatarDataUrl
      ) {
        return false;
      }
    }
    if (revision !== rmlBuilderProfileRequestRevision) {
      return false;
    }

    rmlBuilderProfileScannerPort = port;
    saveRmlBuilderProfilePresentation({
      ...profile,
      avatarDataUrl
    });
    renderRmlBuilderProfilePresentation();
    return true;
  }

  function synchronizeRmlBuilderProfileFromScanner(scannerPort) {
    const port = Number(scannerPort);
    if (!Number.isInteger(port) || port < 42719 || port > 42725) {
      return Promise.resolve(false);
    }
    rmlBuilderProfileRequestedPort = port;
    rmlBuilderProfileRequestRevision += 1;
    if (rmlBuilderProfileSyncPromise) {
      return rmlBuilderProfileSyncPromise;
    }

    const pending = (async () => {
      let applied = false;
      while (rmlBuilderProfileRequestedPort) {
        const requestedPort = rmlBuilderProfileRequestedPort;
        const requestedRevision = rmlBuilderProfileRequestRevision;
        rmlBuilderProfileRequestedPort = 0;
        applied = await synchronizeOneRmlBuilderProfile(
          requestedPort,
          requestedRevision
        );
      }
      return applied;
    })()
      .catch(error => {
        console.error(
          "[RML BUILDER INTERNAL FAILURE] The selected scanner profile could not be applied.",
          error
        );
        return false;
      })
      .finally(() => {
        if (rmlBuilderProfileSyncPromise === pending) {
          rmlBuilderProfileSyncPromise = null;
        }
      });

    rmlBuilderProfileSyncPromise = pending;
    return pending;
  }

  function installRmlBuilderProfileSynchronization() {
    if (rmlBuilderProfileSyncInstalled) return;
    rmlBuilderProfileSyncInstalled = true;

    const synchronizeSelected = event => {
      const port = Number(event?.detail?.port);
      if (!Number.isInteger(port) || port < 42719 || port > 42725) {
        return;
      }
      void synchronizeRmlBuilderProfileFromScanner(port);
    };
    document.addEventListener(
      "rml-scanner:selected",
      synchronizeSelected
    );
    document.addEventListener(
      "rml-scanner:unavailable",
      () => {
        rmlBuilderProfileRequestedPort = 0;
        rmlBuilderProfileRequestRevision += 1;
        rmlBuilderProfileScannerPort = 0;
      }
    );
    window.addEventListener(
      "rml-language-changed",
      () => renderRmlBuilderProfilePresentation()
    );
    if (window.RMLScannerHealthSession) {
      synchronizeSelected({
        detail: window.RMLScannerHealthSession
      });
    }
  }

  function install() {
    loadRmlBuilderProfilePresentation();
    renderRmlBuilderProfilePresentation();
    installRmlBuilderProfileSynchronization();
    return current();
  }

  Object.defineProperty(
    window,
    "RMLBuilderProfilePresentation",
    {
      value: Object.freeze({
        version: 1,
        install,
        current,
        refresh: synchronizeRmlBuilderProfileFromScanner,
        render: renderRmlBuilderProfilePresentation
      }),
      writable: false,
      enumerable: true,
      configurable: true
    }
  );
})();
