// player/player-script.js

// Estado global del juego
let gameState = {};

// Elementos del DOM (Pantallas)
const screens = {
    loading: document.getElementById('loading-screen'),
    welcome: document.getElementById('welcome-screen'),
    gameDetail: document.getElementById('game-detail-screen'),
    gamePlay: document.getElementById('game-play-screen'),
    gameOver: document.getElementById('game-over-screen'),
};

// Elementos del DOM (Vistas dentro de GamePlay)
const gameViews = {
    narrative: document.getElementById('narrative-view'),
    locationNav: document.getElementById('location-navigation-view'),
    list: document.getElementById('list-view'),
    trial: document.getElementById('trial-view'),
};

// Elementos del DOM (Contenido dinámico)
const UIElements = {
    gameHeader: document.getElementById('game-header'),
    teamNameDisplay: document.getElementById('team-name-display'),
    scoreDisplay: document.getElementById('score-display'),
    totalTimerDisplay: document.getElementById('total-timer-display'),
    gameListContainer: document.getElementById('game-list-container'),
    gameDetailTitle: document.getElementById('game-detail-title'),
    gameDetailMechanics: document.getElementById('game-detail-mechanics'),
    teamNameInput: document.getElementById('team-name-input'),
    narrativeImage: document.getElementById('narrative-image'),
    narrativeAudio: document.getElementById('narrative-audio'),
    narrativeText: document.getElementById('narrative-text'),
    navLocationName: document.getElementById('nav-location-name'),
    navPreArrivalNarrative: document.getElementById('nav-pre-arrival-narrative'),
    navLocationImage: document.getElementById('nav-location-image'),
    navLocationAudio: document.getElementById('nav-location-audio'),
    distanceInfo: document.getElementById('distance-info'),
    listTitle: document.getElementById('list-title'),
    listItemsContainer: document.getElementById('list-items-container'),
    trialImage: document.getElementById('trial-image'),
    trialAudio: document.getElementById('trial-audio'),
    trialNarrative: document.getElementById('trial-narrative'),
    trialTimerDisplay: document.getElementById('trial-timer-display'),
    trialContent: document.getElementById('trial-content'),
    hintBtn: document.getElementById('hint-btn'),
    hintCostDisplay: document.getElementById('hint-cost-display'),
    finalTeamName: document.getElementById('final-team-name'),
    finalScore: document.getElementById('final-score'),
    finalTime: document.getElementById('final-time'),
    finalRankingContainer: document.getElementById('final-ranking-container'),
    qrScannerModal: document.getElementById('qr-scanner-modal'),
    hintModal: document.getElementById('hint-modal'),
    hintText: document.getElementById('hint-text'),
    backToListFromNavBtn: document.getElementById('back-to-list-from-nav-btn'),
    backToListFromTrialBtn: document.getElementById('back-to-list-from-trial-btn'),
};

// Botones
const buttons = {
    startGame: document.getElementById('start-game-btn'),
    backToWelcome: document.getElementById('back-to-welcome-btn'),
    narrativeContinue: document.getElementById('narrative-continue-btn'),
    validateAnswer: document.getElementById('validate-answer-btn'),
    closeQrScanner: document.getElementById('close-qr-scanner-btn'),
    closeHint: document.getElementById('close-hint-btn'),
    playAgain: document.getElementById('play-again-btn'),
};

// Variables de estado de la lógica del juego
let selectedGame = null;
let html5QrCode = null;
let map, playerMarker, targetMarker, targetCircle;
let totalTimerInterval, trialTimerInterval;
let lastTrialStartTime;
let watchPositionId;


// =================================================================
// INICIALIZACIÓN Y FLUJO PRINCIPAL
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js')
            .then(reg => console.log('Service Worker registered', reg))
            .catch(err => console.error('Service Worker registration failed', err));
    }

    const savedState = localStorage.getItem('treasureHuntGameState');
    if (savedState) {
        try {
            gameState = JSON.parse(savedState);
            if (gameState.teamId && !gameState.isCompleted) {
                resumeGame();
                return;
            }
        } catch (error) {
            console.error("Error parsing saved state:", error);
            localStorage.removeItem('treasureHuntGameState');
        }
    }

    // Asegurarse de que los modales estén ocultos al cargar usando style.display
    if (UIElements.qrScannerModal) {
        UIElements.qrScannerModal.style.display = 'none';
        console.log("DEBUG: QR Scanner Modal hidden on load. Display:", UIElements.qrScannerModal.style.display);
    } else {
        console.warn("ADVERTENCIA: Elemento #qr-scanner-modal no encontrado en el DOM.");
    }

    if (UIElements.hintModal) {
        UIElements.hintModal.style.display = 'none';
        console.log("DEBUG: Hint Modal hidden on load. Display:", UIElements.hintModal.style.display);
    } else {
        console.warn("ADVERTENCIA: Elemento #hint-modal no encontrado en el DOM.");
    }

    // Los botones de cierre dentro de los modales también se ocultarán con el modal.
    // Si estuvieran fuera, se les podría añadir la clase 'hidden' aquí.
    if (buttons.closeQrScanner) {
        // Si el botón está dentro del modal, su visibilidad la controla el modal padre.
        // Si estuviera fuera y se quisiera ocultar por defecto: buttons.closeQrScanner.classList.add('hidden');
        console.log("DEBUG: Botón de cerrar escáner encontrado.");
    }
    if (buttons.closeHint) {
        // Si el botón está dentro del modal, su visibilidad la controla el modal padre.
        // Si estuviera fuera y se quisiera ocultar por defecto: buttons.closeHint.classList.add('hidden');
        console.log("DEBUG: Botón de cerrar pista encontrado.");
    }


    initWelcomeScreen();
    attachEventListeners();
});

/**
 * Muestra la pantalla de bienvenida y carga los juegos activos.
 */
async function initWelcomeScreen() {
    showScreen('loading');
    UIElements.gameHeader.classList.add('hidden');

    try {
        const { data, error } = await supabase
            .from('games')
            .select('id, title, description, mechanics, initial_narrative, adventure_type, initial_score_per_trial, image_url, audio_url')
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) throw error;

        UIElements.gameListContainer.innerHTML = '';
        if (data.length === 0) {
            UIElements.gameListContainer.innerHTML = '<p>No hay aventuras activas en este momento. ¡Vuelve pronto!</p>';
        } else {
            data.forEach(game => {
                const card = document.createElement('div');
                card.className = 'game-card';
                card.innerHTML = `
                    ${game.image_url ? `<img src="${game.image_url}" alt="Miniatura del juego" class="game-thumbnail">` : ''}
                    <h2>${game.title}</h2>
                    <p>${game.description}</p>
                `;
                card.onclick = () => showGameDetails(game);
                UIElements.gameListContainer.appendChild(card);
            });
        }
        showScreen('welcome');
    } catch (error) {
        console.error("Error fetching active games:", error);
        UIElements.gameListContainer.innerHTML = '<p>No se pudieron cargar las aventuras. Revisa tu conexión a internet.</p>';
        showAlert('Error al cargar juegos', 'error');
        showScreen('welcome');
    }
}

/**
 * Adjunta todos los event listeners de la aplicación.
 */
function attachEventListeners() {
    buttons.backToWelcome.addEventListener('click', initWelcomeScreen);
    buttons.startGame.addEventListener('click', startGame);
    UIElements.hintBtn.addEventListener('click', requestHint);

    // Modificado para usar style.display directamente para cerrar la pista
    buttons.closeHint.addEventListener('click', () => {
        console.log("DEBUG: Botón 'Entendido' de la pista clickeado.");
        if (UIElements.hintModal) {
            UIElements.hintModal.style.display = 'none'; // Ocultar directamente
            console.log("DEBUG: Modal de pista ocultado directamente. Display actual:", UIElements.hintModal.style.display);
        }
    });

    buttons.validateAnswer.addEventListener('click', validateCurrentAnswer);

    // stopQrScanner ya maneja el style.display
    buttons.closeQrScanner.addEventListener('click', stopQrScanner);

    buttons.playAgain.addEventListener('click', () => {
        localStorage.removeItem('treasureHuntGameState');
        location.reload();
    });
    UIElements.backToListFromNavBtn.addEventListener('click', () => {
        stopLocationTracking();
        advanceToNextLocation();
    });
    UIElements.backToListFromTrialBtn.addEventListener('click', () => {
        stopTrialTimer();
        startLocationTrials();
    });
}

/**
 * Guarda el estado actual del juego en localStorage.
 */
function saveState() {
    try {
        localStorage.setItem('treasureHuntGameState', JSON.stringify(gameState));
    } catch (error) {
        console.error("Failed to save game state:", error);
    }
}

/**
 * Controla qué pantalla principal es visible.
 * @param {string} screenName - Nombre de la pantalla a mostrar.
 */
function showScreen(screenName) {
    Object.keys(screens).forEach(key => {
        screens[key].classList.add('hidden');
    });
    if (screens[screenName]) {
        screens[screenName].classList.remove('hidden');
    }
}

/**
 * Controla qué vista es visible dentro de la pantalla de juego.
 * @param {string} viewName - Nombre de la vista a mostrar.
 */
function showGameView(viewName) {
    console.log(`Mostrando vista de juego: ${viewName}`);

    // Detener audios de otras vistas para evitar solapamientos.
    // Se ha movido la lógica de reproducción de audio a las funciones específicas de vista
    // para evitar conflictos de play/pause.
    if (UIElements.navLocationAudio && !UIElements.navLocationAudio.paused) {
        UIElements.navLocationAudio.pause();
        UIElements.navLocationAudio.currentTime = 0;
    }
    if (UIElements.narrativeAudio && !UIElements.narrativeAudio.paused) {
        UIElements.narrativeAudio.pause();
        UIElements.narrativeAudio.currentTime = 0;
    }
    if (UIElements.trialAudio && !UIElements.trialAudio.paused) {
        UIElements.trialAudio.pause();
        UIElements.trialAudio.currentTime = 0;
    }

    Object.keys(gameViews).forEach(key => {
        if (gameViews[key]) {
            gameViews[key].classList.add('hidden');
            console.log(`DEBUG: Ocultando vista: ${key}`); // DEBUG
        }
    });
    if (gameViews[viewName]) {
        gameViews[viewName].classList.remove('hidden');
        console.log(`DEBUG: Mostrando vista: ${viewName}`); // DEBUG
    } else {
        console.error(`ERROR: Elemento para la vista '${viewName}' no encontrado en gameViews.`); // DEBUG
    }
}


// =================================================================
// LÓGICA DE INICIO Y REANUDACIÓN DEL JUEGO
// =================================================================

/**
 * Muestra los detalles de un juego seleccionado y prepara el inicio.
 * @param {object} game - El objeto del juego seleccionado.
 */
function showGameDetails(game) {
    selectedGame = game;
    UIElements.gameDetailTitle.textContent = game.title;
    UIElements.gameDetailMechanics.innerHTML = game.mechanics;
    UIElements.teamNameInput.value = '';
    showScreen('gameDetail');
}

/**
 * Inicia una nueva partida.
 */
async function startGame() {
    const teamName = UIElements.teamNameInput.value.trim();
    if (!teamName) {
        showAlert('¡Tu equipo necesita un nombre!', 'error');
        return;
    }

    showScreen('loading');

    try {
        const startTime = new Date();
        const { data: teamData, error: teamError } = await supabase
            .from('teams')
            .insert({
                name: teamName,
                game_id: selectedGame.id,
                start_time: startTime,
                last_activity: startTime,
                total_score: 0,
                progress_log: [],
                hints_used_per_trial: [],
                hints_used_global: 0,
                is_completed: false
            })
            .select()
            .single();

        if (teamError) throw teamError;

        const { data: gameStructure, error: gameError } = await supabase
            .from('games')
            .select(`*, locations (*, trials (*))`)
            .eq('id', selectedGame.id)
            .single();

        if (gameError) throw gameError;

        gameStructure.locations.sort((a, b) => a.order_index - b.order_index);
        gameStructure.locations.forEach(loc => loc.trials.sort((a, b) => a.order_index - b.order_index));

        gameState = {
            teamId: teamData.id,
            teamName: teamData.name,
            gameId: selectedGame.id,
            gameData: gameStructure,
            currentLocationIndex: -1,
            currentTrialIndex: -1,
            totalScore: 0,
            startTime: startTime.toISOString(),
            progressLog: [],
            globalHintsUsed: 0,
            isCompleted: false,
        };

        saveState();
        await syncStateWithSupabase();
        resumeGame();

    } catch (error) {
        console.error("Error starting game:", error.message || error);
        showAlert(`Error al iniciar la partida: ${error.message}`, 'error');
        showScreen('gameDetail');
    }
}

/**
 * Reanuda una partida existente a partir del gameState.
 */
function resumeGame() {
    console.log("Resuming game with state:", gameState);
    showScreen('gamePlay');
    UIElements.gameHeader.classList.remove('hidden');
    UIElements.teamNameDisplay.textContent = gameState.teamName;
    UIElements.scoreDisplay.textContent = gameState.totalScore;
    updateTotalTimeDisplay();
    renderCurrentState();
}

/**
 * Sincroniza el estado local (gameState) con la base de datos.
 */
async function syncStateWithSupabase() {
    if (!gameState.teamId) return;

    const totalTimeTrials = gameState.progressLog.reduce((sum, entry) => sum + entry.timeTaken, 0);

    const updates = {
        current_location_id: gameState.gameData.locations[gameState.currentLocationIndex]?.id || null,
        current_trial_id: gameState.gameData.locations[gameState.currentLocationIndex]?.trials[gameState.currentTrialIndex]?.id || null,
        total_score: gameState.totalScore,
        progress_log: gameState.progressLog,
        hints_used_per_trial: gameState.hints_used_per_trial || [],
        hints_used_global: gameState.globalHintsUsed,
        total_time_seconds: totalTimeTrials,
        is_completed: gameState.isCompleted,
        last_activity: new Date().toISOString()
    };

    const { error } = await supabase
        .from('teams')
        .update(updates)
        .eq('id', gameState.teamId);

    if (error) {
        console.error("Error syncing state with Supabase:", error);
        showAlert('Error de sincronización', 'error');
    } else {
        console.log("State synced with Supabase:", updates);
        updateTotalTimeDisplay();
    }
}


// =================================================================
// RENDERIZADO DE ESTADOS DEL JUEGO
// =================================================================

/**
 * Punto de entrada principal para decidir qué mostrar en la pantalla.
 */
function renderCurrentState() {
    saveState();
    const game = gameState.gameData;
    const locIndex = gameState.currentLocationIndex;

    if (gameState.isCompleted) {
        endGame();
        return;
    }

    // Si aún no hemos seleccionado una ubicación (inicio del juego)
    if (locIndex === -1) {
        showNarrativeView(game.initial_narrative, game.image_url, game.audio_url, advanceToNextLocation);
        return;
    }

    const location = game.locations[locIndex];
    const trialIndex = gameState.currentTrialIndex;

    // Si aún no hemos seleccionado una prueba para la ubicación actual (narrativa de ubicación)
    if (trialIndex === -1) {
        showNarrativeView(location.initial_narrative, location.image_url, location.audio_url, startLocationTrials);
        return;
    }

    // Si ya estamos en una ubicación y tenemos un índice de prueba
    const trial = location.trials[trialIndex];
    if (isTrialCompleted(trial.id)) {
        // Si la prueba actual ya está completada, avanzamos el estado
        if (location.is_selectable_trials) {
            // Si es seleccionable, volvemos a la lista para que el usuario elija otra
            startLocationTrials();
        } else {
            // Si es lineal, avanzamos a la siguiente prueba y luego renderizamos el nuevo estado
            gameState.currentTrialIndex++; // Avanzamos el índice a la siguiente prueba
            renderCurrentState(); // Volvemos a llamar a renderCurrentState para que muestre la nueva prueba
        }
        return;
    }

    // Si la prueba actual no está completada, la renderizamos
    renderTrial(trial);
}


/**
 * Avanza a la siguiente ubicación.
 */
function advanceToNextLocation() {
    stopLocationTracking();
    const game = gameState.gameData;

    if (game.adventure_type === 'linear') {
        gameState.currentLocationIndex++;
        gameState.currentTrialIndex = -1; // Reinicia el índice de prueba para la nueva ubicación

        if (gameState.currentLocationIndex >= game.locations.length) {
            gameState.isCompleted = true;
            renderCurrentState();
            return;
        }
        const location = game.locations[gameState.currentLocationIndex];
        showLocationNavigationView(location);
    } else {
        const uncompletedLocations = game.locations.filter(loc => !isLocationCompleted(loc.id));

        if (uncompletedLocations.length > 0) {
            showListView('ubicaciones', uncompletedLocations, (selectedLoc) => {
                gameState.currentLocationIndex = game.locations.findIndex(l => l.id === selectedLoc.id);
                gameState.currentTrialIndex = -1; // Reinicia el índice de prueba para la nueva ubicación
                showLocationNavigationView(selectedLoc);
            });
        } else {
            gameState.isCompleted = true;
            renderCurrentState();
        }
    }
}

/**
 * Inicia las pruebas de la ubicación actual.
 */
function startLocationTrials() {
    stopLocationTracking();
    const location = getCurrentLocation();

    if (location.is_selectable_trials) {
        // Para pruebas seleccionables, mostramos la lista.
        showListView('pruebas', location.trials, (trial) => {
            const trialIndex = location.trials.findIndex(t => t.id === trial.id);
            if (trialIndex === -1) {
                showAlert("Error al procesar la prueba.", 'error');
                return;
            }
            gameState.currentTrialIndex = trialIndex;
            saveState();
            renderCurrentState(); // Llama a renderCurrentState para que muestre la prueba seleccionada
        });
    } else {
        // Para pruebas lineales, aseguramos que el índice de la prueba sea 0
        // si venimos de la narrativa de la ubicación, y luego renderizamos.
        if (gameState.currentTrialIndex === -1) {
            gameState.currentTrialIndex = 0;
        }
        renderCurrentState(); // Llama a renderCurrentState para que muestre la primera prueba lineal
    }
}

/**
 * Avanza a la siguiente prueba en la ubicación actual (solo para juegos/pruebas lineales).
 */
function advanceToNextTrial() {
    const location = getCurrentLocation();
    gameState.currentTrialIndex++; // Incrementa el índice para ir a la siguiente prueba

    if (gameState.currentTrialIndex >= location.trials.length) {
        // Si no hay más pruebas en esta ubicación, avanza a la siguiente ubicación
        advanceToNextLocation();
    } else {
        // Si hay más pruebas, renderiza el estado actual (mostrará la nueva prueba)
        renderCurrentState();
    }
}


// =================================================================
// VISTAS ESPECÍFICAS
// =================================================================

/**
 * Muestra una pantalla de narrativa.
 * Esta función ahora se usa solo para la narrativa inicial del juego y de las ubicaciones.
 */
function showNarrativeView(text, imageUrl, audioUrl, onContinue) {
    UIElements.narrativeText.innerHTML = text.replace(/\n/g, '<br>') || "Un momento de calma antes de la siguiente prueba...";
    if (UIElements.narrativeImage) { // Añadir comprobación
        UIElements.narrativeImage.classList.toggle('hidden', !imageUrl);
        UIElements.narrativeImage.src = imageUrl || '';
    }
    if (UIElements.narrativeAudio) { // Añadir comprobación
        UIElements.narrativeAudio.src = audioUrl || '';
        // Reproducir audio con un pequeño retraso para evitar AbortError
        if (audioUrl) setTimeout(() => {
            UIElements.narrativeAudio.play().catch(e => console.log("Audio play prevented by browser:", e));
        }, 100); // Pequeño retraso
    }


    // Clonar el botón para eliminar listeners anteriores y adjuntar el nuevo.
    const newContinueBtn = buttons.narrativeContinue.cloneNode(true);
    buttons.narrativeContinue.parentNode.replaceChild(newContinueBtn, buttons.narrativeContinue);
    buttons.narrativeContinue = newContinueBtn;
    buttons.narrativeContinue.addEventListener('click', onContinue);

    showGameView('narrative');
}

/**
 * Muestra el mapa y la información para navegar a una ubicación.
 */
function showLocationNavigationView(location) {
    UIElements.navLocationName.textContent = `Próximo Destino: ${location.name}`;
    UIElements.navPreArrivalNarrative.innerHTML = location.pre_arrival_narrative;
    if (UIElements.navLocationImage) { // Añadir comprobación
        UIElements.navLocationImage.classList.toggle('hidden', !location.image_url);
        UIElements.navLocationImage.src = location.image_url || '';
    }
    if (UIElements.navLocationAudio) { // Añadir comprobación
        UIElements.navLocationAudio.src = location.audio_url || '';
        if (location.audio_url) {
            UIElements.navLocationAudio.loop = true;
            // Reproducir audio con un pequeño retraso para evitar AbortError
            setTimeout(() => {
                UIElements.navLocationAudio.play().catch(e => console.log("Location audio play prevented by browser:", e));
            }, 100); // Pequeño retraso
        } else {
            UIElements.navLocationAudio.pause();
            UIElements.navLocationAudio.currentTime = 0;
        }
    }


    showGameView('locationNav');
    initMap('location-map');

    const targetCoords = [location.latitude, location.longitude];
    targetMarker = L.marker(targetCoords).addTo(map)
        .bindPopup(location.name)
        .openPopup();
    targetCircle = L.circle(targetCoords, {
        radius: location.tolerance_meters,
        color: 'orange',
        fillColor: '#ffc107',
        fillOpacity: 0.3
    }).addTo(map);

    startLocationTracking(location);

    if (gameState.gameData.adventure_type === 'selectable') {
        if (UIElements.backToListFromNavBtn) { // Añadir comprobación
            UIElements.backToListFromNavBtn.classList.remove('hidden');
        }
    } else {
        if (UIElements.backToListFromNavBtn) { // Añadir comprobación
            UIElements.backToListFromNavBtn.classList.add('hidden');
        }
    }
}

/**
 * Muestra una lista de elementos seleccionables (ubicaciones o pruebas).
 */
function showListView(type, items, onSelect) {
    UIElements.listTitle.textContent = type === 'ubicaciones' ? 'Elige tu próximo destino' : 'Elige tu próxima prueba';
    UIElements.listItemsContainer.innerHTML = '';

    const sortedItems = [...items].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

    sortedItems.forEach((item, index) => {
        if (type === 'pruebas' && isTrialCompleted(item.id)) return;
        if (type === 'ubicaciones' && isLocationCompleted(item.id)) return;

        const itemButton = document.createElement('button');
        itemButton.className = 'list-item-button action-button';
        itemButton.textContent = item.name || `Prueba ${item.order_index || index + 1}`;
        itemButton.onclick = () => onSelect(item);
        UIElements.listItemsContainer.appendChild(itemButton);
    });

    showGameView('list');
    // Asegurarse de que los botones de "volver al listado" estén ocultos en la vista de lista
    if (UIElements.backToListFromNavBtn) {
        UIElements.backToListFromNavBtn.classList.add('hidden');
    }
    if (UIElements.backToListFromTrialBtn) {
        UIElements.backToListFromTrialBtn.classList.add('hidden');
    }
}

/**
 * Renderiza la vista de una prueba específica.
 */
function renderTrial(trial) {
    console.log("Rendering trial:", trial.id, trial.name); // DEBUG: Más específico
    UIElements.trialNarrative.innerHTML = trial.narrative.replace(/\n/g, '<br>'); // La narrativa se muestra aquí

    // DEBUG: Log the value of UIElements.trialImage before attempting to use it
    console.log("DEBUG: UIElements.trialImage before use (line 667 context):", UIElements.trialImage);

    // CORRECCIÓN: Comprobar si UIElements.trialImage existe antes de acceder a classList
    if (UIElements.trialImage) {
        UIElements.trialImage.classList.toggle('hidden', !trial.image_url);
        UIElements.trialImage.src = trial.image_url || '';
    } else {
        console.error("ERROR: El elemento UIElements.trialImage no fue encontrado en el DOM al renderizar la prueba. Asegúrate de que existe un <img id='trial-image'> en tu HTML y que su ID es correcto.");
    }

    if (UIElements.trialAudio) { // Añadir comprobación
        UIElements.trialAudio.src = trial.audio_url || '';
        if (trial.audio_url) setTimeout(() => { // Pequeño retraso para audio de prueba
            UIElements.trialAudio.play().catch(e => console.log("Audio play prevented."));
        }, 100);
    } else {
        console.warn("ADVERTENCIA: Elemento UIElements.trialAudio no encontrado en el DOM.");
    }


    UIElements.hintCostDisplay.textContent = trial.hint_cost;
    const hintsUsed = getHintsUsedForTrial(trial.id);
    UIElements.hintBtn.disabled = hintsUsed >= trial.hint_count;

    renderTrialContent(trial); // Esto renderiza la pregunta
    startTrialTimer();
    showGameView('trial');
    console.log("DEBUG: Después de showGameView('trial'), #trial-view tiene la clase 'hidden':", UIElements.trial.classList.contains('hidden')); // DEBUG

    const currentLocation = getCurrentLocation();
    if (currentLocation && currentLocation.is_selectable_trials) {
        if (UIElements.backToListFromTrialBtn) { // Añadir comprobación
            UIElements.backToListFromTrialBtn.classList.remove('hidden');
        }
    } else {
        if (UIElements.backToListFromTrialBtn) { // Añadir comprobación
            UIElements.backToListFromTrialBtn.classList.add('hidden');
        }
    }
    setupImageZoomListener(); // NUEVO: Configura el listener de zoom para la imagen de la prueba
}

/**
 * Renderiza el contenido específico del tipo de prueba (QR, GPS, Texto).
 */
function renderTrialContent(trial) {
    UIElements.trialContent.innerHTML = '';
    // CORRECCIÓN: Usar buttons.validateAnswer en lugar de UIElements.validateAnswer
    if (buttons.validateAnswer) { // Añadir comprobación por si el botón no existe
        buttons.validateAnswer.classList.remove('hidden');
    } else {
        console.error("ERROR: El botón de validación (validateAnswer) no fue encontrado.");
    }


    switch (trial.trial_type) {
        case 'qr':
            const qrButton = document.createElement('button');
            qrButton.textContent = '🔍 Escanear Código QR';
            qrButton.className = 'action-button';
            qrButton.onclick = startQrScanner;
            UIElements.trialContent.appendChild(qrButton);
            // CORRECCIÓN: Usar buttons.validateAnswer en lugar de UIElements.validateAnswer
            if (buttons.validateAnswer) {
                buttons.validateAnswer.classList.add('hidden');
            }
            break;

        case 'gps':
            UIElements.trialContent.innerHTML = `<p>Dirígete a las coordenadas indicadas. La prueba se validará automáticamente cuando estés en la zona.</p><div id="trial-gps-map" class="map-container"></div>`;
            initMap('trial-gps-map');
            const targetCoords = [trial.latitude, trial.longitude];
            targetMarker = L.marker(targetCoords).addTo(map).bindPopup("Punto de la prueba");
            targetCircle = L.circle(targetCoords, { radius: trial.tolerance_meters }).addTo(map);
            startLocationTracking(trial, true);
            // CORRECCIÓN: Usar buttons.validateAnswer en lugar de UIElements.validateAnswer
            if (buttons.validateAnswer) {
                buttons.validateAnswer.classList.add('hidden');
            }
            break;

        case 'text':
            renderTextTrial(trial);
            break;
    }
}

/**
 * Renderiza los campos para una prueba de tipo Texto.
 */
function renderTextTrial(trial) {
    const question = document.createElement('p');
    question.innerHTML = trial.question;
    question.className = 'trial-question';
    UIElements.trialContent.appendChild(question);

    switch (trial.answer_type) {
        case 'single_choice':
        case 'numeric':
            const textInput = document.createElement('input');
            textInput.type = trial.answer_type === 'numeric' ? 'number' : 'text';
            textInput.id = 'text-answer-input';
            textInput.placeholder = 'Escribe tu respuesta aquí';
            UIElements.trialContent.appendChild(textInput);
            break;

        case 'multiple_options':
            const optionsContainer = document.createElement('div');
            optionsContainer.className = 'text-options-container';
            trial.options.forEach(option => {
                const optionDiv = document.createElement('div');
                optionDiv.className = 'text-option';
                optionDiv.innerHTML = option;
                optionDiv.dataset.value = option;
                optionDiv.onclick = () => {
                    document.querySelectorAll('.text-option').forEach(el => el.classList.remove('selected'));
                    optionDiv.classList.add('selected');
                };
                optionsContainer.appendChild(optionDiv);
            });
            UIElements.trialContent.appendChild(optionsContainer);
            break;

        case 'ordering':
            showAlert('Prueba de ordenación pendiente de implementación.');
            break;
    }
}


// =================================================================
// LÓGICA DE VALIDACIÓN Y GAMIFICACIÓN
// =================================================================

/**
 * Valida la respuesta para la prueba actual.
 */
function validateCurrentAnswer() {
    const trial = getCurrentTrial();
    if (!trial) return;

    let userAnswer = '';
    let isCorrect = false;

    if (trial.trial_type === 'text') {
        switch (trial.answer_type) {
            case 'single_choice':
            case 'numeric':
                userAnswer = document.getElementById('text-answer-input').value.trim();
                isCorrect = userAnswer.toLowerCase() === trial.correct_answer.toLowerCase();
                break;
            case 'multiple_options':
                const selectedOption = document.querySelector('.text-option.selected');
                userAnswer = selectedOption ? selectedOption.dataset.value : '';
                isCorrect = userAnswer === trial.correct_answer;
                break;
            default:
                showAlert('Tipo de respuesta no soportado aún.', 'error');
                return;
        }
    }
    if (trial.trial_type === 'qr' || trial.trial_type === 'gps') {
        showAlert('Esta prueba se valida automáticamente.', 'info');
        return;
    }

    processAnswer(isCorrect);
}

/**
 * Procesa el resultado de una validación.
 */
function processAnswer(isCorrect) {
    const trial = getCurrentTrial();
    if (!trial) return;

    if (isCorrect) {
        // ✅ El cronómetro solo se detiene al responder correctamente.
        stopTrialTimer();

        const timeTaken = Math.floor((new Date() - new Date(lastTrialStartTime)) / 1000);
        const hintsUsed = getHintsUsedForTrial(trial.id);
        const baseScore = gameState.gameData.initial_score_per_trial;
        const timePenalty = timeTaken;
        const hintPenalty = hintsUsed * trial.hint_cost;
        const trialScore = Math.max(0, baseScore - timePenalty - hintPenalty);

        gameState.totalScore += trialScore;
        UIElements.scoreDisplay.textContent = gameState.totalScore;

        gameState.progressLog.push({
            trialId: trial.id,
            completedAt: new Date().toISOString(),
            timeTaken: timeTaken,
            score: trialScore,
            hintsUsed: hintsUsed
        });

        showAlert('¡Correcto!', 'success', UIElements.trialContent); // Pasa trialContent como padre
        syncStateWithSupabase();

        // Check if all trials in the current location are completed
        const currentLocation = getCurrentLocation();
        if (isLocationCompleted(currentLocation.id)) {
            setTimeout(() => {
                advanceToNextLocation(); // Move to next location if current one is complete
            }, 1500);
        } else {
            // If location not complete, decide based on trial type
            setTimeout(() => {
                if (currentLocation.is_selectable_trials) {
                    startLocationTrials(); // Go back to list of trials
                } else {
                    advanceToNextTrial(); // Go to next linear trial
                }
            }, 1500);
        }

    } else {
        showAlert('Respuesta incorrecta. ¡Inténtalo de nuevo!', 'error', UIElements.trialContent); // Pasa trialContent como padre
        // 🚨 CORRECCIÓN: No se realiza ninguna acción que detenga o reinicie el cronómetro.
        // El cronómetro continúa ejecutándose aquí.
    }
}


/**
 * Solicita una pista para la prueba actual.
 */
function requestHint() {
    console.log("DEBUG: Función requestHint() llamada.");
    const trial = getCurrentTrial();
    if (!trial) return;

    let hintsUsedData = gameState.hints_used_per_trial?.find(p => p.trialId === trial.id);
    if (!hintsUsedData) {
        hintsUsedData = { trialId: trial.id, count: 0 };
        if (!gameState.hints_used_per_trial) gameState.hints_used_per_trial = [];
        gameState.hints_used_per_trial.push(hintsUsedData);
    }

    if (hintsUsedData.count >= trial.hint_count) {
        showAlert('No quedan más pistas para esta prueba.', 'error');
        return;
    }

    const hintNumber = hintsUsedData.count + 1;
    const hintText = trial[`hint${hintNumber}`];

    if (!hintText) {
        showAlert('No hay texto para esta pista.', 'error');
        return;
    }

    UIElements.hintText.innerHTML = hintText;
    // Modificado para usar style.display directamente
    if (UIElements.hintModal) {
        console.log("DEBUG: Intentando mostrar el modal de pista. Display antes:", UIElements.hintModal.style.display);
        UIElements.hintModal.style.display = 'flex'; // Mostrar directamente
        console.log("DEBUG: Modal de pista mostrado directamente. Display después:", UIElements.hintModal.style.display);
    }


    gameState.totalScore = Math.max(0, gameState.totalScore - trial.hint_cost);
    UIElements.scoreDisplay.textContent = gameState.totalScore;
    hintsUsedData.count++;
    gameState.globalHintsUsed++;

    UIElements.hintBtn.disabled = hintsUsedData.count >= trial.hint_count;

    saveState();
    syncStateWithSupabase();
}


// =================================================================
// FUNCIONES DE TEMPORIZADOR
// =================================================================

/**
 * Actualiza la visualización del tiempo total acumulado de las pruebas.
 */
function updateTotalTimeDisplay() {
    const totalTimeTrials = gameState.progressLog.reduce((sum, entry) => sum + entry.timeTaken, 0);
    const minutes = String(Math.floor(totalTimeTrials / 60)).padStart(2, '0');
    const seconds = String(totalTimeTrials % 60).padStart(2, '0');
    UIElements.totalTimerDisplay.textContent = `${minutes}:${seconds}`;
}


function startTrialTimer() {
    if (trialTimerInterval) clearInterval(trialTimerInterval);
    lastTrialStartTime = new Date();
    trialTimerInterval = setInterval(() => {
        const elapsed = Math.floor((new Date() - lastTrialStartTime) / 1000);
        const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const seconds = String(elapsed % 60).padStart(2, '0');
        UIElements.trialTimerDisplay.textContent = `${minutes}:${seconds}`;
    }, 1000);
}

function stopTrialTimer() {
    clearInterval(trialTimerInterval);
    UIElements.trialTimerDisplay.textContent = '00:00';
}


// =================================================================
// FUNCIONES DE GEOLOCALIZACIÓN Y MAPA (Leaflet)
// =================================================================

/**
 * Inicializa un mapa Leaflet en el contenedor especificado.
 */
function initMap(containerId) {
    if (map) {
        map.remove();
        map = null;
    }
    map = L.map(containerId).setView([43.535, -5.661], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    if (!playerMarker) {
        playerMarker = L.marker([0, 0], { opacity: 0.7, icon: L.divIcon({ className: 'player-marker-icon', html: '<div style="background-color: blue; width: 15px; height: 15px; border-radius: 50%;"></div>' }) }).addTo(map).bindPopup("¡Estás aquí!");
    } else {
        playerMarker.addTo(map);
    }
}

/**
 * Inicia el seguimiento de la ubicación del jugador.
 */
function startLocationTracking(target, isTrialValidation = false) {
    if (!navigator.geolocation) {
        showAlert('Geolocalización no soportada por tu navegador.', 'error');
        return;
    }

    const targetLatLng = L.latLng(target.latitude, target.longitude);

    if (watchPositionId) navigator.geolocation.clearWatch(watchPositionId);

    watchPositionId = navigator.geolocation.watchPosition(
        (position) => {
            const playerLatLng = L.latLng(position.coords.latitude, position.coords.longitude);

            if (playerMarker) {
                playerMarker.setLatLng(playerLatLng);
            } else {
                playerMarker = L.marker(playerLatLng).addTo(map).bindPopup("¡Estás aquí!");
            }

            if (targetMarker && playerMarker) {
                const bounds = L.latLngBounds(playerLatLng, targetLatLng);
                map.fitBounds(bounds.pad(0.2));
            } else {
                map.setView(playerLatLng, map.getZoom());
            }

            const distance = playerLatLng.distanceTo(targetLatLng);

            if (isTrialValidation) {
                if (distance <= target.tolerance_meters) {
                    playArrivalSound();
                    processAnswer(true);
                    stopLocationTracking();
                }
            } else {
                UIElements.distanceInfo.textContent = `Distancia al objetivo: ${distance.toFixed(0)} metros`;
                if (distance <= target.tolerance_meters) {
                    playArrivalSound();
                    showAlert('¡Has llegado a la ubicación!', 'success');
                    stopLocationTracking();
                    renderCurrentState();
                }
            }
        },
        (error) => {
            console.error("Geolocation error:", error);
            UIElements.distanceInfo.textContent = 'No se puede obtener tu ubicación.';
            if (isTrialValidation) {
                showAlert('Error de GPS: No se pudo obtener tu ubicación para validar la prueba.', 'error');
            }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
}

function stopLocationTracking() {
    if (watchPositionId) {
        navigator.geolocation.clearWatch(watchPositionId);
        watchPositionId = null;
    }
    if (map && playerMarker) {
        map.removeLayer(playerMarker);
        playerMarker = null;
    }
    if (map && targetMarker) {
        map.removeLayer(targetMarker);
        targetMarker = null;
    }
    if (map && targetCircle) {
        map.removeLayer(targetCircle);
        targetCircle = null;
    }
    if (UIElements.navLocationAudio) {
        UIElements.navLocationAudio.pause();
        UIElements.navLocationAudio.currentTime = 0;
    }
}


// =================================================================
// FUNCIONES DE ESCÁNER QR
// =================================================================

function startQrScanner() {
    // Modificado para usar style.display directamente
    if (UIElements.qrScannerModal) {
        UIElements.qrScannerModal.style.display = 'flex'; // Mostrar directamente
    } else {
        console.warn("ADVERTENCIA: Elemento #qr-scanner-modal no encontrado en el DOM.");
    }


    if (!html5QrCode) {
        try {
            html5QrCode = new Html5Qrcode("qr-reader");
        } catch (e) {
            console.error("Error al inicializar Html5Qrcode:", e);
            showAlert('Error al preparar el escáner QR. Intenta de nuevo.', 'error');
            return;
        }
    }

    html5QrCode.start(
        { facingMode: "environment" },
        {
            fps: 10,
            qrbox: { width: 250, height: 250 }
        },
        (decodedText, decodedResult) => {
            stopQrScanner();
            const trial = getCurrentTrial();
            const isCorrect = decodedText === trial.qr_content;
            processAnswer(isCorrect);
        },
        (errorMessage) => {
            // Ignorar errores
        })
        .catch((err) => {
            console.error("Error al iniciar la cámara del escáner QR:", err);
            showAlert('No se pudo iniciar la cámara. Asegúrate de dar permisos o intenta con otro navegador.', 'error');
            stopQrScanner();
        });
}

function stopQrScanner() {
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(err => console.error("Error al detener el escáner:", err));
    }
    // Modificado para usar style.display directamente
    if (UIElements.qrScannerModal) {
        UIElements.qrScannerModal.style.display = 'none'; // Ocultar directamente
    }
}


// =================================================================
// FIN DEL JUEGO
// =================================================================

async function endGame() {
    stopLocationTracking();

    const finalTimeSeconds = gameState.progressLog.reduce((sum, entry) => sum + entry.timeTaken, 0);
    gameState.totalTimeSeconds = finalTimeSeconds;
    gameState.isCompleted = true;

    await syncStateWithSupabase();

    UIElements.finalTeamName.textContent = gameState.teamName;
    UIElements.finalScore.textContent = gameState.totalScore;
    const minutes = String(Math.floor(finalTimeSeconds / 60)).padStart(2, '0');
    const seconds = String(finalTimeSeconds % 60).padStart(2, '0');
    UIElements.finalTime.textContent = `${minutes}m ${seconds}s`;

    showScreen('gameOver');
    loadFinalRanking();
}

async function loadFinalRanking() {
    UIElements.finalRankingContainer.innerHTML = '<p>Cargando ranking...</p>';
    try {
        const { data, error } = await supabase
            .from('teams')
            .select('name, total_score, total_time_seconds')
            .eq('game_id', gameState.gameId)
            .eq('is_completed', true)
            .order('total_score', { ascending: false })
            .order('total_time_seconds', { ascending: true })
            .limit(10);

        if (error) throw error;

        UIElements.finalRankingContainer.innerHTML = '';
        if (data.length === 0) {
            UIElements.finalRankingContainer.innerHTML = '<p>Nadie ha completado este juego todavía.</p>';
        } else {
            data.forEach((team, index) => {
                const item = document.createElement('div');
                item.className = 'ranking-item';
                if (team.name === gameState.teamName) {
                    item.classList.add('current-team');
                }
                const minutes = String(Math.floor(team.total_time_seconds / 60)).padStart(2, '0');
                const seconds = String(team.total_time_seconds % 60).padStart(2, '0');
                item.innerHTML = `<span>${index + 1}. ${team.name}</span><span>${team.total_score} pts (${minutes}:${seconds})</span>`;
                UIElements.finalRankingContainer.appendChild(item);
            });
        }

    } catch (error) {
        console.error("Error loading final ranking:", error);
        UIElements.finalRankingContainer.innerHTML = '<p>No se pudo cargar el ranking.</p>';
    }
}


// =================================================================
// FUNCIONES DE UTILIDAD
// =================================================================

function playArrivalSound() {
    // Reemplazar la implementación de audio actual con una que use un sonido de alerta más fuerte y estridente.
    // Esto se logra creando un nuevo AudioContext y un oscilador con un tipo de onda 'sawtooth' y una frecuencia más alta para un sonido más penetrante.
    // Además, se ajusta la ganancia para que sea más notable.
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.type = 'sawtooth'; // Tipo de onda que produce un sonido más "áspero" o estridente
        oscillator.frequency.setValueAtTime(1000, audioContext.currentTime); // Frecuencia más alta para un tono más agudo (1000 Hz)
        gainNode.gain.setValueAtTime(0.8, audioContext.currentTime); // Ganancia inicial más fuerte
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5); // Decay rápido pero audible

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5); // Duración del sonido
    } catch (e) {
        console.error("No se pudo reproducir el sonido de llegada:", e);
    }
}


function getCurrentTrial() {
    if (gameState.currentLocationIndex === -1 || gameState.currentTrialIndex === -1) return null;
    const location = gameState.gameData.locations[gameState.currentLocationIndex];
    if (!location || !location.trials || gameState.currentTrialIndex >= location.trials.length) return null;
    return location.trials[gameState.currentTrialIndex];
}

function getCurrentLocation() {
    if (gameState.currentLocationIndex === -1) return null;
    return gameState.gameData.locations[gameState.currentLocationIndex];
}

function isTrialCompleted(trialId) {
    return gameState.progressLog.some(log => log.trialId === trialId);
}

/**
 * Comprueba si todos las pruebas dentro de una ubicación han sido completadas.
 */
function isLocationCompleted(locationId) {
    const location = gameState.gameData.locations.find(loc => loc.id === locationId);
    if (!location || !location.trials) return false;
    return location.trials.every(trial => isTrialCompleted(trial.id));
}

function getHintsUsedForTrial(trialId) {
    const hintData = gameState.hints_used_per_trial?.find(p => p.trialId === trialId);
    return hintData ? hintData.count : 0;
}

/**
 * Muestra una alerta temporal al usuario.
 * @param {string} message - El mensaje a mostrar.
 * @param {string} type - Tipo de alerta ('info', 'success', 'error').
 * @param {HTMLElement} [parentElement=document.body] - El elemento padre donde se añadirá la alerta.
 */
function showAlert(message, type = 'info', parentElement = document.body) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `app-alert ${type}`;
    alertDiv.textContent = message;

    // Append to the specified parent or fallback to body
    parentElement.appendChild(alertDiv);

    // Trigger the 'show' class for the fade-in effect
    setTimeout(() => {
        alertDiv.classList.add('show');
    }, 10);

    // Set timeout to remove the alert after 3 seconds
    setTimeout(() => {
        alertDiv.classList.remove('show'); // Start fade out
        // Remove from DOM after transition
        const onTransitionEnd = () => {
            alertDiv.removeEventListener('transitionend', onTransitionEnd);
            alertDiv.remove();
        };
        alertDiv.addEventListener('transitionend', onTransitionEnd);
    }, 3000);
}

/**
 * NUEVO: Configura el listener de clic para la imagen de la prueba para hacer zoom.
 */
function setupImageZoomListener() {
    if (!UIElements.trialImage) {
        return;
    }

    // Asegurarse de que el listener no se añade varias veces
    UIElements.trialImage.removeEventListener('click', showZoomedImage);
    UIElements.trialImage.addEventListener('click', showZoomedImage);

    // Función para mostrar la imagen en un modal
    function showZoomedImage() {
        const imageUrl = UIElements.trialImage.src;
        if (!imageUrl) return;

        let modal = document.querySelector('.zoom-modal');
        let modalImg = document.querySelector('.zoom-modal-content');

        if (!modal) {
            // Si el modal no existe, lo creamos
            modal = document.createElement('div');
            modal.className = 'zoom-modal';
            modal.id = 'image-zoom-modal'; // Darle un ID para referenciarlo

            const closeBtn = document.createElement('span');
            closeBtn.className = 'zoom-close-btn';
            closeBtn.innerHTML = '&times;';
            modal.appendChild(closeBtn);
            closeBtn.onclick = () => hideZoomedImage(modal);

            modalImg = document.createElement('img');
            modalImg.className = 'zoom-modal-content';
            modal.appendChild(modalImg);

            document.body.appendChild(modal);

            // Cerrar el modal al hacer clic en el overlay
            modal.onclick = (e) => {
                if (e.target === modal) {
                    hideZoomedImage(modal);
                }
            };
        }

        modalImg.src = imageUrl;
        modal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Evita el scroll del fondo
    }

    function hideZoomedImage(modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}