chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[Background] mensagem", message);

  if (message.type === "DOWNLOAD_IMAGE") {
    chrome.downloads.download(
      {
        url: message.url,
        filename: message.filename || "produto-amazon.jpg",
        saveAs: true
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error("[Background] download error", chrome.runtime.lastError);
          sendResponse({
            ok: false,
            error: chrome.runtime.lastError.message
          });
          return;
        }

        console.log("[Background] download ok", downloadId);
        sendResponse({
          ok: true,
          downloadId
        });
      }
    );

    return true;
  }
});