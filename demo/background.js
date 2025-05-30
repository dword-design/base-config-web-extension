import browser from 'webextension-polyfill';

browser.action.onClicked.addListener(async () => {
  const { enabled } = await browser.storage.local.get(['enabled']);
  browser.storage.local.set({ enabled: !enabled });
});
