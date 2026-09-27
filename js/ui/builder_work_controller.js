(() => {
  "use strict";

  const MODULE_ID =
    "1.21.83-preview-control-parity";
  let installedController = null;

  if (
    window.RMLBuilderWorkController
      ?.moduleId === MODULE_ID
  ) {
    return;
  }

  function install(dependencies = {}) {
    if (installedController) {
      return installedController;
    }

    const elements = dependencies.elements;
    const clamp = dependencies.clamp;
    const setAlwaysClickableButtonAvailability =
      dependencies
        .setAlwaysClickableButtonAvailability;
    const replacementFactory =
      window.RMLBuilderReplacementDialog;
    if (
      !elements ||
      typeof clamp !== "function" ||
      typeof setAlwaysClickableButtonAvailability !==
        "function" ||
      typeof replacementFactory?.create !==
        "function"
    ) {
      throw new Error(
        "[RML BUILDER INTERNAL FAILURE] The Builder work controller dependencies are incomplete."
      );
    }

    let builderReplacementDialog = null;

    let activeBuilderWorkSession = 0;
    let builderWorkSessionSequence = 0;
    const builderWorkSessions = new Set();
    const builderWorkStates = new Map();
    const builderWorkWatchdogs = new Map();
    const builderWorkCompletionToken = Symbol(
      "builder-work-completion"
    );
    let builderWorkEpisodeSequence = 0;
    let activeBuilderWorkEpisode = null;
    let builderWorkEpisodeClosing = false;
    let builderWorkEpisodeClosePromise = null;
    const builderWorkQueuedSessions = new Set();
    function clearBuilderWorkDeadline(session) {
      const watchdog =
        builderWorkWatchdogs.get(session);
      if (watchdog) {
        window.clearTimeout(watchdog);
      }
      builderWorkWatchdogs.delete(session);
    }
    
    function nextBuilderVisualFrame() {
      if (
        document.visibilityState ===
          "hidden"
      ) {
        return yieldBuilderTask();
      }
    
      return new Promise(resolve => {
        let settled = false;
        let fallback = 0;
        const finish = () => {
          if (settled) {
            return;
          }
          settled = true;
          if (fallback) {
            window.clearTimeout(fallback);
          }
          resolve();
        };
        fallback = window.setTimeout(
          finish,
          100
        );
        window.requestAnimationFrame(finish);
      });
    }
    
    function yieldBuilderTask() {
      if (
        typeof globalThis.scheduler?.yield ===
          "function"
      ) {
        return globalThis.scheduler.yield();
      }
    
      if (typeof MessageChannel === "function") {
        return new Promise(resolve => {
          const channel =
            new MessageChannel();
          channel.port1.onmessage = () => {
            channel.port1.close();
            channel.port2.close();
            resolve();
          };
          channel.port2.postMessage(0);
        });
      }
    
      return Promise.resolve();
    }
    
    async function paintBuilderUi() {
      await nextBuilderVisualFrame();
      await nextBuilderVisualFrame();
      await yieldBuilderTask();
    }
    
    
    let builderWorkVisibleProgress = 0;
    
    function advanceBuilderWorkProgress(
      requestedProgress,
      currentProgress = builderWorkVisibleProgress
    ) {
      if (
        typeof requestedProgress !== "number" ||
        !Number.isFinite(requestedProgress)
      ) {
        return currentProgress;
      }
    
      return Math.max(
        currentProgress,
        clamp(requestedProgress, 0, 100)
      );
    }
    
    function renderBuilderWorkProgress() {
      if (
        !elements.builderWorkOverlay ||
        !activeBuilderWorkEpisode
      ) {
        return false;
      }
    
      const rootState = builderWorkStates.get(
        activeBuilderWorkEpisode.rootSession
      );
      const requestedProgress =
        activeBuilderWorkEpisode.zeroPainted
          ? rootState?.progress ??
            builderWorkVisibleProgress
          : 0;
      const normalized =
        advanceBuilderWorkProgress(
          requestedProgress,
          builderWorkVisibleProgress
        );
      if (rootState) {
        rootState.progress = normalized;
      }
      builderWorkVisibleProgress = normalized;
      elements.builderWorkProgress.dataset
        .rmlLoadProgress = `${normalized}%`;
      elements.builderWorkProgress.setAttribute(
        "aria-valuenow",
        String(Math.round(normalized))
      );
      return true;
    }
    
    function renderBuilderWorkState(state) {
      if (!state || !elements.builderWorkOverlay) {
        return false;
      }
    
      elements.builderWorkKicker.textContent =
        state.kicker;
      elements.builderWorkTitle.textContent =
        state.title;
      elements.builderWorkMessage.textContent =
        state.message;
      elements.builderWorkDetail.textContent =
        state.detail;
      return renderBuilderWorkProgress();
    }
    
    function updateBuilderWork(
      session,
      {
        kicker,
        title,
        message,
        detail,
        progress
      } = {},
      completionToken = null
    ) {
      const state = builderWorkStates.get(session);
      if (!state || !elements.builderWorkOverlay) {
        return false;
      }
    
      if (kicker !== undefined) {
        state.kicker = String(kicker);
      }
      if (title !== undefined) {
        state.title = String(title);
      }
      if (message !== undefined) {
        state.message = String(message);
      }
      if (detail !== undefined) {
        state.detail = String(detail);
      }
    
      if (
        progress !== undefined &&
        typeof progress === "number" &&
        Number.isFinite(progress)
      ) {
        const episode = activeBuilderWorkEpisode;
        const activeRoot = Boolean(
          episode &&
          state.episodeId === episode.id &&
          episode.rootSession === session
        );
        const finalProgressAllowed = Boolean(
          activeRoot &&
          completionToken ===
            builderWorkCompletionToken &&
          episode.phase === "final-paint" &&
          episode.sessions.size === 1
        );
        const requestedProgress =
          progress >= 100 && !finalProgressAllowed
            ? 99
            : progress;
    
        if (activeRoot || state.episodeId === 0) {
          state.reportedProgress =
            advanceBuilderWorkProgress(
              requestedProgress,
              state.reportedProgress
            );
          if (
            activeRoot &&
            episode.zeroPainted
          ) {
            state.progress =
              advanceBuilderWorkProgress(
                state.reportedProgress,
                state.progress
              );
          }
        }
      }
    
      if (session === activeBuilderWorkSession) {
        renderBuilderWorkState(state);
      } else if (
        activeBuilderWorkEpisode?.rootSession ===
          session
      ) {
        renderBuilderWorkProgress();
      }
    
      return true;
    }
    
    
    function resetBuilderReplacementUi() {
      return builderReplacementDialog
        ?.reset();
    }

    function activateQueuedBuilderWorkEpisode() {
      if (
        activeBuilderWorkEpisode ||
        builderWorkEpisodeClosing ||
        !elements.builderWorkOverlay
      ) {
        return false;
      }
    
      const sessions = [
        ...builderWorkQueuedSessions
      ].filter(session =>
        builderWorkSessions.has(session) &&
        builderWorkStates.has(session)
      );
      if (sessions.length === 0) {
        return false;
      }
    
      sessions.sort((left, right) =>
        left - right
      );
      for (const session of sessions) {
        builderWorkQueuedSessions.delete(session);
      }
    
      const episode = {
        id: ++builderWorkEpisodeSequence,
        sessions: new Set(sessions),
        rootSession: sessions[0],
        phase: "opening",
        revision: 0,
        zeroPainted: false,
        zeroPaintPromise: null
      };
      activeBuilderWorkEpisode = episode;
      activeBuilderWorkSession =
        sessions[sessions.length - 1];
      builderWorkVisibleProgress = 0;
    
      for (const session of sessions) {
        const state = builderWorkStates.get(session);
        if (!state) continue;
        state.episodeId = episode.id;
        state.progress = 0;
        state.progressUnlocked = false;
        if (session !== episode.rootSession) {
          state.reportedProgress = 0;
        }
        state.resolveActivation?.(true);
        state.resolveActivation = null;
      }
    
      elements.builderWorkProgress.dataset
        .rmlLoadProgress = "0%";
      elements.builderWorkProgress.setAttribute(
        "aria-valuenow",
        "0"
      );
      resetBuilderReplacementUi();
      elements.builderWorkOverlay.hidden = false;
      document.body.classList.add(
        "rml-builder-work-active"
      );
      renderBuilderWorkState(
        builderWorkStates.get(
          activeBuilderWorkSession
        )
      );
    
      episode.zeroPaintPromise =
        paintBuilderUi()
          .then(() => {
            if (
              activeBuilderWorkEpisode !==
                episode ||
              episode.zeroPainted
            ) {
              return false;
            }
            episode.zeroPainted = true;
            if (episode.phase === "opening") {
              episode.phase = "open";
            }
            const rootState =
              builderWorkStates.get(
                episode.rootSession
              );
            if (rootState) {
              rootState.progressUnlocked = true;
              rootState.progress =
                advanceBuilderWorkProgress(
                  rootState.reportedProgress,
                  rootState.progress
                );
            }
            renderBuilderWorkState(
              builderWorkStates.get(
                activeBuilderWorkSession
              )
            );
            return true;
          })
          .catch(error => {
            console.error(
              "[RML BUILDER INTERNAL FAILURE] The initial zero-progress frame could not be painted.",
              error
            );
            return false;
          });
      return true;
    }
    
    function joinActiveBuilderWorkEpisode(session) {
      const episode = activeBuilderWorkEpisode;
      const state = builderWorkStates.get(session);
      if (!episode || !state) {
        return false;
      }
    
      episode.sessions.add(session);
      episode.revision += 1;
      state.episodeId = episode.id;
      state.progress = builderWorkVisibleProgress;
      state.reportedProgress =
        builderWorkVisibleProgress;
      state.progressUnlocked =
        episode.zeroPainted;
      activeBuilderWorkSession = session;
      state.resolveActivation?.(true);
      state.resolveActivation = null;
      renderBuilderWorkState(state);
      return true;
    }
    
    function closeBuilderWorkEpisode(episode) {
      if (
        activeBuilderWorkEpisode !== episode ||
        builderWorkEpisodeClosing
      ) {
        return builderWorkEpisodeClosePromise ||
          Promise.resolve(false);
      }
    
      activeBuilderWorkEpisode = null;
      activeBuilderWorkSession = 0;
      builderWorkEpisodeClosing = true;
      resetBuilderReplacementUi();
      elements.builderWorkOverlay.hidden = true;
      document.body.classList.remove(
        "rml-builder-work-active"
      );
    
      const closePromise = (async () => {
        let painted = true;
        try {
          await paintBuilderUi();
        } catch (error) {
          painted = false;
          console.error(
            "[RML BUILDER INTERNAL FAILURE] The closed Builder overlay could not paint its hidden state.",
            error
          );
        }
        if (
          builderWorkEpisodeClosePromise !==
            closePromise
        ) {
          return false;
        }
        builderWorkEpisodeClosing = false;
        builderWorkEpisodeClosePromise = null;
        activateQueuedBuilderWorkEpisode();
        return painted;
      })();
      builderWorkEpisodeClosePromise = closePromise;
      return closePromise;
    }
    
    function releaseBuilderWorkSession(session) {
      const state = builderWorkStates.get(session);
      if (
        !state ||
        !builderWorkSessions.has(session) ||
        !elements.builderWorkOverlay
      ) {
        return {
          released: false,
          closePromise: null
        };
      }
    
      builderWorkSessions.delete(session);
      builderWorkStates.delete(session);
      builderWorkQueuedSessions.delete(session);
      clearBuilderWorkDeadline(session);
    
      if (state.episodeId === 0) {
        state.resolveActivation?.(false);
        state.resolveActivation = null;
        return {
          released: true,
          closePromise: null
        };
      }
    
      const episode = activeBuilderWorkEpisode;
      if (
        !episode ||
        state.episodeId !== episode.id ||
        !episode.sessions.has(session)
      ) {
        return {
          released: true,
          closePromise: null
        };
      }
    
      episode.sessions.delete(session);
      episode.revision += 1;
      if (episode.sessions.size === 0) {
        return {
          released: true,
          closePromise:
            closeBuilderWorkEpisode(episode)
        };
      }
    
      if (episode.rootSession === session) {
        episode.rootSession = Math.min(
          ...episode.sessions
        );
        const rootState =
          builderWorkStates.get(
            episode.rootSession
          );
        if (rootState) {
          rootState.progress =
            builderWorkVisibleProgress;
          rootState.reportedProgress =
            builderWorkVisibleProgress;
          rootState.progressUnlocked =
            episode.zeroPainted;
        }
      }
      if (
        episode.phase === "settling"
      ) {
        episode.phase = "open";
      }
      if (activeBuilderWorkSession === session) {
        activeBuilderWorkSession = Math.max(
          ...episode.sessions
        );
      }
      renderBuilderWorkState(
        builderWorkStates.get(
          activeBuilderWorkSession
        )
      );
      return {
        released: true,
        closePromise: null
      };
    }
    
    function beginBuilderWork(options = {}) {
      const session =
        ++builderWorkSessionSequence;
      let resolveActivation = null;
      const activationPromise = new Promise(resolve => {
        resolveActivation = resolve;
      });
      const state = {
        kicker: String(
          options.kicker ??
          elements.builderWorkKicker
            ?.textContent ??
          ""
        ),
        title: String(
          options.title ??
          elements.builderWorkTitle
            ?.textContent ??
          ""
        ),
        message: String(
          options.message ??
          elements.builderWorkMessage
            ?.textContent ??
          ""
        ),
        detail: String(
          options.detail ??
          elements.builderWorkDetail
            ?.textContent ??
          ""
        ),
        progress: 0,
        reportedProgress: 0,
        progressUnlocked: false,
        episodeId: 0,
        activationPromise,
        resolveActivation,
        completionPromise: null
      };
      builderWorkSessions.add(session);
      builderWorkStates.set(session, state);
    
      if (
        activeBuilderWorkEpisode &&
        ![
          "final-paint",
          "closing"
        ].includes(
          activeBuilderWorkEpisode.phase
        )
      ) {
        joinActiveBuilderWorkEpisode(session);
      } else {
        builderWorkQueuedSessions.add(session);
        activateQueuedBuilderWorkEpisode();
      }
    
      if (options.progress !== undefined) {
        updateBuilderWork(session, {
          progress: options.progress
        });
      }
    
      const timeout = clamp(
        Number(options.timeout) || 30000,
        1000,
        120000
      );
      const watchdog =
        window.setTimeout(() => {
          if (
            builderWorkSessions.has(
              session
            )
          ) {
            builderWorkWatchdogs.delete(session);
            const error = new Error(
              `A Builder operation exceeded its declared ${timeout} ms completion deadline.`
            );
            error.code =
              "RML_BUILDER_WORK_DEADLINE_EXCEEDED";
            console.error(
              "[RML BUILDER INTERNAL FAILURE] A Builder operation exceeded its declared completion deadline.",
              {
                session,
                timeout,
                activeSessions: [
                  ...builderWorkSessions
                ],
                error
              }
            );
            try {
              options.onTimeout?.(error);
            } catch (timeoutError) {
              console.error(
                "[RML BUILDER INTERNAL FAILURE] A Builder deadline handler failed.",
                timeoutError
              );
            }
          }
        }, timeout);
      builderWorkWatchdogs.set(
        session,
        watchdog
      );
      return session;
    }
    
    function finishBuilderWork(session) {
      return releaseBuilderWorkSession(
        session
      ).released;
    }
    
    async function completeBuilderWork(
      session,
      options = {}
    ) {
      const state = builderWorkStates.get(session);
      if (!state || !builderWorkSessions.has(session)) {
        return false;
      }
      if (state.completionPromise) {
        return state.completionPromise;
      }
    
      const { progress, ...copy } = options;
      updateBuilderWork(session, copy);
      state.completionPromise = (async () => {
        if (state.episodeId === 0) {
          const activated =
            await state.activationPromise;
          if (
            !activated ||
            !builderWorkSessions.has(session)
          ) {
            return false;
          }
        }
    
        let episode = activeBuilderWorkEpisode;
        if (
          !episode ||
          state.episodeId !== episode.id ||
          !episode.sessions.has(session)
        ) {
          return false;
        }
        if (
          episode.rootSession !== session ||
          episode.sessions.size > 1
        ) {
          return releaseBuilderWorkSession(
            session
          ).released;
        }
    
        await episode.zeroPaintPromise;
        episode = activeBuilderWorkEpisode;
        if (
          !episode ||
          state.episodeId !== episode.id ||
          episode.rootSession !== session ||
          episode.sessions.size !== 1
        ) {
          return builderWorkSessions.has(session)
            ? releaseBuilderWorkSession(
                session
              ).released
            : false;
        }
    
        episode.phase = "settling";
        const settlementRevision =
          episode.revision;
        await paintBuilderUi();
        episode = activeBuilderWorkEpisode;
        if (
          !episode ||
          state.episodeId !== episode.id ||
          episode.rootSession !== session ||
          episode.sessions.size !== 1 ||
          episode.revision !==
            settlementRevision
        ) {
          return builderWorkSessions.has(session)
            ? releaseBuilderWorkSession(
                session
              ).released
            : false;
        }
    
        episode.phase = "final-paint";
        updateBuilderWork(
          session,
          {
            ...copy,
            progress: 100
          },
          builderWorkCompletionToken
        );
        await paintBuilderUi();
        if (!builderWorkSessions.has(session)) {
          return false;
        }
        const released =
          releaseBuilderWorkSession(session);
        if (released.closePromise) {
          await released.closePromise;
        }
        return released.released;
      })();
      return state.completionPromise;
    }
    
    
    builderReplacementDialog =
      replacementFactory.create({
        elements,
        setAlwaysClickableButtonAvailability,
        clearBuilderWorkDeadline,
        updateBuilderWork,
        paintBuilderUi,
        getActiveBuilderWorkSession() {
          return activeBuilderWorkSession;
        },
        renderLimit:
          dependencies.replacementRenderLimit
      });

    const publicApi = Object.freeze({
      version: 4,
      begin: beginBuilderWork,
      update: updateBuilderWork,
      paint: paintBuilderUi,
      complete: completeBuilderWork,
      finish: finishBuilderWork,
      active() {
        return builderWorkSessions.size > 0;
      }
    });

    Object.defineProperty(
      window,
      window.RMLI18n.t(
        "ui.literal.28dc9c1b01c0"
      ),
      {
        value: publicApi,
        writable: false,
        enumerable: false,
        configurable: true
      }
    );

    installedController = Object.freeze({
      ...publicApi,
      clearDeadline: clearBuilderWorkDeadline,
      nextVisualFrame: nextBuilderVisualFrame,
      yieldTask: yieldBuilderTask,
      requestReplacementChoice:
        builderReplacementDialog
          .requestChoice
    });
    return installedController;
  }

  Object.defineProperty(
    window,
    "RMLBuilderWorkController",
    {
      value: Object.freeze({
        version: 1,
        moduleId: MODULE_ID,
        install
      }),
      writable: false,
      enumerable: true,
      configurable: true
    }
  );
})();
