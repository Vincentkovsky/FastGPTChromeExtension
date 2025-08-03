// FastGPT Chrome Extension Background Script

// Extension installation handler
chrome.runtime.onInstalled.addListener((details) => {
    console.log('FastGPT Extension installed:', details.reason);
    
    if (details.reason === 'install') {
        // Initialize extension state on first install
        chrome.storage.local.set({
            setupState: {
                onboardingComplete: false,
                configurationComplete: false
            }
        });
    }
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
    console.log('FastGPT Extension started');
});

export {};