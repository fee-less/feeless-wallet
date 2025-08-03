// CSP-safe content script: no script injection, just message bridge
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data && event.data.type === 'FEELLESS_WALLET_REQUEST') {
    chrome.runtime.sendMessage(
      { method:  event.data.method, payload: event.data.payload },
      (response) => {
        window.postMessage(
          {
            type: "FEELLESS_WALLET_RESPONSE",
            method: event.data.method,
            id: event.data.id,
            result: response && response.result,
            error: response && response.error,
          },
          "*"
        );
      }
    );
  }
});

// Optional: Ping every 10 seconds to avoid idle timeout
setInterval(() => {
  try {
    chrome.runtime.sendMessage({ type: "ping" });
  } catch (_) {}
}, 10000);
