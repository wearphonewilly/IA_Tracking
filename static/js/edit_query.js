// API Base URL
const API_BASE = window.location.origin;

let keywords = [];
let prompts = {};
let selectedModels = [];
let availableModels = [];

// Cargar datos al iniciar
document.addEventListener('DOMContentLoaded', async () => {
    await loadModels();

    if (queryId && queryId !== '0') {
        await loadQuery(queryId);
        document.getElementById('page-title').textContent = 'Editar Query';
    } else {
        document.getElementById('page-title').textContent = 'Nueva Query';
        // Añadir idioma por defecto
        addLanguage('Español');
    }

    // Event listener para Enter en keyword input
    document.getElementById('keyword-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addKeyword();
        }
    });

    // Event listener para formulario
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

        prompts = query.prompts || {};
        if (Object.keys(prompts).length === 0) {
            addLanguage('Español');
        } else {
            renderPrompts();
        }

        selectedModels = query.models || [];
        renderModels();
    } catch (error) {
        console.error('Error cargando query:', error);
        alert('Error al cargar la query');
    }
}

// Añadir keyword
function addKeyword() {
    const input = document.getElementById('keyword-input');
    const keyword = input.value.trim();

    if (keyword && !keywords.includes(keyword)) {
        keywords.push(keyword);
        renderKeywords();
        input.value = '';
    }
}

// Renderizar keywords
function renderKeywords() {
    const container = document.getElementById('keywords-container');
    container.innerHTML = '';

    keywords.forEach(keyword => {
        const tag = document.createElement('div');
        tag.className = 'keyword-tag-remove';
        tag.innerHTML = `
            ${escapeHtml(keyword)}
            <button type="button" class="remove-btn" onclick="removeKeyword('${escapeHtml(keyword)}')">×</button>
        `;
        container.appendChild(tag);
    });
}

// Eliminar keyword
function removeKeyword(keyword) {
    keywords = keywords.filter(k => k !== keyword);
    renderKeywords();
}

// Añadir idioma
function addLanguage(language = null) {
    if (!language) {
        language = prompt('Introduce el nombre del idioma:');
        if (!language) return;
    }

    if (prompts[language]) {
        alert('Este idioma ya existe');
        return;
    }

    prompts[language] = '';
    renderPrompts();
}

// Añadir idioma desde el select
function addLanguageFromSelect() {
    const select = document.getElementById('language-select');
    const language = select.value;
    addLanguage(language);
}

// Renderizar prompts
function renderPrompts() {
    const container = document.getElementById('prompts-container');
    container.innerHTML = '';

    Object.keys(prompts).forEach(language => {
        const promptItem = document.createElement('div');
        promptItem.className = 'prompt-item';
        promptItem.innerHTML = `
            <div class="prompt-header">
                <label for="prompt-language-${escapeHtml(language)}" style="font-size: 0.875rem; font-weight: 500; margin-right: 0.75rem;">Idioma</label>
                <select id="prompt-language-${escapeHtml(language)}" class="language-select" onchange="changeLanguagePrompt('${escapeHtml(language)}', this.value)" style="flex: 1; max-width: 200px;">
                    <option value="${escapeHtml(language)}">${escapeHtml(language)}</option>
                    ${Object.keys(prompts).filter(l => l !== language).map(l =>
            `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`
        ).join('')}
                </select>
                <div class="prompt-actions">
                    <button type="button" class="btn-icon" onclick="deletePrompt('${escapeHtml(language)}')" title="Eliminar">
                        🗑
                    </button>
                </div>
            </div>
            <label for="prompt-text-${escapeHtml(language)}" style="display: block; font-size: 0.875rem; font-weight: 500; margin-top: 1rem; margin-bottom: 0.5rem;">Prompt en ${escapeHtml(language)}</label>
            <textarea 
                id="prompt-text-${escapeHtml(language)}"
                class="prompt-textarea" 
                placeholder="Escribe tus prompts aquí, uno por línea. Usa {keyword} como placeholder para tus keywords."
                onchange="updatePrompt('${escapeHtml(language)}', this.value)"
                style="min-height: 150px;"
            >${escapeHtml(prompts[language])}</textarea>
            <small style="display: block; margin-top: 0.5rem;">Usa {keyword} como placeholder para tus keywords</small>
        `;
        container.appendChild(promptItem);
    });
}

// Actualizar prompt
function updatePrompt(language, value) {
    prompts[language] = value;
}

// Cambiar idioma de prompt
function changeLanguagePrompt(oldLanguage, newLanguage) {
    if (prompts[newLanguage]) {
        alert('Este idioma ya existe');
        return;
    }
    prompts[newLanguage] = prompts[oldLanguage];
    delete prompts[oldLanguage];
    renderPrompts();
}

// Eliminar prompt
function deletePrompt(language) {
    if (Object.keys(prompts).length === 1) {
        alert('Debes tener al menos un idioma');
        return;
    }

    if (confirm(`¿Eliminar el prompt en ${language}?`)) {
        delete prompts[language];
        renderPrompts();
    }
}

// Renderizar modelos
function renderModels() {
    const container = document.getElementById('models-container');
    container.innerHTML = '';

    availableModels.forEach(model => {
        const modelItem = document.createElement('div');
        modelItem.className = 'model-item';
        const isChecked = selectedModels.includes(model.id);

        modelItem.innerHTML = `
            <input 
                type="checkbox" 
                id="model-${model.id}" 
                ${isChecked ? 'checked' : ''}
                onchange="toggleModel('${model.id}')"
            >
            <div class="model-info">
                <div class="model-name">${escapeHtml(model.name)}</div>
                <div class="model-id">${escapeHtml(model.id)}</div>
            </div>
        `;
        container.appendChild(modelItem);
    });
}

// Toggle modelo
function toggleModel(modelId) {
    const index = selectedModels.indexOf(modelId);
    if (index > -1) {
        selectedModels.splice(index, 1);
    } else {
        selectedModels.push(modelId);
    }
}

// Manejar submit
// Función para guardar
async function saveQuery(redirectUrl = null) {
    const name = document.getElementById('query-name').value.trim();

    if (!name) {
        alert('Por favor, introduce un nombre para la query');
        return false;
    }

    if (keywords.length === 0) {
        alert('Por favor, añade al menos una keyword');
        return false;
    }

    if (Object.keys(prompts).length === 0) {
        alert('Por favor, añade al menos un prompt');
        return false;
    }

    // Verificar que todos los prompts tengan texto
    for (const [language, promptText] of Object.entries(prompts)) {
        if (!promptText.trim()) {
            alert(`Por favor, completa el prompt en ${language}`);
            return false;
        }
    }

    if (selectedModels.length === 0) {
        alert('Por favor, selecciona al menos un modelo');
        return false;
    }

    const data = {
        name,
        keywords,
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
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            const result = await response.json();
            // Solo mostrar alerta si no vamos a redireccionar inmediatamente o si es un guardado explícito
            if (!redirectUrl) {
                alert(queryId && queryId !== '0'
                    ? 'Query actualizada correctamente'
                    : 'Query creada correctamente'
                );
            }

            if (redirectUrl) {
                window.location.href = redirectUrl;
            }
            return true;
        } else {
            const error = await response.json();
            alert(`Error: ${error.error || 'Error al guardar la query'}`);
            return false;
        }
    } catch (error) {
        console.error('Error guardando query:', error);
        alert('Error al guardar la query');
        return false;
    }
}

// Manejar submit
async function handleSubmit(e) {
    e.preventDefault();
    await saveQuery('/');
}

// Volver atrás (guardando)
async function goBack() {
    // Intentar guardar antes de salir
    // Si la validación falla (devuelve false), no salimos
    await saveQuery('/');
}

// Utilidades
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

