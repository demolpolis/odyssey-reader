// Configuration and Default Settings
const CONFIG = {
    // API Configuration
    API_ENDPOINT: 'https://api.anthropic.com/v1/messages',
    MODEL: 'claude-sonnet-4-20250514',
    MAX_TOKENS: 2048,
    
    // Usage Limits
    DEFAULT_MAX_API_CALLS: 50,
    
    // Cost Estimation (approximate, based on Sonnet 4 pricing)
    COST_PER_1K_INPUT_TOKENS: 0.003,
    COST_PER_1K_OUTPUT_TOKENS: 0.015,
    
    // Reading Settings
    WORDS_PER_PAGE: 400, // Approximate words per page for pagination
    
    // Local Storage Keys
    STORAGE_KEYS: {
        API_KEY: 'odyssey_api_key',
        READING_POSITION: 'odyssey_reading_position',
        THEME: 'odyssey_theme',
        FONT_SIZE: 'odyssey_font_size',
        API_USAGE: 'odyssey_api_usage',
        MAX_API_CALLS: 'odyssey_max_api_calls',
        PAGE_PROMPT: 'odyssey_page_prompt',
        SELECTION_PROMPT: 'odyssey_selection_prompt'
    },
    
    // Default AI Prompts (user-editable)
    DEFAULT_PROMPTS: {
        PAGE_ANALYSIS: `I'm reading a page from The Odyssey by Homer (Robert Fagles translation).

Here is the text:
{TEXT}

Please provide a concise analysis with the following sections:

1) SUMMARY: Brief summary of what happens on this page
2) HISTORICAL CONTEXT: Relevant historical or cultural background
3) TRANSLATION NOTES: Any interesting aspects of this translation or Greek terms
4) LITERARY SIGNIFICANCE: Themes, symbolism, or narrative importance

Keep your response focused and informative. Assume the reader is familiar with the general story but wants deeper understanding.`,

        SELECTION_ANALYSIS: `I'm reading The Odyssey by Homer (Robert Fagles translation), specifically from Book {BOOK}.

Here is the surrounding context:
{CONTEXT_BEFORE}

**[SELECTED TEXT]:**
{SELECTION}

{CONTEXT_AFTER}

Please explain this selected passage in the context of the chapter and the larger epic. Address:
- What's happening in this specific passage
- How it connects to the surrounding narrative  
- Its significance to the overall story
- Any notable literary techniques or themes

Be concise but insightful.`
    }
};

// Helper function to get stored value or default
function getConfigValue(key, defaultValue) {
    const stored = localStorage.getItem(CONFIG.STORAGE_KEYS[key]);
    return stored !== null ? stored : defaultValue;
}

// Helper function to save config value
function saveConfigValue(key, value) {
    localStorage.setItem(CONFIG.STORAGE_KEYS[key], value);
}

// Make functions globally accessible
window.getConfigValue = getConfigValue;
window.saveConfigValue = saveConfigValue;
