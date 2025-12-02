// Configuración de la API
// Para desarrollo local, usar window.location.origin
// Para producción (GitHub Pages), usar la URL del backend desplegado

const API_CONFIG = {
    // Cambiar esta URL por la URL de tu backend desplegado (ej: https://tu-app.onrender.com)
    // Déjalo vacío para usar desarrollo local (window.location.origin)
    BASE_URL: '',
    
    // URLs completas de los endpoints (se construyen automáticamente si BASE_URL está vacío)
    get base() {
        if (this.BASE_URL) {
            return this.BASE_URL;
        }
        // En desarrollo, usar el mismo origen
        return window.location.origin;
    }
};


