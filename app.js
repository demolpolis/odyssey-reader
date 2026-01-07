// Main Application Logic
// State Management
const AppState = {
    apiKey: null,
    currentPage: 1,
    totalPages: 1,
    pages: [],
    currentBook: 'ONE',
    selectedText: null,
    selectionRange: null,
    apiCallCount: 0,
    maxApiCalls: 50,
    theme: 'light',
    fontSize: 16,
    analyses: [] // Store all analyses with their page references
};

// Make functions globally accessible for onclick handlers
window.analyzeCurrentPage = analyzeCurrentPage;
window.analyzeSelection = analyzeSelection;
window.defineWord = defineWord;
window.clearSelection = clearSelection;
window.toggleCard = toggleCard;

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    // Load saved settings
    loadSettings();
    
    // Check for API key
    AppState.apiKey = localStorage.getItem(CONFIG.STORAGE_KEYS.API_KEY);
    if (!AppState.apiKey) {
        showApiKeyModal();
    } else {
        hideApiKeyModal();
    }
    
    // Load the book content
    loadBookContent();
    
    // Set up event listeners
    setupEventListeners();
    
    // Apply theme and font size
    applyTheme();
    applyFontSize();
    
    // Update UI
    updateUI();
}

// ===== BOOK LOADING =====
function loadBookContent() {
    if (!ODYSSEY_DATA || ODYSSEY_DATA.length === 0) {
        document.getElementById('textContent').innerHTML = 
            '<div class="error">Error loading book content</div>';
        return;
    }
    
    // Split content into pages
    AppState.pages = [];
    ODYSSEY_DATA.forEach((book, bookIndex) => {
        const words = book.text.split(/\s+/);
        const wordsPerPage = CONFIG.WORDS_PER_PAGE;
        
        for (let i = 0; i < words.length; i += wordsPerPage) {
            const pageWords = words.slice(i, i + wordsPerPage);
            const pageText = pageWords.join(' ');
            
            AppState.pages.push({
                bookTitle: `Book ${book.book}`,
                bookNumber: book.book,
                text: pageText,
                globalPageNumber: AppState.pages.length + 1
            });
        }
    });
    
    AppState.totalPages = AppState.pages.length;
    
    // Load saved reading position
    const savedPage = localStorage.getItem(CONFIG.STORAGE_KEYS.READING_POSITION);
    if (savedPage) {
        AppState.currentPage = Math.min(parseInt(savedPage), AppState.totalPages);
    }
    
    // Render current page
    renderCurrentPage();
}

function renderCurrentPage() {
    const page = AppState.pages[AppState.currentPage - 1];
    if (!page) return;
    
    const textContent = document.getElementById('textContent');
    textContent.innerHTML = `
        <div class="book-header">${page.bookTitle}</div>
        <div class="page-text" id="pageText">${page.text}</div>
    `;
    
    // Update location display
    document.getElementById('currentLocation').textContent = page.bookTitle;
    
    // Update page counter
    document.getElementById('pageCounter').textContent = 
        `Page ${AppState.currentPage} of ${AppState.totalPages}`;
    
    // Save reading position
    localStorage.setItem(CONFIG.STORAGE_KEYS.READING_POSITION, AppState.currentPage);
    
    // Enable text selection
    setupTextSelection();
    
    // Update commentary panel to show page-specific analyses
    updateCommentaryForPage();
}

// ===== TEXT SELECTION =====
function setupTextSelection() {
    const pageText = document.getElementById('pageText');
    if (!pageText) return;
    
    pageText.addEventListener('mouseup', handleTextSelection);
    pageText.addEventListener('touchend', handleTextSelection);
}

function handleTextSelection() {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (selectedText.length > 0) {
        AppState.selectedText = selectedText;
        AppState.selectionRange = selection.getRangeAt(0);
        showSelectionActions();
        highlightSelection();
    } else {
        clearSelection();
    }
}

function highlightSelection() {
    // Visual feedback for selection (already handled by browser, but we can add custom styling)
    const contextIndicator = document.getElementById('contextIndicator');
    if (AppState.selectedText) {
        contextIndicator.style.display = 'block';
        contextIndicator.innerHTML = `
            <div class="context-bracket"></div>
            <div class="context-label">Selected Text</div>
        `;
    }
}

function showSelectionActions() {
    const commentary = document.getElementById('commentaryContent');
    
    // Check if we already have a selection action panel
    let actionPanel = document.getElementById('selectionActionPanel');
    if (!actionPanel) {
        actionPanel = document.createElement('div');
        actionPanel.id = 'selectionActionPanel';
        actionPanel.className = 'analysis-card selection-actions';
        commentary.insertBefore(actionPanel, commentary.firstChild);
    }
    
    const wordCount = AppState.selectedText.split(/\s+/).length;
    const isSingleWord = wordCount === 1;
    
    actionPanel.innerHTML = `
        <div class="card-header">
            <h3>✓ Text Selected</h3>
            <span class="selection-badge">${wordCount} word${wordCount > 1 ? 's' : ''}</span>
        </div>
        <div class="selected-preview">"${AppState.selectedText.substring(0, 100)}${AppState.selectedText.length > 100 ? '...' : ''}"</div>
        <div class="action-buttons">
            <button class="btn-primary" onclick="analyzeSelection()">
                Analyze Selection
            </button>
            ${isSingleWord ? '<button class="btn-secondary" onclick="defineWord()">Define Word</button>' : ''}
            <button class="btn-ghost" onclick="clearSelection()">Clear</button>
        </div>
    `;
}

function clearSelection() {
    AppState.selectedText = null;
    AppState.selectionRange = null;
    window.getSelection().removeAllRanges();
    
    const actionPanel = document.getElementById('selectionActionPanel');
    if (actionPanel) {
        actionPanel.remove();
    }
    
    const contextIndicator = document.getElementById('contextIndicator');
    contextIndicator.style.display = 'none';
}

// ===== AI ANALYSIS FUNCTIONS =====
async function analyzeCurrentPage() {
    if (!checkApiKey()) return;
    if (!checkApiLimit()) return;
    
    const page = AppState.pages[AppState.currentPage - 1];
    if (!page) return;
    
    // Get or create page analysis container
    let pageAnalysis = document.getElementById('pageAnalysisCard');
    if (!pageAnalysis) {
        pageAnalysis = document.createElement('div');
        pageAnalysis.id = 'pageAnalysisCard';
        pageAnalysis.className = 'analysis-card';
        const commentary = document.getElementById('commentaryContent');
        commentary.innerHTML = ''; // Clear empty state
        commentary.appendChild(pageAnalysis);
    }
    
    // Show loading state
    pageAnalysis.innerHTML = `
        <div class="card-header">
            <h3>📄 Page Analysis</h3>
            <span class="page-badge">Page ${AppState.currentPage}</span>
        </div>
        <div class="loading-content">
            <div class="spinner"></div>
            <p>Analyzing page...</p>
        </div>
    `;
    
    try {
        // Get the prompt template
        const promptTemplate = getConfigValue('PAGE_PROMPT', CONFIG.DEFAULT_PROMPTS.PAGE_ANALYSIS);
        const prompt = promptTemplate.replace('{TEXT}', page.text);
        
        const response = await callClaudeAPI(prompt);
        
        // Display the analysis
        pageAnalysis.innerHTML = `
            <div class="card-header">
                <h3>📄 Page Analysis</h3>
                <span class="page-badge">Page ${AppState.currentPage} · ${page.bookTitle}</span>
            </div>
            <div class="analysis-content">
                ${formatAnalysis(response)}
            </div>
        `;
        
        // Store analysis
        AppState.analyses.push({
            type: 'page',
            page: AppState.currentPage,
            content: response
        });
        
    } catch (error) {
        pageAnalysis.innerHTML = `
            <div class="card-header">
                <h3>📄 Page Analysis</h3>
            </div>
            <div class="error-content">
                <p>❌ Error: ${error.message}</p>
                <button class="btn-secondary" onclick="analyzeCurrentPage()">Retry</button>
            </div>
        `;
    }
}

async function analyzeSelection() {
    if (!checkApiKey()) return;
    if (!checkApiLimit()) return;
    if (!AppState.selectedText) return;
    
    const page = AppState.pages[AppState.currentPage - 1];
    
    // Create selection analysis card
    const analysisCard = document.createElement('div');
    analysisCard.className = 'analysis-card';
    
    const commentary = document.getElementById('commentaryContent');
    const actionPanel = document.getElementById('selectionActionPanel');
    if (actionPanel) {
        commentary.insertBefore(analysisCard, actionPanel.nextSibling);
    } else {
        commentary.appendChild(analysisCard);
    }
    
    // Show loading
    analysisCard.innerHTML = `
        <div class="card-header">
            <h3>✨ Selection Analysis</h3>
            <span class="context-badge">📍 Page ${AppState.currentPage}</span>
        </div>
        <div class="loading-content">
            <div class="spinner"></div>
            <p>Analyzing selection...</p>
        </div>
    `;
    
    try {
        // Build context
        const pageWords = page.text.split(/\s+/);
        const selectionStart = page.text.indexOf(AppState.selectedText);
        
        // Get context before and after
        const contextBefore = page.text.substring(Math.max(0, selectionStart - 200), selectionStart);
        const contextAfter = page.text.substring(
            selectionStart + AppState.selectedText.length,
            Math.min(page.text.length, selectionStart + AppState.selectedText.length + 200)
        );
        
        // Get prompt template
        let promptTemplate = getConfigValue('SELECTION_PROMPT', CONFIG.DEFAULT_PROMPTS.SELECTION_ANALYSIS);
        const prompt = promptTemplate
            .replace('{BOOK}', page.bookNumber)
            .replace('{CONTEXT_BEFORE}', contextBefore)
            .replace('{SELECTION}', AppState.selectedText)
            .replace('{CONTEXT_AFTER}', contextAfter);
        
        const response = await callClaudeAPI(prompt);
        
        analysisCard.innerHTML = `
            <div class="card-header">
                <h3>✨ Selection Analysis</h3>
                <span class="context-badge">📍 Page ${AppState.currentPage} · ${page.bookTitle}</span>
            </div>
            <div class="selected-text-display">
                "${AppState.selectedText.substring(0, 150)}${AppState.selectedText.length > 150 ? '...' : ''}"
            </div>
            <div class="analysis-content">
                ${formatAnalysis(response)}
            </div>
        `;
        
        // Store analysis
        AppState.analyses.push({
            type: 'selection',
            page: AppState.currentPage,
            selection: AppState.selectedText,
            content: response
        });
        
        clearSelection();
        
    } catch (error) {
        analysisCard.innerHTML = `
            <div class="card-header">
                <h3>✨ Selection Analysis</h3>
            </div>
            <div class="error-content">
                <p>❌ Error: ${error.message}</p>
            </div>
        `;
    }
}

async function defineWord() {
    if (!AppState.selectedText) return;
    if (!checkApiKey()) return;
    if (!checkApiLimit()) return;
    
    const word = AppState.selectedText.trim();
    
    const analysisCard = document.createElement('div');
    analysisCard.className = 'analysis-card';
    
    const commentary = document.getElementById('commentaryContent');
    const actionPanel = document.getElementById('selectionActionPanel');
    if (actionPanel) {
        commentary.insertBefore(analysisCard, actionPanel.nextSibling);
    }
    
    // Show loading
    analysisCard.innerHTML = `
        <div class="card-header">
            <h3>📖 Definition</h3>
        </div>
        <div class="loading-content">
            <div class="spinner"></div>
            <p>Looking up definition...</p>
        </div>
    `;
    
    try {
        const prompt = `Define the word "${word}" as it would be used in Homer's Odyssey (Robert Fagles translation). Include:
1. The basic definition
2. How it's used in ancient Greek context
3. Any cultural or historical significance

Keep it concise but informative.`;
        
        const response = await callClaudeAPI(prompt);
        
        analysisCard.innerHTML = `
            <div class="card-header">
                <h3>📖 Definition: ${word}</h3>
            </div>
            <div class="analysis-content">
                ${formatAnalysis(response)}
            </div>
        `;
        
        clearSelection();
        
    } catch (error) {
        analysisCard.innerHTML = `
            <div class="card-header">
                <h3>📖 Definition</h3>
            </div>
            <div class="error-content">
                <p>❌ Error: ${error.message}</p>
            </div>
        `;
    }
}

async function askCustomQuestion() {
    const questionInput = document.getElementById('questionInput');
    const question = questionInput.value.trim();
    
    if (!question) return;
    if (!checkApiKey()) return;
    if (!checkApiLimit()) return;
    
    const page = AppState.pages[AppState.currentPage - 1];
    
    // Create question card
    const questionCard = document.createElement('div');
    questionCard.className = 'analysis-card';
    
    const commentary = document.getElementById('commentaryContent');
    commentary.appendChild(questionCard);
    
    questionCard.innerHTML = `
        <div class="card-header">
            <h3>💬 Custom Question</h3>
            <span class="context-badge">📍 Page ${AppState.currentPage}</span>
        </div>
        <div class="question-display">
            <strong>Q:</strong> ${question}
        </div>
        <div class="loading-content">
            <div class="spinner"></div>
            <p>Getting answer...</p>
        </div>
    `;
    
    questionInput.value = '';
    
    try {
        const prompt = `I'm reading The Odyssey (Robert Fagles translation), currently on page ${AppState.currentPage} in ${page.bookTitle}.

Current page content:
${page.text.substring(0, 500)}...

Question: ${question}

Please provide a helpful answer based on your knowledge of The Odyssey and the context provided.`;
        
        const response = await callClaudeAPI(prompt);
        
        questionCard.innerHTML = `
            <div class="card-header">
                <h3>💬 Custom Question</h3>
                <span class="context-badge">📍 Page ${AppState.currentPage} · ${page.bookTitle}</span>
            </div>
            <div class="question-display">
                <strong>Q:</strong> ${question}
            </div>
            <div class="analysis-content">
                ${formatAnalysis(response)}
            </div>
        `;
        
    } catch (error) {
        questionCard.innerHTML = `
            <div class="card-header">
                <h3>💬 Custom Question</h3>
            </div>
            <div class="error-content">
                <p>❌ Error: ${error.message}</p>
            </div>
        `;
    }
}

// ===== API COMMUNICATION =====
async function callClaudeAPI(prompt) {
    if (!AppState.apiKey) {
        throw new Error('No API key found');
    }
    
    // Check limit before making call
    if (AppState.apiCallCount >= AppState.maxApiCalls) {
        throw new Error(`API call limit reached (${AppState.maxApiCalls} calls per session)`);
    }
    
    console.log('Making API call to:', CONFIG.API_ENDPOINT);
    console.log('Using model:', CONFIG.MODEL);
    
    try {
        const response = await fetch(CONFIG.API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': AppState.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: CONFIG.MODEL,
                max_tokens: CONFIG.MAX_TOKENS,
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            })
        });
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            let errorMessage = `API request failed (${response.status})`;
            try {
                const error = await response.json();
                console.error('API Error Response:', error);
                errorMessage = error.error?.message || errorMessage;
            } catch (e) {
                // If we can't parse error JSON, use status text
                errorMessage = response.statusText || errorMessage;
                console.error('Could not parse error response:', e);
            }
            throw new Error(errorMessage);
        }
        
        const data = await response.json();
        console.log('API Response received successfully');
        
        // Increment API counter
        AppState.apiCallCount++;
        updateApiCounter();
        
        // Extract text from response
        const text = data.content
            .filter(item => item.type === 'text')
            .map(item => item.text)
            .join('\n');
        
        return text;
    } catch (error) {
        console.error('API Error Details:', error);
        
        // Provide more helpful error messages
        if (error.message.includes('Failed to fetch')) {
            throw new Error('Network error: Unable to connect to Anthropic API. Please check your internet connection and API key.');
        } else if (error.message.includes('401')) {
            throw new Error('Invalid API key. Please check your API key in settings.');
        } else if (error.message.includes('429')) {
            throw new Error('Rate limit exceeded. Please wait a moment and try again.');
        }
        
        throw error;
    }
}

function formatAnalysis(text) {
    // Convert markdown-style formatting to HTML
    let formatted = text
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');
    
    return `<p>${formatted}</p>`;
}

// ===== NAVIGATION =====
function nextPage() {
    if (AppState.currentPage < AppState.totalPages) {
        AppState.currentPage++;
        renderCurrentPage();
    }
}

function prevPage() {
    if (AppState.currentPage > 1) {
        AppState.currentPage--;
        renderCurrentPage();
    }
}

function jumpToPage() {
    const input = document.getElementById('jumpToPageInput');
    const pageNum = parseInt(input.value);
    
    if (pageNum >= 1 && pageNum <= AppState.totalPages) {
        AppState.currentPage = pageNum;
        renderCurrentPage();
        input.value = '';
    } else {
        alert(`Please enter a page number between 1 and ${AppState.totalPages}`);
    }
}

// ===== SCROLL ZONE NAVIGATION =====
function setupScrollZone() {
    const scrollZone = document.getElementById('scrollZone');
    let isScrolling = false;
    let startY = 0;
    
    scrollZone.addEventListener('mousedown', (e) => {
        isScrolling = true;
        startY = e.clientY;
    });
    
    scrollZone.addEventListener('touchstart', (e) => {
        isScrolling = true;
        startY = e.touches[0].clientY;
    });
    
    window.addEventListener('mousemove', (e) => {
        if (!isScrolling) return;
        const deltaY = e.clientY - startY;
        
        if (Math.abs(deltaY) > 50) { // Threshold for page change
            if (deltaY > 0) {
                prevPage();
            } else {
                nextPage();
            }
            startY = e.clientY;
        }
    });
    
    window.addEventListener('touchmove', (e) => {
        if (!isScrolling) return;
        const deltaY = e.touches[0].clientY - startY;
        
        if (Math.abs(deltaY) > 50) {
            if (deltaY > 0) {
                prevPage();
            } else {
                nextPage();
            }
            startY = e.touches[0].clientY;
        }
    });
    
    window.addEventListener('mouseup', () => {
        isScrolling = false;
    });
    
    window.addEventListener('touchend', () => {
        isScrolling = false;
    });
}

// ===== UI HELPERS =====
function updateCommentaryForPage() {
    // When changing pages, show analyses for this page
    const pageAnalyses = AppState.analyses.filter(a => a.page === AppState.currentPage);
    
    if (pageAnalyses.length === 0) {
        // Show empty state
        const commentary = document.getElementById('commentaryContent');
        commentary.innerHTML = `
            <div class="empty-state">
                <p>Select text or analyze the current page to see AI commentary</p>
                <button class="btn-primary" onclick="analyzeCurrentPage()">
                    Analyze Current Page
                </button>
            </div>
        `;
    } else {
        // Render stored analyses
        const commentary = document.getElementById('commentaryContent');
        commentary.innerHTML = '';
        
        pageAnalyses.forEach((analysis, index) => {
            const card = document.createElement('div');
            card.className = 'analysis-card collapsed';
            
            let icon = analysis.type === 'page' ? '📄' : 
                      analysis.type === 'selection' ? '✨' : '💬';
            let title = analysis.type === 'page' ? 'Page Analysis' :
                       analysis.type === 'selection' ? 'Selection Analysis' : 'Custom Question';
            
            card.innerHTML = `
                <div class="card-header collapsed-header" onclick="toggleCard(this)">
                    <h3>${icon} ${title}</h3>
                    <span class="expand-icon">▼</span>
                </div>
                <div class="card-content" style="display: none;">
                    <div class="analysis-content">
                        ${formatAnalysis(analysis.content)}
                    </div>
                </div>
            `;
            
            commentary.appendChild(card);
        });
        
        // Add analyze page button if no page analysis exists
        const hasPageAnalysis = pageAnalyses.some(a => a.type === 'page');
        if (!hasPageAnalysis) {
            const btnContainer = document.createElement('div');
            btnContainer.className = 'empty-state';
            btnContainer.innerHTML = `
                <button class="btn-primary" onclick="analyzeCurrentPage()">
                    Analyze Current Page
                </button>
            `;
            commentary.insertBefore(btnContainer, commentary.firstChild);
        }
    }
}

function toggleCard(headerElement) {
    const card = headerElement.closest('.analysis-card');
    const content = card.querySelector('.card-content');
    const icon = headerElement.querySelector('.expand-icon');
    
    if (card.classList.contains('collapsed')) {
        card.classList.remove('collapsed');
        content.style.display = 'block';
        icon.textContent = '▲';
    } else {
        card.classList.add('collapsed');
        content.style.display = 'none';
        icon.textContent = '▼';
    }
}

function updateApiCounter() {
    const counterText = document.getElementById('apiUsageText');
    const estimatedCost = AppState.apiCallCount * 0.02; // Rough estimate
    
    counterText.textContent = `${AppState.apiCallCount}/${AppState.maxApiCalls} calls`;
    
    // Update session stats
    document.getElementById('sessionApiCalls').textContent = AppState.apiCallCount;
    document.getElementById('estimatedCost').textContent = `$${estimatedCost.toFixed(2)}`;
    
    // Warn if approaching limit
    if (AppState.apiCallCount >= AppState.maxApiCalls * 0.9) {
        counterText.classList.add('warning');
    }
}

function checkApiKey() {
    if (!AppState.apiKey) {
        alert('Please enter your API key in settings');
        showApiKeyModal();
        return false;
    }
    return true;
}

function checkApiLimit() {
    if (AppState.apiCallCount >= AppState.maxApiCalls) {
        alert(`You've reached the API call limit (${AppState.maxApiCalls} calls). Increase the limit in settings or start a new session.`);
        return false;
    }
    return true;
}

// ===== SETTINGS =====
function loadSettings() {
    AppState.theme = localStorage.getItem(CONFIG.STORAGE_KEYS.THEME) || 'light';
    AppState.fontSize = parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.FONT_SIZE)) || 16;
    AppState.maxApiCalls = parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.MAX_API_CALLS)) || CONFIG.DEFAULT_MAX_API_CALLS;
    
    // Reset API count on new session (or you could persist it)
    AppState.apiCallCount = 0;
}

function applyTheme() {
    document.body.classList.toggle('dark-theme', AppState.theme === 'dark');
    const icon = document.querySelector('.theme-icon');
    icon.textContent = AppState.theme === 'dark' ? '🌙' : '☀️';
}

function toggleTheme() {
    AppState.theme = AppState.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem(CONFIG.STORAGE_KEYS.THEME, AppState.theme);
    applyTheme();
}

function applyFontSize() {
    document.documentElement.style.setProperty('--base-font-size', `${AppState.fontSize}px`);
}

function increaseFontSize() {
    if (AppState.fontSize < 24) {
        AppState.fontSize += 2;
        localStorage.setItem(CONFIG.STORAGE_KEYS.FONT_SIZE, AppState.fontSize);
        applyFontSize();
    }
}

function decreaseFontSize() {
    if (AppState.fontSize > 12) {
        AppState.fontSize -= 2;
        localStorage.setItem(CONFIG.STORAGE_KEYS.FONT_SIZE, AppState.fontSize);
        applyFontSize();
    }
}

// ===== MODALS =====
function showApiKeyModal() {
    document.getElementById('apiKeyModal').classList.add('active');
}

function hideApiKeyModal() {
    document.getElementById('apiKeyModal').classList.remove('active');
}

function saveApiKey() {
    const input = document.getElementById('apiKeyInput');
    const key = input.value.trim();
    
    if (key.startsWith('sk-ant-')) {
        localStorage.setItem(CONFIG.STORAGE_KEYS.API_KEY, key);
        AppState.apiKey = key;
        hideApiKeyModal();
        input.value = '';
    } else {
        alert('Invalid API key format. It should start with "sk-ant-"');
    }
}

function clearApiKey() {
    if (confirm('Are you sure you want to clear your stored API key?')) {
        localStorage.removeItem(CONFIG.STORAGE_KEYS.API_KEY);
        AppState.apiKey = null;
        showApiKeyModal();
    }
}

function toggleSettings() {
    const panel = document.getElementById('settingsPanel');
    panel.classList.toggle('hidden');
}

function showPromptEditor(type) {
    const modal = document.getElementById('promptEditorModal');
    const editor = document.getElementById('promptEditor');
    const title = document.getElementById('promptEditorTitle');
    
    modal.dataset.promptType = type;
    
    if (type === 'page') {
        title.textContent = 'Edit Page Analysis Prompt';
        editor.value = getConfigValue('PAGE_PROMPT', CONFIG.DEFAULT_PROMPTS.PAGE_ANALYSIS);
    } else {
        title.textContent = 'Edit Selection Analysis Prompt';
        editor.value = getConfigValue('SELECTION_PROMPT', CONFIG.DEFAULT_PROMPTS.SELECTION_ANALYSIS);
    }
    
    modal.classList.remove('hidden');
}

function savePrompt() {
    const modal = document.getElementById('promptEditorModal');
    const editor = document.getElementById('promptEditor');
    const type = modal.dataset.promptType;
    
    const key = type === 'page' ? 'PAGE_PROMPT' : 'SELECTION_PROMPT';
    saveConfigValue(key, editor.value);
    
    modal.classList.add('hidden');
    alert('Prompt saved successfully!');
}

function resetPrompt() {
    const modal = document.getElementById('promptEditorModal');
    const editor = document.getElementById('promptEditor');
    const type = modal.dataset.promptType;
    
    if (confirm('Reset to default prompt?')) {
        if (type === 'page') {
            editor.value = CONFIG.DEFAULT_PROMPTS.PAGE_ANALYSIS;
        } else {
            editor.value = CONFIG.DEFAULT_PROMPTS.SELECTION_ANALYSIS;
        }
    }
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    // API Key Modal
    document.getElementById('saveApiKey').addEventListener('click', saveApiKey);
    document.getElementById('apiKeyInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') saveApiKey();
    });
    
    // Navigation
    document.getElementById('prevPageBtn').addEventListener('click', prevPage);
    document.getElementById('nextPageBtn').addEventListener('click', nextPage);
    document.getElementById('jumpToPageBtn').addEventListener('click', jumpToPage);
    document.getElementById('jumpToPageInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') jumpToPage();
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        if (e.key === 'ArrowLeft') prevPage();
        if (e.key === 'ArrowRight') nextPage();
    });
    
    // Top nav buttons
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    document.getElementById('fontIncrease').addEventListener('click', increaseFontSize);
    document.getElementById('fontDecrease').addEventListener('click', decreaseFontSize);
    document.getElementById('settingsBtn').addEventListener('click', toggleSettings);
    
    // Analyze page button
    document.getElementById('analyzePageBtn').addEventListener('click', analyzeCurrentPage);
    
    // Question input
    document.getElementById('askQuestionBtn').addEventListener('click', askCustomQuestion);
    document.getElementById('questionInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') askCustomQuestion();
    });
    
    // Settings panel
    document.getElementById('closeSettings').addEventListener('click', () => {
        document.getElementById('settingsPanel').classList.add('hidden');
    });
    document.getElementById('clearApiKey').addEventListener('click', clearApiKey);
    document.getElementById('editPagePrompt').addEventListener('click', () => showPromptEditor('page'));
    document.getElementById('editSelectionPrompt').addEventListener('click', () => showPromptEditor('selection'));
    document.getElementById('maxApiCalls').addEventListener('change', (e) => {
        AppState.maxApiCalls = parseInt(e.target.value);
        saveConfigValue('MAX_API_CALLS', AppState.maxApiCalls);
        updateApiCounter();
    });
    
    // Prompt editor
    document.getElementById('savePrompt').addEventListener('click', savePrompt);
    document.getElementById('cancelPrompt').addEventListener('click', () => {
        document.getElementById('promptEditorModal').classList.add('hidden');
    });
    document.getElementById('resetPrompt').addEventListener('click', resetPrompt);
    
    // Scroll zone
    setupScrollZone();
}

function updateUI() {
    updateApiCounter();
    document.getElementById('maxApiCalls').value = AppState.maxApiCalls;
}
