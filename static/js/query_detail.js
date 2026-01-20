// API Base URL
const API_BASE = window.location.origin;

let queryData = null;
let trackingResults = [];

// Cargar datos al iniciar
document.addEventListener('DOMContentLoaded', async () => {
    if (!queryId) {
        alert('Query ID no válido');
        window.location.href = '/';
        return;
    }

    await loadQuery();
    await loadTrackingResults();
});

// Cargar query
async function loadQuery() {
    try {
        console.log(`Sending GET request to /api/queries/${queryId}`);
        const response = await fetch(`${API_BASE}/api/queries/${queryId}`);
        queryData = await response.json();
        console.log('Response from /api/queries/' + queryId + ':', queryData);

        document.getElementById('query-title').textContent = queryData.name;

        const stats = queryData.stats || {};
        const prompts = queryData.prompts || {};

        // Contar total de preguntas (líneas en todos los prompts)
        let totalQuestions = 0;
        Object.values(prompts).forEach(promptText => {
            const lines = promptText.split('\n').filter(line => line.trim());
            totalQuestions += lines.length;
        });

        const totalModels = queryData.models?.length || 0;

        document.getElementById('query-subtitle').textContent =
            `${totalQuestions} preguntas · ${totalModels} modelos`;

        renderQueryContent();
    } catch (error) {
        console.error('Error cargando query:', error);
        alert('Error al cargar la query');
        window.location.href = '/';
    }
}

// Cargar resultados de tracking
async function loadTrackingResults() {
    try {
        console.log(`Sending GET request to /api/queries/${queryId}/results`);
        const response = await fetch(`${API_BASE}/api/queries/${queryId}/results`);
        trackingResults = await response.json();
        console.log('Response from /api/queries/' + queryId + '/results:', trackingResults);
        renderQueryContent();
    } catch (error) {
        console.error('Error cargando resultados de tracking:', error);
    }
}

// Renderizar contenido de la query
function renderQueryContent() {
    const container = document.getElementById('query-content');
    container.innerHTML = '';

    const prompts = queryData.prompts || {};
    const keywords = queryData.keywords || [];
    const models = queryData.models || [];

    // Agrupar prompts por pregunta (cada línea es una pregunta)
    const questions = [];

    Object.entries(prompts).forEach(([language, promptText]) => {
        const questionLines = promptText.split('\n').filter(line => line.trim());
        questionLines.forEach((questionText) => {
            questions.push({
                text: questionText.trim(),
                language: language
            });
        });
    });

    if (questions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No hay preguntas configuradas para esta query.</p>
                <button class="btn btn-primary" onclick="editQuery()" style="margin-top: 1rem;">
                    Editar Query
                </button>
            </div>
        `;
        return;
    }

    questions.forEach((question, questionIndex) => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'question-item';

        // Crear fila de modelos para esta pregunta
        let modelsHtml = '';
        models.forEach(modelId => {
            // Obtener nombre del modelo de la lista de modelos disponibles
            const modelName = getModelName(modelId);

            modelsHtml += `
                <div class="model-result">
                    <div class="model-result-header">${escapeHtml(modelName)}</div>
                    ${keywords.map(keyword => {
                // Buscar resultado más reciente para esta pregunta, keyword y modelo
                const result = trackingResults
                    .filter(r =>
                        r.question_text === question.text &&
                        r.keyword === keyword &&
                        r.model_id === modelId
                    )
                    .sort((a, b) => new Date(b.tracked_at) - new Date(a.tracked_at))[0];

                const position = result && result.position !== null
                    ? result.position.toFixed(2)
                    : 'Sin datos';
                const visibility = result && result.visibility !== null
                    ? `${result.visibility.toFixed(2)}%`
                    : 'Pendiente';

                return `
                            <div style="margin-bottom: 0.75rem;">
                                <div style="font-size: 0.75rem; color: #64748b; margin-bottom: 0.25rem;">Keyword</div>
                                <span class="keyword-tag">${escapeHtml(keyword)}</span>
                                <div class="metrics-row" style="margin-top: 0.75rem;">
                                    <div class="metric-item">
                                        <div class="metric-label">Pos. Actual</div>
                                        <div class="metric-value">${position}</div>
                                    </div>
                                    <div class="metric-item">
                                        <div class="metric-label">Cambio 24h</div>
                                        <div class="metric-value">-</div>
                                    </div>
                                    <div class="metric-item">
                                        <div class="metric-label">Visibilidad</div>
                                        <div class="metric-value">${visibility}</div>
                                    </div>
                                </div>
                            </div>
                        `;
            }).join('')}
                </div>
            `;
        });

        questionDiv.innerHTML = `
            <div class="question-header">
                <div>
                    <div class="question-text">${escapeHtml(question.text)}</div>
                    <div class="question-meta" style="margin-top: 0.75rem;">
                        <span class="question-tag">🇪🇸 ${escapeHtml(question.language)}</span>
                        <span class="question-tag">${keywords.length} keyword${keywords.length !== 1 ? 's' : ''}</span>
                    </div>
                </div>
                <button class="btn btn-track" onclick="trackQuery()">
                    ▷ Trackear
                </button>
            </div>
            ${modelsHtml}
        `;

        container.appendChild(questionDiv);
    });
}

// Obtener nombre del modelo (función síncrona)
function getModelName(modelId) {
    const modelMap = {
        'meta-llama/llama-4-maverick-17b-128e-instruct': 'Llama 4 Maverick',
        'meta-llama/llama-4-scout-17b-16e-instruct': 'Llama 4 Scout',
        'qwen/qwen3-32b': 'Qwen 3',
        'gemini-2.0-flash': 'Gemini 2.0 Flash',
        'deepseek-chat': 'DeepSeek Chat'
    };
    return modelMap[modelId] || modelId;
}

// Trackear query
async function trackQuery() {
    if (!confirm('¿Deseas iniciar el tracking de esta query? Esto puede tomar unos minutos.')) {
        return;
    }

    // Obtener todos los botones de trackear y deshabilitarlos
    const buttons = document.querySelectorAll('.btn-track');
    const originalTexts = [];

    console.log('Iniciando tracking...');

    buttons.forEach((btn, index) => {
        originalTexts[index] = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Trackeando...';
    });

    // Eliminado el bloqueo de otros botones

    try {
        const url = `${API_BASE}/api/queries/${queryId}/track`;
        console.log('--- Tracking Request Start ---');
        console.log('URL:', url);
        console.log('Method: POST');
        console.log('Body: {} (No payload for this request)');

        console.log(`Enviando petición POST a ${url}`);
        const response = await fetch(url, {
            method: 'POST'
        });

        console.log('Respuesta recibida:', response.status);

        if (response.ok) {
            const result = await response.json();
            console.log('--- Tracking Response Data ---');
            console.log(result);
            console.log('--- Tracking Request End ---');

            console.log('Tracking completado con éxito:', result);
            // No necesitamos alertar porque ya se ve el resultado visualmente, pero mantenemos el alert por ahora
            alert('Tracking completado. Los resultados se han guardado.');
            await loadTrackingResults(); // Recargar resultados
            renderQueryContent(); // Re-renderizar (esto reseteará los botones)
        } else {
            const error = await response.json();
            console.error('Error en la respuesta:', error);
            alert(`Error: ${error.error || 'Error al realizar el tracking'}`);
            // Restaurar botones si hubo error (si no hubo re-render)
            buttons.forEach((btn, index) => {
                btn.disabled = false;
                btn.innerHTML = originalTexts[index];
            });
        }
    } catch (error) {
        console.error('Error en tracking:', error);
        alert('Error al realizar el tracking');
        // Restaurar botones
        buttons.forEach((btn, index) => {
            btn.disabled = false;
            btn.innerHTML = originalTexts[index];
        });
    }
}

// Editar query
function editQuery() {
    window.location.href = `/query/${queryId}/edit`;
}

// Eliminar query
async function deleteQuery() {
    if (!confirm(`¿Estás seguro de que quieres eliminar la query "${queryData.name}"?`)) {
        return;
    }

    try {
        console.log(`Sending DELETE request to ${API_BASE}/api/queries/${queryId}`);
        const response = await fetch(`${API_BASE}/api/queries/${queryId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            alert('Query eliminada correctamente');
            window.location.href = '/';
        } else {
            alert('Error al eliminar la query');
        }
    } catch (error) {
        console.error('Error eliminando query:', error);
        alert('Error al eliminar la query');
    }
}

// Actualizar datos
async function refreshData() {
    await loadQuery();
    await loadTrackingResults();
}

// Volver atrás
function goBack() {
    window.location.href = '/';
}

// Utilidades
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
