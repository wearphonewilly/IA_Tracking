// API Base URL
const API_BASE = window.location.origin;

// Cargar datos al iniciar
document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadQueries();
});

// Cargar estadísticas
async function loadStats() {
    try {
        console.log('Sending GET request to /api/stats');
        const response = await fetch(`${API_BASE}/api/stats`);
        const stats = await response.json();
        console.log('Response from /api/stats:', stats);

        document.getElementById('stat-active-queries').textContent = stats.active_queries;
        document.getElementById('stat-total-results').textContent = stats.total_results;
        document.getElementById('stat-avg-visibility').textContent = `${stats.avg_visibility}%`;
        document.getElementById('stat-total-models').textContent = stats.total_models;

        // Cambios simulados (puedes mejorar esto con datos reales)
        if (stats.active_queries > 0) {
            document.getElementById('stat-active-change').innerHTML =
                '<span style="color: #10b981;">↑</span> +12% este mes';
        }
        if (stats.total_results > 0) {
            document.getElementById('stat-total-change').innerHTML =
                `<span style="color: #10b981;">↑</span> +${stats.total_results} tracking`;
        }
    } catch (error) {
        console.error('Error cargando estadísticas:', error);
    }
}

// Cargar queries
async function loadQueries() {
    try {
        console.log('Sending GET request to /api/queries');
        const response = await fetch(`${API_BASE}/api/queries`);
        const queries = await response.json();
        console.log('Response from /api/queries:', queries);

        const container = document.getElementById('queries-container');
        container.innerHTML = '';

        if (queries.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No hay queries configuradas aún.</p>
                    <button class="btn btn-primary" onclick="createNewQuery()" style="margin-top: 1rem;">
                        Crear Primera Query
                    </button>
                </div>
            `;
            return;
        }

        queries.forEach(query => {
            const queryElement = createQueryElement(query);
            container.appendChild(queryElement);
        });
    } catch (error) {
        console.error('Error cargando queries:', error);
    }
}

// Crear elemento de query
function createQueryElement(query) {
    const div = document.createElement('div');
    div.className = 'query-group';

    div.innerHTML = `
        <div class="query-header">
            <h3>${escapeHtml(query.name)}</h3>
            <div class="query-actions">
                <button class="btn btn-secondary" onclick="editQuery('${query.id}')">
                    <span class="icon">✎</span> Editar
                </button>
                <button class="btn btn-danger" onclick="deleteQueryConfirm('${query.id}', '${escapeHtml(query.name)}')">
                    <span class="icon">🗑</span> Eliminar
                </button>
            </div>
        </div>
        <div class="query-content">
            ${createQueryTable(query)}
        </div>
    `;

    return div;
}

// Crear tabla de query
function createQueryTable(query) {
    const keywords = query.keywords || [];

    if (keywords.length === 0) {
        return '<div style="padding: 2rem; text-align: center; color: #64748b;">No hay keywords configuradas</div>';
    }

    let tableRows = '';

    const keywordMetrics = query.keyword_metrics || {};

    keywords.forEach(keyword => {
        const metrics = keywordMetrics[keyword];
        const currentVis = metrics ? `${metrics.avg_visibility}%` : '-';
        const currentPos = metrics ? metrics.avg_position : '-';

        tableRows += `
            <tr>
                <td><span class="keyword-tag">${escapeHtml(keyword)}</span></td>
                <td class="font-medium">${currentPos}</td>
                <td class="font-medium">${currentVis}</td>
                <td>-</td>
                <td>-</td>
                <td>
                    <button class="btn btn-track" onclick="trackQuery('${query.id}')">
                        ▷ Trackear
                    </button>
                    <button class="btn btn-icon-small" onclick="showMetricsInfo()" title="¿Qué son estas métricas?">
                        ?
                    </button>
                </td>
            </tr>
        `;
    });

    return `
        <table class="query-table">
            <thead>
                <tr>
                    <th>Keyword</th>
                    <th>Pos. Avg</th>
                    <th>Visibilidad</th>
                    <th>7 días</th>
                    <th>30 días</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>
    `;
}

// Funciones de navegación
function createNewQuery() {
    window.location.href = `/query/new/edit`;
}

function editQuery(queryId) {
    window.location.href = `/query/${queryId}/edit`;
}

function trackQuery(queryId) {
    window.location.href = `/query/${queryId}`;
}

// Eliminar query
async function deleteQueryConfirm(queryId, queryName) {
    if (!confirm(`¿Estás seguro de que quieres eliminar la query "${queryName}"?`)) {
        return;
    }

    try {
        console.log(`Sending DELETE request to ${API_BASE}/api/queries/${queryId}`);
        const response = await fetch(`${API_BASE}/api/queries/${queryId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            loadQueries();
            loadStats();
        } else {
            alert('Error al eliminar la query');
        }
    } catch (error) {
        console.error('Error eliminando query:', error);
        alert('Error al eliminar la query');
    }
}

// Actualizar datos
function refreshData() {
    loadStats();
    loadQueries();
}

// Mostrar info de métricas
function showMetricsInfo() {
    alert(
        "Métricas de Tracking:\n\n" +
        "Pos. Avg (Posición Promedio): Indica en qué párrafo aparece tu marca/keyword. 1 = Primer párrafo (mejor).\n\n" +
        "Visibilidad: Porcentaje calculado (0-100%) basado en la frecuencia de menciones y qué tan al principio aparecen."
    );
}

// Utilidades
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
