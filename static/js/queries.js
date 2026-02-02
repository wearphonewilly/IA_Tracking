// API Base URL
const API_BASE = window.location.origin;

document.addEventListener('DOMContentLoaded', () => {
    fetchQueries();
});

async function fetchQueries() {
    const grid = document.getElementById('queries-grid');
    const loading = document.getElementById('loading');
    const noData = document.getElementById('no-data');

    try {
        const response = await fetch(`${API_BASE}/api/queries?t=${new Date().getTime()}`);
        const queries = await response.json();

        loading.style.display = 'none';

        if (queries.length === 0) {
            noData.style.display = 'block';
            return;
        }

        queries.forEach(query => {
            const card = createQueryCard(query);
            grid.appendChild(card);
        });

    } catch (error) {
        console.error('Error fetching queries:', error);
        loading.textContent = 'Error loading queries. Please try again.';
    }
}

function createQueryCard(query) {
    const card = document.createElement('div');
    card.className = 'content-card';
    card.style.position = 'relative'; // For absolute positioning if needed

    const keywordCount = query.keywords ? query.keywords.length : 0;
    const modelCount = query.models ? query.models.length : 0;

    // Format date
    const date = new Date(query.created_at || Date.now());
    const dateStr = date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

    card.innerHTML = `
        <div class="card-header" style="border-bottom:none; padding-bottom:0.5rem;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; width:100%;">
                <h3 style="font-size:1.1rem; margin:0;">
                    <a href="/query/${query.id}" style="text-decoration:none; color:inherit; cursor:pointer;" title="View Details">
                        ${escapeHtml(query.name)}
                    </a>
                </h3>
                 <div class="dropdown" style="position:relative;">
                    <button class="btn-icon" onclick="toggleMenu('${query.id}')" style="color:var(--text-secondary);">⋮</button>
                    <div id="menu-${query.id}" class="dropdown-menu" style="display:none; position:absolute; right:0; top:100%; background:white; border:1px solid var(--border-color); border-radius:0.5rem; box-shadow:var(--shadow); z-index:10; min-width:150px; overflow:hidden;">
                        <a href="/query/${query.id}/edit" class="dropdown-item" style="display:block; padding:0.75rem 1rem; color:var(--text-primary); text-decoration:none; font-size:0.875rem;">Edit</a>
                        <button onclick="trackNow('${query.id}')" class="dropdown-item" style="display:block; width:100%; text-align:left; padding:0.75rem 1rem; color:var(--text-primary); border:none; background:none; font-size:0.875rem; cursor:pointer;">Track Now</button>
                        <div style="border-top:1px solid var(--border-color);"></div>
                        <button onclick="deleteQuery('${query.id}')" class="dropdown-item" style="display:block; width:100%; text-align:left; padding:0.75rem 1rem; color:var(--danger-color); border:none; background:none; font-size:0.875rem; cursor:pointer;">Delete</button>
                    </div>
                </div>
            </div>
        </div>
        
        <div style="padding: 0 1.5rem 1.5rem 1.5rem;">
            <p style="color:var(--text-secondary); font-size:0.875rem; margin-bottom:1rem;">
                Created on ${dateStr}
            </p>
            
            <div style="display:flex; gap:1rem;">
                <span class="badge" style="background:#dbeafe; color:#1e40af; font-weight:500;">
                    ${keywordCount} Keywords
                </span>
                <span class="badge" style="background:#f3e8ff; color:#6b21a8; font-weight:500;">
                    ${modelCount} Models
                </span>
            </div>
            
            <div style="margin-top:1.5rem;">
                 <a href="/query/${query.id}/edit" class="btn btn-secondary full-width" style="justify-content:center;">
                    Configure
                </a>
            </div>
        </div>
    `;

    return card;
}

function toggleMenu(id) {
    // Close other menus first
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
        if (menu.id !== `menu-${id}`) {
            menu.style.display = 'none';
        }
    });

    const menu = document.getElementById(`menu-${id}`);
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';

    // Close when clicking outside
    const closeHandler = (e) => {
        if (!e.target.closest('.dropdown')) {
            menu.style.display = 'none';
            document.removeEventListener('click', closeHandler);
        }
    };
    setTimeout(() => {
        document.addEventListener('click', closeHandler);
    }, 0);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function deleteQuery(id) {
    if (!confirm('Are you sure you want to delete this query? This action cannot be undone.')) return;

    try {
        const response = await fetch(`${API_BASE}/api/queries/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            alert('Query deleted successfully');
            window.location.reload();
        } else {
            alert('Failed to delete query');
        }
    } catch (error) {
        console.error('Error deleting query:', error);
        alert('Error deleting query');
    }
}

async function trackNow(id) {
    if (!confirm('Start tracking for this query now?')) return;
    try {
        const response = await fetch(`${API_BASE}/api/queries/${id}/track`, {
            method: 'POST'
        });

        const data = await response.json();
        alert(data.message || 'Tracking started');
    } catch (error) {
        console.error('Error tracking:', error);
        alert('Error starting tracking');
    }
}

// Add simple style for dropdown hover
const style = document.createElement('style');
style.textContent = `
    .dropdown-item:hover { background-color: #f9fafb; }
`;
document.head.appendChild(style);
