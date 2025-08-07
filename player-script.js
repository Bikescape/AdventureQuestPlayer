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
    // NUEVOS ELEMENTOS PARA EL ZOOM DE IMÁGENES
    zoomModal: document.getElementById('zoom-modal'),
    zoomedImage: document.getElementById('zoomed-image'),
    zoomCloseBtn: document.getElementById('zoom-close-btn'),
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
    
    // Ocultar el modal de zoom al cargar la página
    if (UIElements.zoomModal) {
        UIElements.zoomModal.classList.remove('active');
    }

    if (buttons.closeQrScanner) {
        console.log("DEBUG: Botón de cerrar escáner encontrado.");
    }
    if (buttons.closeHint) {
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

    // NUEVO: Listener para abrir el modal de zoom al hacer clic en imágenes
    document.addEventListener('click', function(e) {
        if (e.target.matches('#narrative-image, #nav-location-image, #trial-image')) {
            openZoomModal(e.target.src);
        }
    });
    
    // NUEVO: Listener para cerrar el modal de zoom con el botón
    if (UIElements.zoomCloseBtn) {
        UIElements.zoomCloseBtn.addEventListener('click', closeZoomModal);
    }
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
    if (UIElements.narrativeText) {
        UIElements.narrativeText.innerHTML = text || "Un momento de calma antes de la siguiente prueba...";
    }
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
    if (UIElements.navPreArrivalNarrative) {
        UIElements.navPreArrivalNarrative.innerHTML = location.pre_arrival_narrative;
    }
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
    targetCircle = L.circle(targetCoords, { radius: location.tolerance_meters, color: 'orange', fillColor: '#ffc107', fillOpacity: 0.3 }).addTo(map);
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
    if (UIElements.backToListFromNavBtn) { // Añadir comprobación
        UIElements.backToListFromNavBtn.classList.add('hidden');
    }
    if (UIElements.backToListFromTrialBtn) { // Añadir comprobación
        UIElements.backToListFromTrialBtn.classList.add('hidden');
    }
}

/**
 * Muestra la vista de una prueba específica.
 * @param {object} trial - El objeto de la prueba a mostrar.
 */
function renderTrial(trial) {
    if (UIElements.trialNarrative) {
        UIElements.trialNarrative.innerHTML = trial.narrative;
    }
    if (UIElements.trialContent) {
        UIElements.trialContent.innerHTML = '';
    }
    
    // Configuración de imagen y audio
    if (trial.image_url && UIElements.trialImage) {
        UIElements.trialImage.src = trial.image_url;
        UIElements.trialImage.classList.remove('hidden');
    } else {
        UIElements.trialImage.classList.add('hidden');
    }
    if (trial.audio_url && UIElements.trialAudio) {
        UIElements.trialAudio.src = trial.audio_url;
        UIElements.trialAudio.classList.remove('hidden');
    } else {
        UIElements.trialAudio.classList.add('hidden');
    }

    // Lógica para mostrar el contenido de la prueba según el tipo
    switch (trial.trial_type) {
        case 'multiple_choice':
            renderMultipleChoice(trial);
            break;
        case 'text_input':
            renderTextInput(trial);
            break;
        case 'ordering':
            renderOrdering(trial);
            break;
        case 'qr_scan':
            renderQrScan(trial);
            break;
        default:
            UIElements.trialContent.innerHTML = '<p>Tipo de prueba no soportado.</p>';
            break;
    }
    
    // Configurar el botón de pista
    setupHintButton(trial);
    
    showGameView('trial');
    startTrialTimer();
}

/**
 * Abre el modal de zoom con la imagen clickeada.
 * @param {string} imageUrl - La URL de la imagen a mostrar.
 */
function openZoomModal(imageUrl) {
    if (UIElements.zoomModal && UIElements.zoomedImage) {
        UIElements.zoomedImage.src = imageUrl;
        UIElements.zoomModal.classList.add('active');
    }
}

/**
 * Cierra el modal de zoom.
 */
function closeZoomModal() {
    if (UIElements.zoomModal) {
        UIElements.zoomModal.classList.remove('active');
        UIElements.zoomedImage.src = '';
    }
}

/**
 * Renderiza una prueba de opción múltiple.
 * @param {object} trial - El objeto de la prueba.
 */
function renderMultipleChoice(trial) {
    const options = JSON.parse(trial.options);
    options.forEach(option => {
        const optionBtn = document.createElement('button');
        optionBtn.className = 'text-option';
        optionBtn.textContent = option.text;
        optionBtn.dataset.answer = option.is_correct;
        optionBtn.addEventListener('click', () => {
            document.querySelectorAll('.text-option').forEach(btn => btn.classList.remove('selected'));
            optionBtn.classList.add('selected');
        });
        UIElements.trialContent.appendChild(optionBtn);
    });
    buttons.validateAnswer.classList.remove('hidden');
}

/**
 * Renderiza una prueba de entrada de texto.
 * @param {object} trial - El objeto de la prueba.
 */
function renderTextInput(trial) {
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'text-answer-input';
    input.placeholder = 'Escribe tu respuesta aquí...';
    UIElements.trialContent.appendChild(input);
    buttons.validateAnswer.classList.remove('hidden');
}

/**
 * Renderiza una prueba de ordenación.
 * @param {object} trial - El objeto de la prueba.
 */
function renderOrdering(trial) {
    const items = JSON.parse(trial.options);
    const container = document.createElement('div');
    container.className = 'ordering-container';
    container.id = 'ordering-container';
    items.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'ordering-item';
        itemDiv.textContent = item.text;
        itemDiv.setAttribute('draggable', true);
        itemDiv.dataset.order = item.order;
        itemDiv.addEventListener('dragstart', handleDragStart);
        itemDiv.addEventListener('dragover', handleDragOver);
        itemDiv.addEventListener('dragleave', handleDragLeave);
        itemDiv.addEventListener('drop', handleDrop);
        itemDiv.addEventListener('dragend', handleDragEnd);
        container.appendChild(itemDiv);
    });
    UIElements.trialContent.appendChild(container);
    buttons.validateAnswer.classList.remove('hidden');
}

let draggedItem = null;

function handleDragStart(e) {
    draggedItem = this;
    setTimeout(() => this.classList.add('dragging'), 0);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (this !== draggedItem) {
        this.classList.add('drag-over');
    }
}

function handleDragLeave() {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    e.stopPropagation();
    if (this !== draggedItem) {
        const parent = this.parentNode;
        parent.insertBefore(draggedItem, this.nextSibling);
    }
    this.classList.remove('drag-over');
}

function handleDragEnd() {
    this.classList.remove('dragging');
    document.querySelectorAll('.ordering-item').forEach(item => {
        item.classList.remove('drag-over');
    });
    draggedItem = null;
}

/**
 * Renderiza una prueba de escaneo de QR.
 * @param {object} trial - El objeto de la prueba.
 */
function renderQrScan(trial) {
    const scanBtn = document.createElement('button');
    scanBtn.textContent = 'Escanear QR';
    scanBtn.className = 'action-button';
    scanBtn.onclick = () => startQrScanner();
    UIElements.trialContent.appendChild(scanBtn);
    buttons.validateAnswer.classList.add('hidden');
}


// =================================================================
// LÓGICA DE GEOLOCALIZACIÓN Y MAPA
// =================================================================

/**
 * Inicializa el mapa de Leaflet.
 */
function initMap(mapId) {
    if (map) {
        map.remove();
    }
    map = L.map(mapId).setView([43.535, -5.661], 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
}

/**
 * Inicia el seguimiento de la ubicación del usuario.
 * @param {object} targetLocation - El objeto de la ubicación de destino.
 */
function startLocationTracking(targetLocation) {
    if (watchPositionId) {
        navigator.geolocation.clearWatch(watchPositionId);
    }
    watchPositionId = navigator.geolocation.watchPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            const playerCoords = [lat, lon];
            const targetCoords = [targetLocation.latitude, targetLocation.longitude];
            const distance = getDistance(playerCoords, targetCoords);

            UIElements.distanceInfo.textContent = `Distancia: ${distance.toFixed(0)} metros`;
            if (playerMarker) {
                playerMarker.setLatLng(playerCoords);
            } else {
                playerMarker = L.marker(playerCoords).addTo(map).bindPopup('Tú estás aquí').openPopup();
            }
            map.panTo(playerCoords);

            // Verificar si el jugador está dentro del rango
            if (distance <= targetLocation.tolerance_meters) {
                showAlert('¡Has llegado a tu destino!', 'success');
                stopLocationTracking();
                startLocationTrials();
            }
        },
        (error) => {
            console.error('Error getting location:', error);
            showAlert('Error al obtener la ubicación. Asegúrate de tener el GPS activado.', 'error', document.getElementById('location-navigation-view'));
        }, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        }
    );
}

/**
 * Detiene el seguimiento de la ubicación.
 */
function stopLocationTracking() {
    if (watchPositionId) {
        navigator.geolocation.clearWatch(watchPositionId);
        watchPositionId = null;
    }
    if (map) {
        if (playerMarker) {
            map.removeLayer(playerMarker);
            playerMarker = null;
        }
        if (targetMarker) {
            map.removeLayer(targetMarker);
            targetMarker = null;
        }
        if (targetCircle) {
            map.removeLayer(targetCircle);
            targetCircle = null;
        }
    }
}

/**
 * Calcula la distancia entre dos coordenadas en metros (fórmula de Haversine).
 */
function getDistance(coord1, coord2) {
    const R = 6371e3; // Radio de la Tierra en metros
    const lat1 = coord1[0] * Math.PI / 180;
    const lat2 = coord2[0] * Math.PI / 180;
    const deltaLat = (coord2[0] - coord1[0]) * Math.PI / 180;
    const deltaLon = (coord2[1] - coord1[1]) * Math.PI / 180;

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) *
        Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}


// =================================================================
// LÓGICA DE PRUEBAS
// =================================================================

/**
 * Valida la respuesta de la prueba actual.
 */
function validateCurrentAnswer() {
    const trial = getCurrentTrial();
    if (!trial) return;

    let isCorrect = false;
    let givenAnswer = '';

    switch (trial.trial_type) {
        case 'multiple_choice':
            const selectedOption = document.querySelector('.text-option.selected');
            if (selectedOption) {
                givenAnswer = selectedOption.textContent;
                isCorrect = selectedOption.dataset.answer === 'true';
            } else {
                showAlert('Por favor, selecciona una opción.', 'error');
                return;
            }
            break;
        case 'text_input':
            const textInput = document.getElementById('text-answer-input');
            givenAnswer = textInput.value.trim();
            if (givenAnswer) {
                const correctAnswers = JSON.parse(trial.options).map(o => o.text.toLowerCase());
                isCorrect = correctAnswers.includes(givenAnswer.toLowerCase());
            } else {
                showAlert('Por favor, introduce tu respuesta.', 'error');
                return;
            }
            break;
        case 'ordering':
            const orderingItems = document.querySelectorAll('.ordering-item');
            const userOrder = Array.from(orderingItems).map(item => parseInt(item.dataset.order));
            const correctOrder = JSON.parse(trial.options).map(o => o.order);
            isCorrect = JSON.stringify(userOrder) === JSON.stringify(correctOrder);
            givenAnswer = userOrder.join(', ');
            break;
        case 'qr_scan':
            // La validación de QR se maneja en el callback del escáner
            return;
    }

    processAnswer(trial, isCorrect, givenAnswer);
}

/**
 * Procesa la respuesta de una prueba y actualiza el estado del juego.
 * @param {object} trial - El objeto de la prueba.
 * @param {boolean} isCorrect - Si la respuesta es correcta.
 * @param {string} givenAnswer - La respuesta dada por el usuario.
 */
function processAnswer(trial, isCorrect, givenAnswer) {
    stopTrialTimer();

    const timeTaken = Math.floor((new Date() - new Date(lastTrialStartTime)) / 1000);
    const currentScore = isCorrect ? trial.score : 0;
    const hintsUsed = getHintsUsedForTrial(trial.id);
    const finalScore = currentScore > 0 ? Math.max(0, currentScore - (hintsUsed * 10)) : 0; // Penalización por pistas

    if (isCorrect) {
        showAlert('¡Respuesta correcta!', 'success', UIElements.trialContent);
        gameState.totalScore += finalScore;
        UIElements.scoreDisplay.textContent = gameState.totalScore;
    } else {
        showAlert('Respuesta incorrecta. Inténtalo de nuevo.', 'error', UIElements.trialContent);
        setTimeout(() => startTrialTimer(), 2000); // Reinicia el temporizador si falla
        return; // No finaliza la prueba si la respuesta es incorrecta
    }

    // Registrar el progreso
    gameState.progressLog.push({
        trialId: trial.id,
        locationId: getCurrentLocation().id,
        timeTaken: timeTaken,
        score: finalScore,
        givenAnswer: givenAnswer,
        isCorrect: isCorrect
    });
    saveState();
    syncStateWithSupabase();

    if (getCurrentLocation().is_selectable_trials) {
        // Para pruebas seleccionables, volvemos al listado
        UIElements.backToListFromTrialBtn.classList.remove('hidden');
    } else {
        // Para pruebas lineales, pasamos automáticamente a la siguiente
        setTimeout(() => advanceToNextTrial(), 2000);
    }
}


/**
 * Inicia el escáner de códigos QR.
 */
function startQrScanner() {
    UIElements.qrScannerModal.style.display = 'flex';
    if (html5QrCode) {
        html5QrCode.stop().then(() => console.log("QR scanner stopped")).catch(err => console.log("Error stopping QR scanner:", err));
        html5QrCode = null;
    }
    html5QrCode = new Html5Qrcode("qr-reader");
    const qrCodeSuccessCallback = (decodedText, decodedResult) => {
        const trial = getCurrentTrial();
        stopQrScanner();
        if (decodedText.toLowerCase() === trial.answer_text.toLowerCase()) {
            processAnswer(trial, true, decodedText);
        } else {
            showAlert('Código QR incorrecto. Inténtalo de nuevo.', 'error', UIElements.trialContent);
        }
    };
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    html5QrCode.start({ facingMode: "environment" }, config, qrCodeSuccessCallback)
        .catch(err => console.log(`Error starting QR scanner: ${err}`));
}

/**
 * Detiene el escáner de códigos QR.
 */
function stopQrScanner() {
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            UIElements.qrScannerModal.style.display = 'none';
        }).catch(err => {
            console.error("Error stopping QR scanner:", err);
            UIElements.qrScannerModal.style.display = 'none';
        });
    } else {
        UIElements.qrScannerModal.style.display = 'none';
    }
}

/**
 * Solicita una pista para la prueba actual.
 */
async function requestHint() {
    const trial = getCurrentTrial();
    const hintCost = 10;
    if (gameState.totalScore < hintCost) {
        showAlert('Puntuación insuficiente para una pista.', 'error', UIElements.trialContent);
        return;
    }

    const hintsUsed = getHintsUsedForTrial(trial.id);
    if (hintsUsed > 0) {
        showAlert('Ya has solicitado una pista para esta prueba.', 'error', UIElements.trialContent);
        return;
    }

    const { data: hintData, error } = await supabase
        .from('hints')
        .select('text')
        .eq('trial_id', trial.id)
        .order('order_index', { ascending: true })
        .limit(1)
        .single();

    if (error || !hintData) {
        showAlert('No hay pistas disponibles para esta prueba.', 'error', UIElements.trialContent);
        return;
    }

    gameState.totalScore -= hintCost;
    UIElements.scoreDisplay.textContent = gameState.totalScore;
    const hintLog = gameState.hints_used_per_trial || [];
    const trialHintLogIndex = hintLog.findIndex(h => h.trialId === trial.id);
    if (trialHintLogIndex !== -1) {
        hintLog[trialHintLogIndex].count++;
    } else {
        hintLog.push({ trialId: trial.id, count: 1 });
    }
    gameState.hints_used_per_trial = hintLog;
    gameState.globalHintsUsed++;
    saveState();
    syncStateWithSupabase();

    UIElements.hintText.textContent = hintData.text;
    UIElements.hintModal.style.display = 'flex';
}

/**
 * Finaliza el juego y muestra el ranking.
 */
async function endGame() {
    showScreen('loading');
    stopTrialTimer();

    try {
        await syncStateWithSupabase();
        const { data: rankingData, error } = await supabase
            .from('teams')
            .select('name, total_score, total_time_seconds')
            .eq('game_id', gameState.gameId)
            .eq('is_completed', true)
            .order('total_score', { ascending: false })
            .order('total_time_seconds', { ascending: true });

        if (error) throw error;

        UIElements.finalTeamName.textContent = gameState.teamName;
        UIElements.finalScore.textContent = gameState.totalScore;
        UIElements.finalTime.textContent = formatTime(gameState.progressLog.reduce((sum, entry) => sum + entry.timeTaken, 0));

        UIElements.finalRankingContainer.innerHTML = '';
        rankingData.forEach((team, index) => {
            const rankingItem = document.createElement('div');
            rankingItem.className = 'ranking-item';
            rankingItem.innerHTML = `
                <span>${index + 1}. ${team.name}</span>
                <span>${team.total_score} pts. - ${formatTime(team.total_time_seconds)}</span>
            `;
            UIElements.finalRankingContainer.appendChild(rankingItem);
        });
    } catch (error) {
        console.error("Error fetching ranking:", error);
        showAlert('Error al cargar el ranking.', 'error');
    }
    showScreen('gameOver');
}

// =================================================================
// UTILIDADES Y TEMPORIZADORES
// =================================================================

/**
 * Inicia el temporizador de la prueba actual.
 */
function startTrialTimer() {
    lastTrialStartTime = new Date();
    stopTrialTimer(); // Asegurar que no haya múltiples temporizadores
    trialTimerInterval = setInterval(() => {
        const timeElapsed = Math.floor((new Date() - new Date(lastTrialStartTime)) / 1000);
        UIElements.trialTimerDisplay.textContent = formatTime(timeElapsed);
    }, 1000);
}

/**
 * Detiene el temporizador de la prueba actual.
 */
function stopTrialTimer() {
    if (trialTimerInterval) {
        clearInterval(trialTimerInterval);
        trialTimerInterval = null;
    }
}

/**
 * Actualiza el temporizador total del juego.
 */
function updateTotalTimeDisplay() {
    if (totalTimerInterval) {
        clearInterval(totalTimerInterval);
    }
    totalTimerInterval = setInterval(() => {
        const totalTimeSeconds = gameState.progressLog.reduce((sum, entry) => sum + entry.timeTaken, 0);
        UIElements.totalTimerDisplay.textContent = formatTime(totalTimeSeconds);
    }, 1000);
}

/**
 * Formatea un número de segundos en un formato de tiempo (HH:MM:SS).
 * @param {number} seconds - El número de segundos.
 * @returns {string} El tiempo formateado.
 */
function formatTime(seconds) {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
}

/**
 * Muestra una alerta temporal.
 * @param {string} message - El mensaje a mostrar.
 * @param {string} type - Tipo de alerta ('success', 'error').
 * @param {HTMLElement} [parentElement] - El elemento padre donde se mostrará la alerta.
 */
function showAlert(message, type = 'info', parentElement = document.body) {
    const alertDiv = UIElements.appAlert;
    if (!alertDiv) return;

    // Limpiar clases anteriores y establecer el nuevo mensaje y tipo
    alertDiv.textContent = message;
    alertDiv.className = 'app-alert';
    if (type) {
        alertDiv.classList.add(type);
    }
    
    // Si ya hay una alerta, la ocultamos y volvemos a mostrarla para reiniciar el temporizador
    clearTimeout(alertDiv.hideTimeout);

    // Muestra la alerta
    alertDiv.classList.add('show');

    // Configura el temporizador para ocultar la alerta
    alertDiv.hideTimeout = setTimeout(() => {
        alertDiv.classList.remove('show');
    }, 3000); // 3 segundos
}


// =================================================================
// FUNCIONES DE AYUDA Y ESTADO
// =================================================================

function getCurrentLocation() {
    return gameState.gameData.locations[gameState.currentLocationIndex];
}

function getCurrentTrial() {
    const location = getCurrentLocation();
    if (!location || !location.trials) return null;
    return location.trials[gameState.currentTrialIndex];
}

function isTrialCompleted(trialId) {
    return gameState.progressLog.some(p => p.trialId === trialId);
}

function isLocationCompleted(locationId) {
    const location = gameState.gameData.locations.find(loc => loc.id === locationId);
    if (!location || !location.trials) return false;
    return location.trials.every(trial => isTrialCompleted(trial.id));
}

function getHintsUsedForTrial(trialId) {
    const hintData = gameState.hints_used_per_trial?.find(p => p.trialId === trialId);
    return hintData ? hintData.count : 0;
}