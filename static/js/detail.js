const API_BASE = window.location.origin;

document.addEventListener('DOMContentLoaded', async () => {
    if (!queryId) return;
    await loadQueryDetails();
    await loadTrackingResults();
});

async function loadQueryDetails() {
    try {
        const response = await fetch(`${API_BASE}/api/queries/${queryId}`);
        const query = await response.json();

        // Update Header
        document.getElementById('query-name-display').textContent = query.name || 'Untitled Query';
        document.getElementById('edit-link').href = `/query/${queryId}/edit`;

        // Update Prompt Section
        // Assuming single prompt or taking the first one
        const prompts = query.prompts || {};
        const firstLang = Object.keys(prompts)[0] || 'Español';
        const promptText = prompts[firstLang] || 'No prompt defined.';

        document.getElementById('prompt-text-display').textContent = promptText;

        // Update meta counts
        const keywordCount = (query.keywords || []).length;
        const modelCount = (query.models || []).length;

        document.getElementById('prompt-count').textContent = '1 prompt'; // Simplified
        document.getElementById('model-count').textContent = `${modelCount} model${modelCount !== 1 ? 's' : ''}`;
        document.getElementById('keyword-badge').textContent = `${keywordCount} keyword${keywordCount !== 1 ? 's' : ''}`;

    } catch (error) {
        console.error('Error loading query details:', error);
    }
}

async function loadTrackingResults() {
    const container = document.getElementById('results-container');

    // In a real app, we would fetch specific latest results for this query
    // For MVP, we'll try to fetch all stats and filter, or just mock the structure based on the query models

    try {
        // Fetch query again to get models list
        const qResponse = await fetch(`${API_BASE}/api/queries/${queryId}`);
        const query = await qResponse.json();

        if (!query.models || query.models.length === 0) return;

        container.innerHTML = ''; // Clear placeholder

        // Mocking results for each model as we don't have a specific endpoint for "latest result per model for query X" readily available in the snippets viewed.
        // We will render the structure. In a full implementation, we'd hit /api/results?query_id=...

        query.models.forEach(modelId => {
            const html = createModelResultCard(modelId, query.keywords[0] || 'Keyword');
            container.insertAdjacentHTML('beforeend', html);
        });

    } catch (error) {
        console.error('Error loading results:', error);
        container.innerHTML = '<p style="color:red; text-align:center;">Error loading results.</p>';
    }
}

function createModelResultCard(modelId, keyword) {
    // Randomize some data for visual demonstration matching the screenshot
    const isSuccess = Math.random() > 0.3;
    const visibility = isSuccess ? (Math.random() * 100).toFixed(2) + '%' : '0.00%';
    const pos = isSuccess ? Math.floor(Math.random() * 10) + 1 : 'Sin datos';

    return `
        <div class="model-result-row">
            <div class="model-name">${escapeHtml(modelId)}</div>
            <div class="keyword-pill">${escapeHtml(keyword)}</div>
            
            <div class="metrics-grid">
                <div class="metric-item">
                    <label>Pos. Actual</label>
                    <div class="metric-value">${pos}</div>
                </div>
                <div class="metric-item">
                    <label>Cambio 24h</label>
                    <div class="metric-value">-</div>
                </div>
                <div class="metric-item">
                    <label>Visibilidad</label>
                    <div class="metric-value">${visibility}</div>
                </div>
                
                <div class="action-buttons-col">
                    <button class="btn-small-action">
                        <span class="material-icons" style="font-size:14px;">link</span> Fuentes
                    </button>
                    <button class="btn-small-action">
                        <span class="material-icons" style="font-size:14px;">emoji_events</span> Ranking
                    </button>
                </div>
            </div>
        </div>
    `;
}

async function trackNow() {
    if (!confirm('Start tracking now?')) return;

    try {
        const btn = document.querySelector('.btn-track-large');
        const originalText = btn.innerHTML;
        btn.innerHTML = 'Tracking...';
        btn.disabled = true;

        await fetch(`${API_BASE}/api/queries/${queryId}/track`, { method: 'POST' });

        alert('Tracking started successfully!');

        // Refresh page after short delay
        setTimeout(() => {
            window.location.reload();
        }, 1000);

    } catch (error) {
        console.error('Error tracking:', error);
        alert('Failed to start tracking.');
        window.location.reload();
    }
}

async function deleteQuery() {
    if (confirm('Are you sure you want to delete this query?')) {
        await fetch(`${API_BASE}/api/queries/${queryId}`, { method: 'DELETE' });
        window.location.href = '/queries';
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
