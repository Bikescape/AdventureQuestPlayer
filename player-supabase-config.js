// player-supabase-config.js
// Configuración de Supabase para la parte de Jugadores

// Reemplaza con tus propias credenciales de Supabase
const SUPABASE_URL = 'https://keunztapjynaavjjdmlb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtldW56dGFwanluYWF2ampkbWxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NDQ2MTksImV4cCI6MjA2OTAyMDYxOX0.woiFMVYYtalXgYp6uTrflE4dg-1XCjS8bRfqMOf5eoY';

let supabase; // Declara la variable supabase globalmente.

// *** CORRECCIÓN CRÍTICA AQUÍ: Asegurarse de que window.supabase está disponible antes de usarlo ***
// Esta verificación es crucial porque si el script de Supabase CDN no se carga,
// window.supabase será undefined y causará el TypeError.
if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase client initialized successfully.');
} else {
    console.error("Error CRÍTICO: La librería de Supabase (window.supabase) no se ha cargado correctamente o la función createClient no está disponible.");
    // Muestra una alerta amigable al usuario, ya que la aplicación no funcionará sin Supabase
    alert("Error de inicialización: La aplicación no pudo conectar con la base de datos. Por favor, asegúrate de que estás conectado a internet y recarga la página. (Más detalles en la consola del navegador)");
    // Aquí no podemos usar showModal porque player-script.js aún no se ha cargado/ejecutado
}