// player/player-supabase-config.js
// Configuración de Supabase (Jugadores)

// Asegúrate de que estas credenciales coincidan con las del panel de admin
const SUPABASE_URL = 'https://keunztapjynaavjjdmlb.supabase.co'; // Reemplaza con tu URL de Supabase
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtldW56dGFwanluYWF2ampkbWxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NDQ2MTksImV4cCI6MjA2OTAyMDYxOX0.woiFMVYYtalXgYp6uTrflE4dg-1XCjS8bRfqMOf5eoY'; // Reemplaza con tu clave anon de Supabase

let supabase;
if (window.supabase && typeof window.supabase.createClient === 'function') {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
    console.error("Error: Supabase client library not loaded correctly.");
    alert("Error crítico: La aplicación no puede conectar con la base de datos.");
}

// Función de utilidad para mostrar alertas en la UI
function showAlert(message, type = 'success', duration = 3000) {
    const alertDiv = document.getElementById('app-alert');
    if (!alertDiv) return;

    alertDiv.textContent = message;
    alertDiv.className = type; // success o error
    alertDiv.classList.remove('hidden');

    setTimeout(() => {
        alertDiv.classList.add('hidden');
    }, duration);
}