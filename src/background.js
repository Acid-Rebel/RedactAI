/**
 * RedactAI Service Worker (Background Script)
 * Lightweight — handles keepalive and extension lifecycle.
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log('[RedactAI] Extension installed.');
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[RedactAI] Extension started.');
});

// Keep the service worker alive with content script port connections
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'redactai-keepalive') {
    port.onDisconnect.addListener(() => {});
  }
});
