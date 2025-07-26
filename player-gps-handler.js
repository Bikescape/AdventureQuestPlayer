// player/gps-handler.js

const GPS_CONFIG = {
    enableHighAccuracy: true,
    timeout: 10000, // 10 seconds
    maximumAge: 0, // No cached positions
    minAccuracy: 10 // Consider positions with at least 10m accuracy (default tolerance for tests)
};

let watchId = null;
let currentGeolocationPosition = null; // Stores raw geolocation position object

// Function to start continuously watching the user's position
function startPlayerGPSWatch(callback) {
    if (!navigator.geolocation) {
        showAlert('Tu dispositivo no soporta geolocalización.', 'error');
        return;
    }

    if (watchId !== null) {
        console.log('GPS watch already active.');
        return;
    }

    watchId = navigator.geolocation.watchPosition(
        (position) => {
            currentGeolocationPosition = position; // Store raw position
            callback(position.coords.latitude, position.coords.longitude, position.coords.accuracy);
        },
        (error) => {
            console.error('Error in GPS watch:', error);
            let errorMessage = 'Error al obtener ubicación GPS.';
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = 'Permiso de ubicación denegado.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = 'Información de ubicación no disponible.';
                    break;
                case error.TIMEOUT:
                    errorMessage = 'Tiempo de espera agotado al intentar obtener ubicación.';
                    break;
                case error.UNKNOWN_ERROR:
                    errorMessage = 'Error desconocido al obtener ubicación.';
                    break;
            }
            showAlert(errorMessage, 'error');
        },
        GPS_CONFIG
    );
    console.log('GPS watch started.');
}

// Function to stop watching the user's position
function stopPlayerGPSWatch() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
        currentGeolocationPosition = null;
        console.log('GPS watch stopped.');
    }
}

// Haversine formula to calculate distance between two lat/lon points
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180; // φ, λ in radians
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const d = R * c; // in metres
    return d;
}

// Check if current position is within a geofence
function checkGeofence(targetLat, targetLon, toleranceMeters) {
    if (!currentGeolocationPosition) {
        showAlert('No hay ubicación GPS disponible para comprobar.', 'warning');
        return { success: false, distance: Infinity, accuracy: null };
    }

    const currentLat = currentGeolocationPosition.coords.latitude;
    const currentLon = currentGeolocationPosition.coords.longitude;
    const currentAccuracy = currentGeolocationPosition.coords.accuracy;

    // Check if accuracy is within acceptable limits before checking distance
    if (currentAccuracy > GPS_CONFIG.minAccuracy) { // Using configured minimum accuracy for general use
        showAlert(`Precisión GPS insuficiente (${currentAccuracy.toFixed(1)}m). Mejora tu señal.`, 'warning');
        return { success: false, distance: Infinity, accuracy: currentAccuracy };
    }

    const distance = getDistance(currentLat, currentLon, targetLat, targetLon);
    console.log(`Distance to target: ${distance.toFixed(2)}m, Accuracy: ${currentAccuracy.toFixed(1)}m`);

    // The user's position + accuracy circle must overlap with the target location + tolerance radius.
    // So, actual distance + current accuracy should be <= tolerance.
    // Or, more strictly, if the user's reported position is within tolerance, it's correct.
    // We will use the stricter interpretation: user's reported position must be within tolerance.
    // The accuracy is a measure of how certain we are about the reported position.
    // If currentAccuracy is large, the reported position might be far from actual.

    const isWithin = distance <= toleranceMeters;

    if (isWithin) {
        showAlert(`¡Ubicación encontrada! Estás a ${distance.toFixed(1)} metros.`, 'success');
    } else {
        showAlert(`Aún no estás en el lugar correcto. Estás a ${distance.toFixed(1)} metros.`, 'info');
    }
    
    return { success: isWithin, distance: distance, accuracy: currentAccuracy };
}