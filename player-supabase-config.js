// player/supabase-config.js
// Configuración de Supabase (Jugador)
// *** REEMPLAZA CON TUS PROPIAS CREDENCIALES DE SUPABASE ***
const SUPABASE_URL = 'https://keunztapjynaavjjdmlb.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtldW56dGFwanluYWF2ampkbWxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NDQ2MTksImV4cCI6MjA2OTAyMDYxOX0.woiFMVYYtalXgYp6uTrflE4dg-1XCjS8bRfqMOf5eo'; 

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Función de utilidad para mostrar alertas (copia de shared/utils.js para evitar complejidad de módulos)
// Idealmente, se importaría desde shared/utils.js si se usan módulos ES6.
function showAlert(message, type = 'info') {
    let alertDiv = document.getElementById('app-alert');
    if (!alertDiv) {
        alertDiv = document.createElement('div');
        alertDiv.id = 'app-alert';
        document.body.appendChild(alertDiv);
    }

    alertDiv.textContent = message;
    alertDiv.className = `app-alert ${type}`; // Clase base y tipo (info, success, warning, error)
    alertDiv.style.display = 'block';

    setTimeout(() => {
        alertDiv.style.display = 'none';
    }, 3000); // Ocultar después de 3 segundos
}