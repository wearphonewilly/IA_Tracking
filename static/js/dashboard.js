// API Base URL
const API_BASE = window.location.origin;

// Chart instance
let coverageChart = null;

// Cargar datos al iniciar
document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadChart();
    loadRanking();
    loadTopPrompts();
});

// Cargar estadísticas
async function loadStats() {
    try {
        const response = await fetch(`${API_BASE}/api/stats`);
        const stats = await response.json();

        updateElement('stat-active-queries', stats.active_queries);
        updateElement('stat-total-mentions', formatNumber(stats.total_mentions));
        updateElement('stat-avg-visibility', `${stats.avg_visibility}%`);
        updateElement('stat-active-models', stats.total_models);

        // Simular progreso en el anillo si existiera
        const progressElement = document.querySelector('.stat-progress');
        if (progressElement) {
            // ... lógica de anillo de progreso
        }

    } catch (error) {
        console.error('Error cargando estadísticas:', error);
    }
}

// Cargar gráfico de cobertura
async function loadChart() {
    try {
        const response = await fetch(`${API_BASE}/api/chart-data`);
        const data = await response.json();

        const ctx = document.getElementById('coverageChart').getContext('2d');

        if (coverageChart) {
            coverageChart.destroy();
        }

        coverageChart = new Chart(ctx, {
            type: 'line',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false // Usamos nuestra propia leyenda HTML si queremos
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: '#fff',
                        titleColor: '#1e293b',
                        bodyColor: '#64748b',
                        borderColor: '#e2e8f0',
                        borderWidth: 1
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: {
                            color: '#f3f4f6'
                        },
                        ticks: {
                            callback: function (value) {
                                return value + '%';
                            }
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                elements: {
                    point: {
                        radius: 0,
                        hitRadius: 10,
                        hoverRadius: 4
                    }
                }
            }
        });

    } catch (error) {
        console.error('Error cargando gráfico:', error);
    }
}

// Cargar Ranking
async function loadRanking() {
    try {
        const response = await fetch(`${API_BASE}/api/ranking`);
        const ranking = await response.json();

        const tbody = document.querySelector('#ranking-table tbody');
        tbody.innerHTML = '';

        ranking.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="rank-badge">#${item.rank}</span></td>
                <td>
                    <div style="display:flex;align-items:center;gap:0.5rem;">
                        <span class="avatar" style="width:24px;height:24px;font-size:10px;background:#dbeafe;color:#3b82f6;">${item.brand.substring(0, 1)}</span>
                        ${escapeHtml(item.brand)}
                    </div>
                </td>
                <td style="font-weight:600;">${item.share_of_voice}%</td>
                <td><span class="trend-up">↑ 2.4%</span></td> 
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error('Error cargando ranking:', error);
    }
}

// Cargar Top Prompts
async function loadTopPrompts() {
    try {
        const response = await fetch(`${API_BASE}/api/top-prompts`);
        const prompts = await response.json();

        const listContainer = document.getElementById('top-prompts-list');
        listContainer.innerHTML = '';

        prompts.forEach((prompt, index) => {
            const div = document.createElement('div');
            div.className = 'prompt-list-item';
            div.innerHTML = `
                <div class="prompt-icon">💬</div>
                <div class="prompt-content">
                    <h4>"${escapeHtml(prompt.text)}"</h4>
                    <div class="prompt-meta">
                        Frequency: ${prompt.frequency} • Avg. Rank: <span class="rank-badge">#${Math.round(prompt.avg_rank)}</span>
                    </div>
                </div>
            `;
            listContainer.appendChild(div);
        });

    } catch (error) {
        console.error('Error cargando prompts:', error);
    }
}

// Trackear Todo
async function trackAll() {
    const btn = document.getElementById('btn-track-all');
    const originalText = btn.innerHTML;

    if (confirm('¿Estás seguro de que quieres iniciar el tracking para TODOS los prompts? Esto puede tardar varios minutos y consumir recursos de API.')) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Iniciando...';

        try {
            const response = await fetch(`${API_BASE}/api/track-all`, { method: 'POST' });
            const result = await response.json();

            alert(result.message || 'Tracking iniciado. Los resultados irán apareciendo progresivamente.');

            // Recargar datos después de unos segundos
            setTimeout(() => {
                loadStats();
                loadChart();
                loadRanking();
            }, 5000);

        } catch (error) {
            console.error('Error tracking all:', error);
            alert('Error al iniciar tracking masivo');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
}

// Helper functions
function updateElement(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatNumber(num) {
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
}

// Navigation helpers
function createNewQuery() {
    window.location.href = `/query/new/edit`;
}

