// player/leaflet-map.js

/**
 * Initializes the Leaflet map for the player.
 * @param {string} mapContainerId - The ID of the div element where the map will be rendered.
 * @param {number} initialLat - Initial center latitude.
 * @param {number} initialLon - Initial center longitude.
 */
function initPlayerMap(mapContainerId, initialLat = 40.416775, initialLon = -3.703790) { // Default to Madrid center
    if (gameState.playerMap) {
        gameState.playerMap.remove(); // Remove existing map instance to prevent duplicates
        gameState.playerMap = null;
    }

    // Set a default view if no coordinates are provided or if they are invalid
    const defaultView = [initialLat, initialLon];
    const defaultZoom = 16;

    gameState.playerMap = L.map(mapContainerId).setView(defaultView, defaultZoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
    }).addTo(gameState.playerMap);

    // Start watching GPS location to update player marker
    // This assumes startPlayerGPSWatch is defined in gps-handler.js and globally accessible
    startPlayerGPSWatch(updatePlayerMapLocation);

    console.log('Leaflet map initialized.');
}

/**
 * Updates the player's marker on the map.
 * @param {number} lat - Player's current latitude.
 * @param {number} lon - Player's current longitude.
 * @param {number} accuracy - Accuracy of the GPS reading in meters.
 */
function updatePlayerMapLocation(lat, lon, accuracy) {
    if (!gameState.playerMap) return;

    const latLng = [lat, lon];

    if (gameState.playerMapMarker) {
        gameState.playerMapMarker.setLatLng(latLng);
        // Update circle marker radius for accuracy if it's a circle
        if (gameState.playerMapMarker instanceof L.CircleMarker || gameState.playerMapMarker instanceof L.Circle) {
            gameState.playerMapMarker.setRadius(accuracy / 2); // Radius is half of diameter for visual clarity
        }
    } else {
        // Use a blue marker for the player
        const blueIcon = new L.Icon({
            iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        });

        gameState.playerMapMarker = L.marker(latLng, { icon: blueIcon })
            .addTo(gameState.playerMap)
            .bindPopup("Tu ubicación actual")
            .openPopup();

        // Add a circle to show accuracy
        L.circle(latLng, { radius: accuracy, color: 'blue', fillColor: '#0000ff', fillOpacity: 0.2 })
            .addTo(gameState.playerMap);
    }
    // Optionally recenter the map on the player, or adjust view to fit markers
    // gameState.playerMap.setView(latLng, gameState.playerMap.getZoom());

    // Fit map to include both markers if target marker exists
    if (gameState.targetMapMarker) {
        const group = new L.featureGroup([gameState.playerMapMarker, gameState.targetMapMarker]);
        gameState.playerMap.fitBounds(group.getBounds().pad(0.2)); // Add some padding
    } else {
        gameState.playerMap.setView(latLng, 16); // If no target, just center on player
    }

    // Update GPS distance display on UI
    const gpsDistanceDisplay = document.getElementById('gps-distance-display');
    if (gpsDistanceDisplay) {
        let distance = '--';
        if (gameState.currentTrial && gameState.currentTrial.type === 'gps' && gameState.currentTrial.gps_latitude && gameState.currentTrial.gps_longitude) {
            distance = getDistance(lat, lon, gameState.currentTrial.gps_latitude, gameState.currentTrial.gps_longitude).toFixed(1);
        }
        gpsDistanceDisplay.textContent = `Distancia: ${distance} m (Precisión: ${accuracy.toFixed(1)} m)`;
    }
}

/**
 * Updates or sets the target marker on the map.
 * @param {number} lat - Target latitude.
 * @param {number} lon - Target longitude.
 */
function updatePlayerMapTargetMarker(lat, lon) {
    if (!gameState.playerMap) {
        console.warn('Map not initialized, cannot set target marker.');
        return;
    }

    const targetLatLng = [lat, lon];

    if (gameState.targetMapMarker) {
        gameState.targetMapMarker.setLatLng(targetLatLng);
    } else {
        // Use a red marker for the target
        const redIcon = new L.Icon({
            iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        });

        gameState.targetMapMarker = L.marker(targetLatLng, { icon: redIcon })
            .addTo(gameState.playerMap)
            .bindPopup("Ubicación de la prueba");
    }

    // Adjust map view to include both markers if player marker exists
    if (gameState.playerMapMarker) {
        const group = new L.featureGroup([gameState.playerMapMarker, gameState.targetMapMarker]);
        gameState.playerMap.fitBounds(group.getBounds().pad(0.2));
    } else {
        // If only target, set view to target
        gameState.playerMap.setView(targetLatLng, 16);
    }
}

/**
 * Clears the target marker from the map.
 */
function clearPlayerMapTargetMarker() {
    if (gameState.targetMapMarker) {
        gameState.playerMap.removeLayer(gameState.targetMapMarker);
        gameState.targetMapMarker = null;
    }
}

/**
 * Destroys the map instance and stops GPS tracking associated with it.
 */
function destroyPlayerMap() {
    if (gameState.playerMap) {
        gameState.playerMap.remove();
        gameState.playerMap = null;
        gameState.playerMapMarker = null;
        gameState.targetMapMarker = null;
    }
    stopPlayerGPSWatch(); // Stop GPS tracking when map is destroyed
    console.log('Leaflet map destroyed and GPS tracking stopped.');
}

// Expose functions globally
window.initPlayerMap = initPlayerMap;
window.updatePlayerMapLocation = updatePlayerMapLocation;
window.updatePlayerMapTargetMarker = updatePlayerMapTargetMarker;
window.clearPlayerMapTargetMarker = clearPlayerMapTargetMarker;
window.destroyPlayerMap = destroyPlayerMap;