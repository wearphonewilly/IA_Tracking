// API Base URL
const API_BASE = window.location.origin;

let keywords = [];
let competitors = [];
let selectedModels = [];
let availableModels = [];

// Cargar datos al iniciar
document.addEventListener('DOMContentLoaded', async () => {
    await loadModels();

    if (queryId && queryId !== '0') {
        await loadQuery(queryId);
        document.getElementById('page-title').textContent = 'Edit Configuration';
    } else {
        document.getElementById('page-title').textContent = 'Create Configuration';
    }

    // Event listeners
    document.getElementById('keyword-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addKeyword();
        }
    });

    document.getElementById('competitor-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addCompetitor();
        }
    });

    document.getElementById('query-form').addEventListener('submit', handleSubmit);
});

// Cargar modelos disponibles
async function loadModels() {
    try {
        const response = await fetch(`${API_BASE}/api/models`);
        availableModels = await response.json();
        renderModels();
    } catch (error) {
        console.error('Error cargando modelos:', error);
    }
}

// Cargar query existente
async function loadQuery(queryId) {
    try {
        const response = await fetch(`${API_BASE}/api/queries/${queryId}`);
        const query = await response.json();

        // Llenar formulario
        document.getElementById('query-name').value = query.name || '';

        keywords = query.keywords || [];
        renderKeywords();

        competitors = query.competitors || [];
        renderCompetitors();

        // Handle prompts (flattened logic for UI)
        // We assume 'Español' or the first key is the main prompt
        const prompts = query.prompts || {};
        const firstKey = Object.keys(prompts)[0];
        const promptText = firstKey ? prompts[firstKey] : '';
        document.getElementById('prompt-text').value = promptText;

        selectedModels = query.models || [];
        renderModels();
    } catch (error) {
        console.error('Error cargando query:', error);
        alert('Error al cargar la query');
    }
}

// --- Keywords Logic ---
function addKeyword() {
    const input = document.getElementById('keyword-input');
    const value = input.value.trim();

    if (value && !keywords.includes(value)) {
        keywords.push(value);
        renderKeywords();
        input.value = '';
    }
}

function renderKeywords() {
    const container = document.getElementById('keywords-container');
    container.innerHTML = '';

    keywords.forEach(keyword => {
        const tag = document.createElement('div');
        tag.className = 'keyword-tag-remove'; // Reusing existing class for now
        tag.style.background = '#e0e7ff';
        tag.style.color = '#4338ca';
        tag.innerHTML = `
            ${escapeHtml(keyword)}
            <button type="button" class="remove-btn" onclick="removeKeyword('${escapeHtml(keyword)}')" style="color:#4338ca;">×</button>
        `;
        container.appendChild(tag);
    });
}

function removeKeyword(keyword) {
    keywords = keywords.filter(k => k !== keyword);
    renderKeywords();
}

// --- Competitors Logic ---
function addCompetitor() {
    const input = document.getElementById('competitor-input');
    const value = input.value.trim();

    if (value && !competitors.includes(value)) {
        competitors.push(value);
        renderCompetitors();
        input.value = '';
    }
}

function renderCompetitors() {
    const container = document.getElementById('competitors-container');
    container.innerHTML = '';

    competitors.forEach(comp => {
        const tag = document.createElement('div');
        tag.className = 'keyword-tag-remove';
        tag.style.background = '#fef3c7'; // Distinct color (yellowish)
        tag.style.color = '#d97706';
        tag.innerHTML = `
            ${escapeHtml(comp)}
            <button type="button" class="remove-btn" onclick="removeCompetitor('${escapeHtml(comp)}')" style="color:#d97706;">×</button>
        `;
        container.appendChild(tag);
    });
}

function removeCompetitor(comp) {
    competitors = competitors.filter(c => c !== comp);
    renderCompetitors();
}

// --- Models Logic ---
function renderModels() {
    const container = document.getElementById('models-container');
    container.innerHTML = '';

    availableModels.forEach(model => {
        const isChecked = selectedModels.includes(model.id);
        const div = document.createElement('div');
        // Card style for models
        div.style.border = isChecked ? '1px solid var(--primary-color)' : '1px solid var(--border-color)';
        div.style.borderRadius = '0.5rem';
        div.style.padding = '1rem';
        div.style.background = isChecked ? '#eff6ff' : 'white';
        div.style.cursor = 'pointer';
        div.style.transition = 'all 0.2s';
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.gap = '1rem';

        div.onclick = (e) => {
            // Prevent triggering if clicking the checkbox directly (avoid double event)
            if (e.target.type !== 'checkbox') {
                toggleModel(model.id);
            }
        };

        div.innerHTML = `
            <input 
                type="checkbox" 
                id="model-${model.id}" 
                ${isChecked ? 'checked' : ''}
                onchange="toggleModel('${model.id}')"
                style="width: 1.25rem; height: 1.25rem; cursor:pointer;"
            >
            <div style="flex:1;">
                <div style="font-weight:500; font-size:0.875rem;">${escapeHtml(model.name)}</div>
                <div style="font-size:0.75rem; color:var(--text-secondary);">${escapeHtml(model.id)}</div>
            </div>
        `;
        container.appendChild(div);
    });
}

function toggleModel(modelId) {
    const index = selectedModels.indexOf(modelId);
    if (index > -1) {
        selectedModels.splice(index, 1);
    } else {
        selectedModels.push(modelId);
    }
    renderModels(); // Re-render to update styles
}

// --- Submit Logic ---
async function saveQuery(redirectUrl = null) {
    const name = document.getElementById('query-name').value.trim();
    const promptText = document.getElementById('prompt-text').value.trim();

    // Validation
    if (!name) { alert('Please enter a Query Group Name.'); return false; }
    if (keywords.length === 0) { alert('Please add at least one Keyword.'); return false; }
    if (!promptText) { alert('Please enter a Prompt Template.'); return false; }
    if (selectedModels.length === 0) { alert('Please select at least one AI Model.'); return false; }

    // Prepare Prompts Object (Defaulting to 'Español' for now as backend expects a dict)
    const prompts = { 'Español': promptText };

    const data = {
        name,
        keywords,
        competitors,
        prompts,
        models: selectedModels
    };

    try {
        const url = queryId && queryId !== '0'
            ? `${API_BASE}/api/queries/${queryId}`
            : `${API_BASE}/api/queries`;

        const method = queryId && queryId !== '0' ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            if (!redirectUrl) {
                alert('Query saved successfully!');
            }
            if (redirectUrl) {
                window.location.href = redirectUrl;
            }
            return true;
        } else {
            const error = await response.json();
            alert(`Error: ${error.error || 'Failed to save query'}`);
            return false;
        }
    } catch (error) {
        console.error('Error saving query:', error);
        alert('Failed to save query');
        return false;
    }
}

async function handleSubmit(e) {
    e.preventDefault();
    await saveQuery('/queries');
}

async function goBack() {
    if (confirm('Discard changes and go back?')) {
        window.location.href = '/queries';
    }
}

// Utilidades
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}


