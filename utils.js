// shared/utils.js

// Función para formatear tiempo (minutos:segundos)
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const pad = (num) => num < 10 ? '0' + num : num;
    return `${pad(minutes)}:${pad(remainingSeconds)}`;
}

// La función showAlert se ha duplicado en los archivos supabase-config.js de admin y player
// para evitar problemas de modularidad y rutas relativas en este ejemplo.
// En un proyecto real con módulos ES6, se importaría desde aquí.