chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[Background]", message);

  if (message.type === "DOWNLOAD_IMAGE") {
    chrome.downloads.download(
      {
        url: message.url,
        filename: message.filename || "produto-amazon.jpg",
        saveAs: true
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          sendResponse({
            ok: false,
            error: chrome.runtime.lastError.message
          });
          return;
        }

        sendResponse({
          ok: true,
          downloadId
        });
      }
    );

    return true;
  }
});