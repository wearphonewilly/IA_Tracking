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
        const response = await fetch(`${API_BASE}/api/stats`);
        const stats = await response.json();
        
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
        const response = await fetch(`${API_BASE}/api/queries`);
        const queries = await response.json();
        
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
                <button class="btn btn-secondary" onclick="editQuery(${query.id})">
                    <span class="icon">✎</span> Editar
                </button>
                <button class="btn btn-danger" onclick="deleteQueryConfirm(${query.id}, '${escapeHtml(query.name)}')">
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
    
    keywords.forEach(keyword => {
        tableRows += `
            <tr>
                <td><span class="keyword-tag">${escapeHtml(keyword)}</span></td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td>-</td>
                <td>
                    <button class="btn btn-track" onclick="trackQuery(${query.id})">
                        ▷ Trackear
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
                    <th>Pos. Actual</th>
                    <th>24h</th>
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
    window.location.href = `/query/0/edit`;
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

// Utilidades
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

