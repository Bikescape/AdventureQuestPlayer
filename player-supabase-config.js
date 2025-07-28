// supabase-config.js
// Configuración de Supabase
const SUPABASE_URL = 'https://keunztapjynaavjjdmlb.supabase.co'; // Reemplaza con tu URL de Supabase
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtldW56dGFwanluYWF2ampkbWxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NDQ2MTksImV4cCI6MjA2OTAyMDYxOX0.woiFMVYYtalXgYp6uTrflE4dg-1XCjS8bRfqMOf5eoY'; // Reemplaza con tu clave anon de Supabase

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Función de utilidad para mostrar alertas (puede ser compartida o duplicada si hay conflictos de módulos)
function showAlert(message, type = 'info') {
    let alertDiv = document.getElementById('app-alert');
    if (!alertDiv) {
        alertDiv = document.createElement('div');
        alertDiv.id = 'app-alert';
        document.body.appendChild(alertDiv);
    }

    alertDiv.classList.remove('info', 'success', 'warning', 'error', 'hidden');
    alertDiv.classList.add('app-alert', type);
    alertDiv.textContent = message;

    // Reiniciar la animación si ya estaba visible
    alertDiv.style.animation = 'none';
    alertDiv.offsetHeight; // Trigger reflow
    alertDiv.style.animation = null;
    alertDiv.style.animation = 'fadeOut 0.5s forwards 2.5s'; // Fade out after 2.5s delay

    // Ocultar después de 3 segundos (que es el tiempo total de la animación + delay)
    setTimeout(() => {
        alertDiv.classList.add('hidden');
    }, 3000);
}

// Función de utilidad para formatear el tiempo (HH:MM:SS)
function formatTime(seconds) {
    const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
}

// Función de utilidad para formatear la fecha
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString('es-ES', options);
}