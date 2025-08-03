// Keep a queue of pending requests if the panel is not ready
let panelReady = false;

chrome.action.onClicked.addListener(async (tab) => {
  if (chrome.sidePanel) {
    // Open the side panel for the current tab
    await chrome.sidePanel.open({ tabId: tab.id });
  } else {
    // Fallback: open popup window if sidePanel API is not available
    chrome.windows.create({
      url: chrome.runtime.getURL("index.html"),
      type: "popup",
    });
  }
});

// Listen for messages from the content script and panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (
    message.method === "getPublicKey" ||
    message.method === "signMessage" ||
    message.method === "signIn" ||
    message.method === "send" ||
    message.method === "mintToken" ||
    message.method === "alive"
  ) {
    console.log("msg", message);
    // Generate a unique request ID
    const requestId = Math.random().toString(36).slice(2);
    // Listen for the response from the side panel
    function handlePanelResponse(responseMessage, responseSender) {
      if (
        responseMessage &&
        responseMessage.type === "feeless-wallet-panel-response" &&
        responseMessage.requestId === requestId
      ) {
        sendResponse({
          result: responseMessage.result,
          error: responseMessage.error,
        });
        chrome.runtime.onMessage.removeListener(handlePanelResponse);
      }
    }
    chrome.runtime.onMessage.addListener(handlePanelResponse);
    // Validate signIn payload
    if (
      message.method === "signIn" &&
      (!message.payload || !Number.isInteger(message.payload.nonce))
    ) {
      sendResponse({ error: "Nonce must be an integer" });
      chrome.runtime.onMessage.removeListener(handlePanelResponse);
      return true;
    }
    // Send the request to all extension views (side panel will pick it up)
    const reqMsg = {
      type: "feeless-wallet-panel-request",
      method: message.method,
      payload: message.payload,
      requestId,
    };
    chrome.runtime.sendMessage(reqMsg);
    // Fallback: if no response in 30 seconds, respond with error
    setTimeout(() => {
      chrome.runtime.onMessage.removeListener(handlePanelResponse);
      sendResponse({ error: "Timeout waiting for user response" });
    }, 12000);
    return true;
  }
  return true;
});
