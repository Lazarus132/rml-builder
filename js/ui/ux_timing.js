(() => {
  "use strict";
  const pending = new Map();
  let sequence = 0;
  function schedule(owner, callback, delayMs) {
    cancel(owner);
    const token = ++sequence;
    const handle = window.setTimeout(() => {
      const current = pending.get(owner);
      if (!current || current.token !== token) return;
      pending.delete(owner);
      callback();
    }, Math.max(0, Number(delayMs) || 0));
    pending.set(owner, { token, handle });
    return token;
  }
  function cancel(owner) {
    const current = pending.get(owner);
    if (!current) return false;
    window.clearTimeout(current.handle);
    pending.delete(owner);
    return true;
  }
  window.RMLUxTiming = Object.freeze({ schedule, cancel });
})();
