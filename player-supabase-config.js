// player-supabase-config.js
// Configuración de Supabase (Jugadores)

// !!! IMPORTANTE: REEMPLAZA ESTOS VALORES CON LOS DE TU PROYECTO SUPABASE !!!
const SUPABASE_URL = 'https://keunztapjynaavjjdmlb.supabase.co'; // Tu URL de Supabase
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtldW56dGFwanluYWF2ampkbWxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NDQ2MTksImV4cCI6MjA2OTAyMDYxOX0.woiFMVYYtalXgYp6uTrflE4dg-1XCjS8bRfqMOf5eoY'; // Tu clave anon de Supabase

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Función de utilidad para mostrar alertas
function showAlert(message, type = 'info', duration = 3000) {
    let alertDiv = document.getElementById('app-alert');
    if (!alertDiv) {
        alertDiv = document.createElement('div');
        alertDiv.id = 'app-alert';
        document.body.appendChild(alertDiv);
    }

    alertDiv.textContent = message;
    alertDiv.className = `app-alert ${type}`; // Clase base y tipo (info, success, warning, error)
    alertDiv.style.display = 'block';

    // Forzar reflow para reiniciar la animación si se llama rápidamente
    alertDiv.offsetWidth;

    // Quitar la clase de animación para que se pueda aplicar de nuevo
    alertDiv.style.animation = 'none';
    setTimeout(() => {
        alertDiv.style.animation = `fadeInOut ${duration / 1000}s forwards`;
    }, 10);


    setTimeout(() => {
        alertDiv.style.display = 'none';
    }, duration); // Ocultar después de la duración especificada
}

// Función de utilidad para formatear el tiempo
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    const pad = (num) => num.toString().padStart(2, '0');

    if (hours > 0) {
        return `${pad(hours)}:${pad(minutes)}:${pad(remainingSeconds)}`;
    } else {
        return `${pad(minutes)}:${pad(remainingSeconds)}`;
    }
}