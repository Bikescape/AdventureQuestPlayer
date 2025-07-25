// player/gps-handler.js

const GPS_CONFIG = {
    enableHighAccuracy: true,
    timeout: 15000, // 15 seconds to get a position
    maximumAge: 0, // No cached positions
    minAccuracy: 15 // Consider positions with at least 15m accuracy for validation
};

let watchId = null;
let currentGeolocationPosition = null; // Stores raw geolocation position object

/**
 * Starts continuously watching the user's position.
 * @param {function(number, number, number): void} callback - Callback function (lat, lon, accuracy) called on position update.
 */
function startPlayerGPSWatch(callback) {
    if (!navigator.geolocation) {
        showAlert('Tu dispositivo no soporta geolocalización.', 'error');
        return;
    }

    if (watchId !== null) {
        console.log("GPS watch already active. Stopping previous one.");
        navigator.geolocation.clearWatch(watchId);
    }

    watchId = navigator.geolocation.watchPosition(
        (position) => {
            currentGeolocationPosition = position; // Store raw position
            callback(position.coords.latitude, position.coords.longitude, position.coords.accuracy);
            console.log(`GPS Update: Lat ${position.coords.latitude}, Lon ${position.coords.longitude}, Acc ${position.coords.accuracy.toFixed(1)}m`);
        },
        (error) => {
            console.error('Error in GPS watch:', error);
            let errorMessage = 'Error al obtener ubicación GPS.';
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = 'Permiso de ubicación denegado. Por favor, habilita la ubicación en tu navegador.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = 'Información de ubicación no disponible. Inténtalo de nuevo.';
                    break;
                case error.TIMEOUT:
                    errorMessage = 'Tiempo de espera agotado al intentar obtener ubicación. Asegúrate de tener buena señal GPS.';
                    break;
                default:
                    errorMessage = 'Error desconocido al obtener ubicación GPS.';
            }
            showAlert(errorMessage, 'error');
        },
        GPS_CONFIG
    );
    showAlert('Rastreo GPS iniciado.', 'info');
}

// Stops the continuous GPS watch
function stopPlayerGPSWatch() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
        currentGeolocationPosition = null;
        console.log('Rastreo GPS detenido.');
        showAlert('Rastreo GPS detenido.', 'info');
    }
}

/**
 * Gets the current position once.
 * @returns {Promise<{latitude: number, longitude: number, accuracy: number}>}
 */
function getCurrentPlayerPosition() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported.'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                currentGeolocationPosition = position;
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                });
            },
            (error) => {
                console.error('Error getting current GPS position:', error);
                let errorMessage = 'Error al obtener ubicación GPS.';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Permiso de ubicación denegado.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Información de ubicación no disponible.';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'Tiempo de espera agotado.';
                        break;
                }
                showAlert(errorMessage, 'error');
                reject(error);
            },
            GPS_CONFIG
        );
    });
}

/**
 * Calculates the distance between two geographical points using Haversine formula.
 * @param {number} lat1 - Latitude of point 1.
 * @param {number} lon1 - Longitude of point 1.
 * @param {number} lat2 - Latitude of point 2.
 * @param {number} lon2 - Longitude of point 2.
 * @returns {number} Distance in meters.
 */
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

/**
 * Checks if the current position is within a given radius of a target.
 * @param {number} targetLat - Target latitude.
 * @param {number} targetLon - Target longitude.
 * @param {number} toleranceMeters - Allowed distance from target in meters.
 * @returns {{success: boolean, distance: number, accuracy: number|null}}
 */
function checkGeofence(targetLat, targetLon, toleranceMeters) {
    if (!currentGeolocationPosition) {
        showAlert('No hay ubicación GPS disponible para comprobar. Espera un momento o habilita tu GPS.', 'warning');
        return { success: false, distance: Infinity, accuracy: null };
    }

    const currentLat = currentGeolocationPosition.coords.latitude;
    const currentLon = currentGeolocationPosition.coords.longitude;
    const currentAccuracy = currentGeolocationPosition.coords.accuracy;

    // Check if the GPS accuracy is within an acceptable range first
    if (currentAccuracy > GPS_CONFIG.minAccuracy) {
        showAlert(`Precisión GPS insuficiente (${currentAccuracy.toFixed(1)}m). Necesitas estar más cerca de ${GPS_CONFIG.minAccuracy}m de precisión.`, 'warning');
        return { success: false, distance: Infinity, accuracy: currentAccuracy };
    }

    const distance = getDistance(currentLat, currentLon, targetLat, targetLon);
    console.log(`Distance to target: ${distance.toFixed(2)}m, Current Accuracy: ${currentAccuracy.toFixed(1)}m, Tolerance: ${toleranceMeters}m`);

    // Consider the accuracy in the success condition:
    // If the distance is within tolerance, AND the accuracy is good enough to confirm it.
    // Or, if the distance + accuracy (worst case scenario for actual position) is still within tolerance
    const isWithin = distance <= toleranceMeters; // Simple check

    if (isWithin) {
        showAlert(`¡Ubicación encontrada! Estás a ${distance.toFixed(1)}m del objetivo.`, 'success');
    } else {
        showAlert(`Estás a ${distance.toFixed(1)}m del objetivo. Acércate más.`, 'info');
    }

    return { success: isWithin, distance: distance, accuracy: currentAccuracy };
}

// Initial check for permissions (can be called on app start)
function requestGPSPermission() {
    if (navigator.permissions) {
        navigator.permissions.query({name: 'geolocation'}).then(function(result) {
            if (result.state === 'granted') {
                console.log('Permisos de geolocalización concedidos.');
            } else if (result.state === 'prompt') {
                console.log('Se solicitarán permisos de geolocalización al iniciar el rastreo.');
            } else if (result.state === 'denied') {
                showAlert('Los permisos de ubicación están denegados. Algunas funciones (pruebas GPS) no estarán disponibles.', 'error');
            }
        }).catch(function(error) {
            console.log('Error al verificar permisos de GPS:', error);
        });
    } else {
        console.warn('Navigator.permissions API no soportada.');
    }
}

// Ensure initial permission check on DOM ready
document.addEventListener('DOMContentLoaded', requestGPSPermission);

// Expose relevant functions globally or via a module pattern if preferred
window.startPlayerGPSWatch = startPlayerGPSWatch;
window.stopPlayerGPSWatch = stopPlayerGPSWatch;
window.getCurrentPlayerPosition = getCurrentPlayerPosition;
window.getDistance = getDistance;
window.checkGeofence = checkGeofence;