/** Register before navigating: even a cached page can finish before the command reply. */
export async function navigatePage(send, handlers, socket, sessionId, url, timeoutMs = 15000) {
  let onLoad;
  let onClose;
  let deadline;
  const loaded = new Promise((resolve) => {
    onLoad = (message) => {
      if (message.sessionId === sessionId && message.method === "Page.loadEventFired") resolve();
    };
    handlers.add(onLoad);
  });
  const interrupted = new Promise((_, reject) => {
    onClose = () => reject(new Error("Chromium disconnected during navigation"));
    deadline = setTimeout(() => reject(new Error("Chromium navigation timed out")), timeoutMs);
    socket.addEventListener("close", onClose);
  });
  try {
    await Promise.race([Promise.all([send("Page.navigate", { url }, sessionId).then((result) => {
      if (result.errorText) throw new Error(`Chromium navigation failed: ${result.errorText}`);
    }), loaded]), interrupted]);
  } finally {
    clearTimeout(deadline);
    handlers.delete(onLoad);
    socket.removeEventListener("close", onClose);
  }
}
