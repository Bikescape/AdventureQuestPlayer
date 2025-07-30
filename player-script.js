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
    totalTimerDisplay: document.getElementById('total-timer-display'), // Este ahora mostrará el tiempo acumulado de las pruebas
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
    // NUEVOS BOTONES DE VOLVER AL LISTADO
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
let totalTimerInterval, trialTimerInterval; // totalTimerInterval ya no se usará para el display continuo
let lastTrialStartTime;
let watchPositionId;


// =================================================================
// INICIALIZACIÓN Y FLUJO PRINCIPAL
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Registro del Service Worker para PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js')
            .then(reg => console.log('Service Worker registered', reg))
            .catch(err => console.error('Service Worker registration failed', err));
    }

    // Comprobar si hay un estado de juego guardado
    const savedState = localStorage.getItem('treasureHuntGameState');
    if (savedState) {
        try {
            gameState = JSON.parse(savedState);
            // Si el juego está en curso (no completado)
            if (gameState.teamId && !gameState.isCompleted) {
                resumeGame();
                return;
            }
        } catch (error) {
            console.error("Error parsing saved state:", error);
            localStorage.removeItem('treasureHuntGameState');
        }
    }

    // Si no hay juego que reanudar, empezar desde el principio
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
            .select('id, title, description, mechanics, initial_narrative, adventure_type, initial_score_per_trial')
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
                // La descripción se muestra en la tarjeta de la lista de juegos
                card.innerHTML = `<h2>${game.title}</h2><p>${game.description}</p>`;
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
    buttons.closeHint.addEventListener('click', () => UIElements.hintModal.classList.add('hidden'));
    buttons.validateAnswer.addEventListener('click', validateCurrentAnswer);
    buttons.closeQrScanner.addEventListener('click', stopQrScanner);
    buttons.playAgain.addEventListener('click', () => {
        localStorage.removeItem('treasureHuntGameState');
        location.reload();
    });
    // NUEVOS LISTENERS PARA LOS BOTONES DE VOLVER AL LISTADO
    UIElements.backToListFromNavBtn.addEventListener('click', () => {
        console.log("Botón 'Volver a Ubicaciones' clicado."); // AÑADIDO PARA DEPURACIÓN
        stopLocationTracking(); // Detener seguimiento GPS
        advanceToNextLocation(); // Llama a la lógica para mostrar el listado de ubicaciones
    });
    UIElements.backToListFromTrialBtn.addEventListener('click', () => {
        console.log("Botón 'Volver a Pruebas' clicado."); // AÑADIDO PARA DEPURACIÓN
        stopTrialTimer(); // Detener el temporizador de la prueba
        startLocationTrials(); // Llama a la lógica para mostrar el listado de pruebas de la ubicación
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
    console.log(`showGameView() llamada para: ${viewName}`); // AÑADIDO PARA DEPURACIÓN
    Object.keys(gameViews).forEach(key => {
        if (gameViews[key]) { // Añadir comprobación por si el elemento es null (aunque no debería con el HTML ya corregido)
            gameViews[key].classList.add('hidden');
            gameViews[key].style.display = 'none'; // Ocultar directamente
        }
    });
    if (gameViews[viewName]) {
        gameViews[viewName].classList.remove('hidden');
        gameViews[viewName].style.display = 'block'; // Forzar visibilidad
        // Para elementos con display flex/grid, usa:
        // gameViews[viewName].style.display = 'flex';
        // O: gameViews[viewName].style.display = 'grid';
        // Dependiendo de cómo lo tengas definido en tu CSS para esa vista.
        // Si no estás seguro, 'block' es un buen inicio.
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
        // 1. Crear el equipo en Supabase
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

        // 2. Cargar toda la estructura del juego (ubicaciones y pruebas)
        const { data: gameStructure, error: gameError } = await supabase
            .from('games')
            .select(`
                *,
                locations (
                    *,
                    trials (
                        *
                    )
                )
            `)
            .eq('id', selectedGame.id)
            .single();

        if (gameError) throw gameError;

        // Ordenar ubicaciones y pruebas
        gameStructure.locations.sort((a, b) => a.order_index - b.order_index);
        gameStructure.locations.forEach(loc => loc.trials.sort((a, b) => a.order_index - b.order_index));

        // 3. Inicializar el estado del juego
        gameState = {
            teamId: teamData.id,
            teamName: teamData.name,
            gameId: selectedGame.id,
            gameData: gameStructure,
            currentLocationIndex: -1, // Empezamos antes de la primera ubicación, para mostrar narrativa inicial del juego
            currentTrialIndex: -1,
            totalScore: 0,
            startTime: startTime.toISOString(),
            progressLog: [],
            globalHintsUsed: 0,
            isCompleted: false,
        };

        // 4. Guardar estado y continuar
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

    // ACTUALIZACIÓN: Ya no se inicia el totalTimerInterval aquí.
    // El tiempo total se mostrará como la suma de los tiempos de las pruebas completadas.
    updateTotalTimeDisplay(); // Llamar para mostrar el tiempo acumulado inicial

    renderCurrentState();
}

/**
 * Sincroniza el estado local (gameState) con la base de datos.
 */
async function syncStateWithSupabase() {
    if (!gameState.teamId) return;

    // Calcular el tiempo total acumulado de las pruebas completadas
    const totalTimeTrials = gameState.progressLog.reduce((sum, entry) => sum + entry.timeTaken, 0);

    const updates = {
        current_location_id: gameState.gameData.locations[gameState.currentLocationIndex]?.id || null,
        current_trial_id: gameState.gameData.locations[gameState.currentLocationIndex]?.trials[gameState.currentTrialIndex]?.id || null,
        total_score: gameState.totalScore,
        progress_log: gameState.progressLog,
        hints_used_per_trial: gameState.hints_used_per_trial || [],
        hints_used_global: gameState.globalHintsUsed,
        total_time_seconds: totalTimeTrials, // Tiempo total basado en la suma de pruebas para el ranking
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
        updateTotalTimeDisplay(); // Actualizar el display del tiempo total tras la sincronización
    }
}


// =================================================================
// RENDERIZADO DE ESTADOS DEL JUEGO
// =================================================================

/**
 * Punto de entrada principal para decidir qué mostrar en la pantalla.
 */
function renderCurrentState() {
    saveState(); // Guardar siempre el estado antes de renderizar
    const game = gameState.gameData;
    const locIndex = gameState.currentLocationIndex;

    // Si el juego ha terminado
    if (gameState.isCompleted) {
        endGame();
        return;
    }

    // Si aún no hemos empezado la primera ubicación (narrativa inicial del juego)
    if (locIndex === -1) {
        // Mostrar la narrativa inicial del juego y luego avanzar a la primera ubicación/selección de ubicación
        showNarrativeView(game.initial_narrative, null, null, advanceToNextLocation);
        return;
    }

    const location = game.locations[locIndex];
    const trialIndex = gameState.currentTrialIndex;

    // Si hemos llegado a una ubicación pero aún no hemos empezado las pruebas (narrativa de ubicación)
    // Esto se ejecuta cuando se ha avanzado a una nueva ubicación, ya sea linealmente o seleccionándola de la lista.
    if (trialIndex === -1) {
        showNarrativeView(location.initial_narrative, location.image_url, location.audio_url, startLocationTrials);
        return;
    }

    const trial = location.trials[trialIndex];

    // Si la prueba actual está marcada como completada, avanzar
    // Esto es especialmente importante para "pruebas seleccionables"
    if (isTrialCompleted(trial.id)) {
        if (location.is_selectable_trials) {
            // Si es seleccionable, y esta prueba ya está completada, volvemos a la lista de pruebas de la ubicación
            startLocationTrials();
        } else {
            // Si es lineal, simplemente avanzamos a la siguiente prueba lineal
            advanceToNextTrial();
        }
        return;
    }

    // Renderizar la prueba actual
    renderTrial(trial);
}


/**
 * Avanza a la siguiente ubicación.
 * También gestiona si el juego es de ubicaciones lineales o seleccionables.
 */
function advanceToNextLocation() {
    console.log("Función advanceToNextLocation() llamada."); // AÑADIDO PARA DEPURACIÓN
    stopLocationTracking(); // Detener el seguimiento GPS al cambiar de ubicación
    const game = gameState.gameData;

    console.log("Tipo de aventura:", game.adventure_type); // AÑADIDO PARA DEPURACIÓN

    if (game.adventure_type === 'linear') {
        gameState.currentLocationIndex++; // Avanzar al siguiente índice lineal
        gameState.currentTrialIndex = -1; // Reiniciar índice de pruebas para la nueva ubicación

        if (gameState.currentLocationIndex >= game.locations.length) {
            // Se han completado todas las ubicaciones
            gameState.isCompleted = true;
            renderCurrentState(); // Esto llamará a endGame()
            return;
        }
        const location = game.locations[gameState.currentLocationIndex];
        // Mostrar el mapa para navegar a la nueva ubicación
        showLocationNavigationView(location);
    } else { // 'selectable'
        // Si es seleccionable, no incrementamos el currentLocationIndex aquí,
        // sino que el usuario lo elegirá de una lista.
        const uncompletedLocations = game.locations.filter(loc => !isLocationCompleted(loc.id));

        console.log("Ubicaciones no completadas:", uncompletedLocations.length, uncompletedLocations); // AÑADIDO PARA DEPURACIÓN

        if (uncompletedLocations.length > 0) {
            console.log("Mostrando lista de ubicaciones..."); // AÑADIDO PARA DEPURACIÓN
            showListView('ubicaciones', uncompletedLocations, (selectedLoc) => {
                // Al seleccionar una ubicación de la lista, actualizamos el índice
                gameState.currentLocationIndex = game.locations.findIndex(l => l.id === selectedLoc.id);
                gameState.currentTrialIndex = -1; // Reiniciar para la nueva ubicación seleccionada
                // Una vez seleccionada la ubicación, ir a la navegación GPS para alcanzarla
                showLocationNavigationView(selectedLoc);
            });
        } else {
            // Todas las ubicaciones completadas en modo seleccionable
            console.log("Todas las ubicaciones completadas. Terminando juego."); // AÑADIDO PARA DEPURACIÓN
            gameState.isCompleted = true;
            renderCurrentState(); // Esto llamará a endGame()
        }
    }
}

/**
 * Inicia las pruebas de la ubicación actual.
 * Determina si son lineales o seleccionables.
 */
function startLocationTrials() {
    console.log("startLocationTrials() llamada."); // AÑADIDO PARA DEPURACIÓN
    stopLocationTracking(); // Asegurarse de que el seguimiento de ubicación no interfiera con las pruebas
    const location = gameState.gameData.locations[gameState.currentLocationIndex];

    if (location.is_selectable_trials) {
        // Mostrar lista de pruebas para que el jugador elija
        console.log("Mostrando lista de pruebas para ubicación seleccionable."); // AÑADIDO PARA DEPURACIÓN
        showListView('pruebas', location.trials, (trial) => {
            // Encontrar el índice de la prueba seleccionada y empezarla
            gameState.currentTrialIndex = location.trials.findIndex(t => t.id === trial.id);
            renderCurrentState(); // Esto llamará a renderTrial()
        });
    } else {
        // Empezar la primera prueba (o la siguiente lineal)
        console.log("Avanzando a la siguiente prueba lineal."); // AÑADIDO PARA DEPURACIÓN
        advanceToNextTrial();
    }
}

/**
 * Avanza a la siguiente prueba en la ubicación actual (solo para juegos/pruebas lineales).
 */
function advanceToNextTrial() {
    console.log("advanceToNextTrial() llamada."); // AÑADIDO PARA DEPURACIÓN
    gameState.currentTrialIndex++;
    const location = gameState.gameData.locations[gameState.currentLocationIndex];

    // Si todas las pruebas de la ubicación actual se han completado
    if (gameState.currentTrialIndex >= location.trials.length) {
        console.log("Todas las pruebas de la ubicación actual completadas. Avanzando a la siguiente ubicación."); // AÑADIDO PARA DEPURACIÓN
        advanceToNextLocation(); // Pasar a la siguiente ubicación
    } else {
        console.log(`Renderizando prueba ${gameState.currentTrialIndex + 1} de ${location.trials.length}.`); // AÑADIDO PARA DEPURACIÓN
        renderCurrentState(); // Renderizar la siguiente prueba lineal
    }
}


// =================================================================
// VISTAS ESPECÍFICAS
// =================================================================

/**
 * Muestra una pantalla de narrativa.
 * @param {string} text - El texto de la narrativa.
 * @param {string|null} imageUrl - URL de la imagen.
 * @param {string|null} audioUrl - URL del audio.
 * @param {function} onContinue - Callback a ejecutar al pulsar continuar.
 */
function showNarrativeView(text, imageUrl, audioUrl, onContinue) {
    console.log("showNarrativeView() llamada."); // AÑADIDO PARA DEPURACIÓN
    UIElements.narrativeText.innerHTML = text || "Un momento de calma antes de la siguiente prueba...";

    UIElements.narrativeImage.classList.toggle('hidden', !imageUrl);
    UIElements.narrativeImage.src = imageUrl || '';

    UIElements.narrativeAudio.src = audioUrl || '';
    if (audioUrl) UIElements.narrativeAudio.play().catch(e => console.log("Audio play prevented by browser."));

    // Reemplazamos el event listener para asegurar que solo haya uno
    const newContinueBtn = buttons.narrativeContinue.cloneNode(true);
    buttons.narrativeContinue.parentNode.replaceChild(newContinueBtn, buttons.narrativeContinue);
    buttons.narrativeContinue = newContinueBtn;
    buttons.narrativeContinue.addEventListener('click', onContinue);

    showGameView('narrative');
}

/**
 * Muestra el mapa y la información para navegar a una ubicación.
 * @param {object} location - La ubicación destino.
 */
function showLocationNavigationView(location) {
    console.log("showLocationNavigationView() llamada."); // AÑADIDO PARA DEPURACIÓN

    UIElements.navLocationName.textContent = location.name;
    UIElements.navPreArrivalNarrative.innerHTML = location.pre_arrival_narrative || "Dirígete a la ubicación para continuar la aventura.";

    // Mostrar imagen y audio de la ubicación de navegación
    UIElements.navLocationImage.classList.toggle('hidden', !location.image_url);
    UIElements.navLocationImage.src = location.image_url || '';

    UIElements.navLocationAudio.src = location.audio_url || '';
    if (location.audio_url) UIElements.navLocationAudio.play().catch(e => console.log("Audio play prevented by browser."));

    showGameView('locationNav');

    // Inicializar o actualizar el mapa
    if (!map) {
        map = L.map('map-container').setView([0, 0], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        playerMarker = L.marker([0, 0]).addTo(map).bindPopup("¡Estás aquí!");
        targetMarker = L.marker([0, 0], { icon: L.icon({ iconUrl: 'assets/target-icon.png', iconSize: [32, 32] }) }).addTo(map).bindPopup(location.name);
        targetCircle = L.circle([0, 0], { color: 'blue', fillColor: '#30f', fillOpacity: 0.2, radius: 20 }).addTo(map);
    }

    // Asegurarse de que el mapa se invalide (refresque) cuando la vista es visible
    // Esto es importante si el mapa se inicializa en un contenedor oculto
    setTimeout(() => {
        map.invalidateSize();
        // Centrar y mostrar marcador de destino
        targetMarker.setLatLng([location.latitude, location.longitude]).setPopupContent(location.name).openPopup();
        targetCircle.setLatLng([location.latitude, location.longitude]).setRadius(location.radius || 20); // Radio de activación

        // Iniciar el seguimiento de la ubicación
        startLocationTracking(location);
    }, 100); // Pequeño retardo para asegurar que el elemento DOM esté renderizado

    // Mostrar u ocultar el botón "Volver a ubicaciones"
    if (gameState.gameData.adventure_type === 'selectable') {
        UIElements.backToListFromNavBtn.classList.remove('hidden');
        UIElements.backToListFromNavBtn.style.display = 'block'; // O 'inline-block', 'flex', etc.
    } else {
        UIElements.backToListFromNavBtn.classList.add('hidden');
        UIElements.backToListFromNavBtn.style.display = 'none';
    }
}

/**
 * Muestra una lista de elementos seleccionables (ubicaciones o pruebas).
 * @param {string} type - 'ubicaciones' o 'pruebas'.
 * @param {Array} items - Los elementos a listar.
 * @param {function} onSelect - Callback a ejecutar con el item seleccionado.
 */
function showListView(type, items, onSelect) {
    console.log(`showListView() llamada para tipo: ${type} con ${items.length} items.`); // AÑADIDO PARA DEPURACIÓN
    UIElements.listTitle.textContent = type === 'ubicaciones' ? 'Elige tu próximo destino' : 'Elige tu próxima prueba';
    UIElements.listItemsContainer.innerHTML = '';

    const sortedItems = [...items].sort((a,b) => (a.order_index || 0) - (b.order_index || 0)); // Asegurar ordenación

    sortedItems.forEach(item => {
        // No mostrar pruebas ya completadas para las listas de pruebas
        if (type === 'pruebas' && isTrialCompleted(item.id)) return;
        // No mostrar ubicaciones ya completadas para las listas de ubicaciones
        if (type === 'ubicaciones' && isLocationCompleted(item.id)) return;

        const itemButton = document.createElement('button');
        itemButton.className = 'action-button';
        itemButton.textContent = item.name || item.title;
        itemButton.onclick = () => onSelect(item);
        UIElements.listItemsContainer.appendChild(itemButton);
    });

    showGameView('list');

    // Mostrar u ocultar el botón "Volver a ubicaciones" (solo si es una lista de pruebas)
    if (type === 'pruebas') {
        UIElements.backToListFromTrialBtn.classList.remove('hidden');
        if (UIElements.backToListFromTrialBtn.style.display === 'none') {
            UIElements.backToListFromTrialBtn.style.display = 'block'; // O 'inline-block', 'flex', etc.
        }
    } else {
        UIElements.backToListFromTrialBtn.classList.add('hidden');
        UIElements.backToListFromTrialBtn.style.display = 'none';
    }
}

/**
 * Renderiza la prueba actual en la vista de prueba.
 * @param {object} trial - El objeto de la prueba a renderizar.
 */
function renderTrial(trial) {
    console.log("renderTrial() llamada para prueba:", trial.title);
    stopLocationTracking(); // Asegurarse de que el seguimiento GPS no esté activo durante la prueba

    UIElements.trialImage.classList.toggle('hidden', !trial.image_url);
    UIElements.trialImage.src = trial.image_url || '';

    UIElements.trialAudio.src = trial.audio_url || '';
    if (trial.audio_url) UIElements.trialAudio.play().catch(e => console.log("Audio play prevented."));

    UIElements.trialNarrative.innerHTML = trial.narrative;
    renderTrialContent(trial); // Esto renderiza el input/opciones específicas del tipo de prueba
    startTrialTimer();
    updateHintButtonState(); // Actualizar el estado del botón de pista
    showGameView('trial');
    // Asegurarse de mostrar el botón de "Volver a Pruebas" si las pruebas son seleccionables
    const location = gameState.gameData.locations[gameState.currentLocationIndex];
    if (location && location.is_selectable_trials) {
        UIElements.backToListFromTrialBtn.classList.remove('hidden');
        if (UIElements.backToListFromTrialBtn.style.display === 'none') {
            UIElements.backToListFromTrialBtn.style.display = 'block'; // O 'inline-block', 'flex', etc.
        }
    } else {
        UIElements.backToListFromTrialBtn.classList.add('hidden');
        UIElements.backToListFromTrialBtn.style.display = 'none';
    }
}

/**
 * Renderiza el contenido específico del tipo de prueba (QR, GPS, Texto).
 * @param {object} trial - El objeto de la prueba.
 */
function renderTrialContent(trial) {
    console.log("renderTrialContent() llamada para tipo:", trial.trial_type); // AÑADIDO PARA DEPURACIÓN
    UIElements.trialContent.innerHTML = '';
    UIElements.validateAnswer.classList.remove('hidden');

    switch (trial.trial_type) {
        case 'qr':
            const qrButton = document.createElement('button');
            qrButton.textContent = '🔍 Escanear Código QR';
            qrButton.className = 'action-button';
            qrButton.onclick = startQrScanner;
            UIElements.trialContent.appendChild(qrButton);
            UIElements.validateAnswer.classList.add('hidden'); // La validación es automática
            break;
        case 'gps':
            UIElements.trialContent.innerHTML = `<p>Dirígete a las coordenadas indicadas. La prueba se validará automáticamente cuando estés en la zona.</p><div id="map-trial-container" style="height: 300px; width: 100%;"></div>`;
            initMap('map-trial-container', trial.latitude, trial.longitude, trial.radius);
            startLocationTracking(trial, true); // Iniciar seguimiento para validación de prueba
            UIElements.validateAnswer.classList.add('hidden'); // La validación es automática
            break;
        case 'text':
            UIElements.trialContent.innerHTML = `<input type="text" id="text-answer-input" placeholder="Introduce tu respuesta aquí">`;
            break;
        case 'numeric':
            UIElements.trialContent.innerHTML = `<input type="number" id="text-answer-input" placeholder="Introduce un número">`;
            break;
        case 'multiple_options':
            const optionsContainer = document.createElement('div');
            optionsContainer.className = 'text-options-container';
            trial.options.forEach(option => {
                const optionBtn = document.createElement('button');
                optionBtn.className = 'text-option';
                optionBtn.textContent = option;
                optionBtn.dataset.value = option; // Guardar el valor en un data attribute
                optionBtn.onclick = () => {
                    document.querySelectorAll('.text-option').forEach(btn => btn.classList.remove('selected'));
                    optionBtn.classList.add('selected');
                };
                optionsContainer.appendChild(optionBtn);
            });
            UIElements.trialContent.appendChild(optionsContainer);
            break;
        case 'ordering':
            UIElements.trialContent.innerHTML = `<p>Arrastra los elementos para ordenarlos correctamente:</p><ul id="sortable-list" class="ordering-container"></ul>`;
            const sortableList = UIElements.trialContent.querySelector('#sortable-list');
            trial.options.forEach(option => {
                const li = document.createElement('li');
                li.className = 'ordering-item';
                li.textContent = option;
                li.dataset.value = option;
                li.draggable = true;
                sortableList.appendChild(li);
            });
            addDragAndDropListeners(sortableList);
            break;
        default:
            UIElements.trialContent.innerHTML = `<p>Tipo de prueba no soportado o con error de configuración.</p>`;
            UIElements.validateAnswer.classList.add('hidden');
            break;
    }
}

/**
 * Valida la respuesta actual del jugador para la prueba en curso.
 */
function validateCurrentAnswer() {
    const trial = getCurrentTrial();
    if (!trial) {
        showAlert('No hay prueba activa para validar.', 'error');
        return;
    }

    let userAnswer;
    let isCorrect = false;

    // Lógica de validación según el tipo de prueba
    if (trial.trial_type === 'qr' || trial.trial_type === 'gps') {
        // Estas pruebas tienen su propia lógica de validación automática
        showAlert('Esta prueba se valida automáticamente.', 'info');
        return;
    } else {
        switch (trial.trial_type) {
            case 'text':
                userAnswer = document.getElementById('text-answer-input').value.trim();
                // Comparación insensible a mayúsculas/minúsculas y acentos
                isCorrect = removeAccents(userAnswer.toLowerCase()) === removeAccents(trial.correct_answer.toLowerCase());
                break;
            case 'numeric':
                userAnswer = document.getElementById('text-answer-input').value.trim();
                // Comparación estricta para números
                isCorrect = userAnswer === String(trial.correct_answer);
                break;
            case 'multiple_options':
                const selectedOption = document.querySelector('.text-option.selected');
                userAnswer = selectedOption ? selectedOption.dataset.value : '';
                isCorrect = userAnswer === trial.correct_answer;
                break;
            case 'ordering':
                const orderedItems = Array.from(document.querySelectorAll('#sortable-list .ordering-item'))
                    .map(item => item.dataset.value);
                userAnswer = orderedItems.join(',');
                isCorrect = userAnswer === trial.correct_answer.join(',');
                break;
            default:
                // Esto no debería ocurrir si renderTrialContent maneja todos los casos
                showAlert('Tipo de respuesta no soportado aún.', 'error');
                return;
        }
    }

    processAnswer(isCorrect);
}

/**
 * Procesa el resultado de una validación.
 * @param {boolean} isCorrect - Si la respuesta fue correcta.
 */
function processAnswer(isCorrect) {
    console.log("processAnswer() llamada. Correcta:", isCorrect); // AÑADIDO PARA DEPURACIÓN
    stopTrialTimer(); // Detener el temporizador de prueba

    const trial = getCurrentTrial();
    const timeTaken = Math.floor((new Date().getTime() - lastTrialStartTime) / 1000); // Tiempo en segundos

    if (isCorrect) {
        // Añadir puntos a la puntuación total
        const scoreEarned = trial.score_earned || gameState.gameData.initial_score_per_trial || 0;
        gameState.totalScore += scoreEarned;
        UIElements.scoreDisplay.textContent = gameState.totalScore;
        showAlert(`¡Respuesta correcta! Ganaste ${scoreEarned} puntos.`, 'success');
    } else {
        showAlert('Respuesta incorrecta. Inténtalo de nuevo.', 'error');
    }

    // Registrar el progreso, independientemente de si la respuesta fue correcta
    gameState.progressLog.push({
        trialId: trial.id,
        locationId: gameState.gameData.locations[gameState.currentLocationIndex].id,
        isCorrect: isCorrect,
        timeTaken: timeTaken,
        timestamp: new Date().toISOString()
    });

    saveState();
    syncStateWithSupabase(); // Sincroniza y actualizará el display del tiempo total

    // Si la respuesta es correcta, avanzamos a la siguiente prueba o ubicación
    if (isCorrect) {
        advanceToNextTrial();
    }
}


// =================================================================
// LÓGICA DE PISTAS
// =================================================================

/**
 * Solicita y muestra una pista para la prueba actual.
 */
function requestHint() {
    const trial = getCurrentTrial();
    if (!trial) {
        showAlert('No hay prueba activa para pedir pista.', 'error');
        return;
    }

    // Buscar si ya hemos usado pistas para esta prueba
    let hintsUsedData = gameState.hints_used_per_trial.find(h => h.trialId === trial.id);

    if (!hintsUsedData) {
        hintsUsedData = { trialId: trial.id, count: 0 };
        if (!gameState.hints_used_per_trial) gameState.hints_used_per_trial = [];
        gameState.hints_used_per_trial.push(hintsUsedData);
    }

    if (hintsUsedData.count >= trial.hint_count) {
        showAlert('No quedan más pistas para esta prueba.', 'error');
        return;
    }

    // Mostrar la pista correspondiente
    const hintNumber = hintsUsedData.count + 1;
    const hintText = trial[`hint${hintNumber}`];
    if (!hintText) {
        showAlert('No hay texto para esta pista.', 'error');
        return;
    }
    UIElements.hintText.innerHTML = hintText;
    UIElements.hintModal.classList.remove('hidden');

    // Aplicar penalización y actualizar estado
    gameState.totalScore = Math.max(0, gameState.totalScore - trial.hint_cost);
    UIElements.scoreDisplay.textContent = gameState.totalScore;
    hintsUsedData.count++;
    gameState.globalHintsUsed++;
    UIElements.hintBtn.disabled = hintsUsedData.count >= trial.hint_count;
    saveState();
    syncStateWithSupabase(); // Sincroniza y actualizará el display del tiempo total
}


// =================================================================
// FUNCIONES DE TEMPORIZADOR
// =================================================================

/**
 * Inicia el temporizador de una prueba.
 */
function startTrialTimer() {
    stopTrialTimer(); // Asegurar que no hay un temporizador previo corriendo
    lastTrialStartTime = new Date().getTime(); // Registrar el inicio de la prueba
    trialTimerInterval = setInterval(() => {
        const currentTime = new Date().getTime();
        const elapsedSeconds = Math.floor((currentTime - lastTrialStartTime) / 1000);
        UIElements.trialTimerDisplay.textContent = formatTime(elapsedSeconds);
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
 * Actualiza el display del tiempo total acumulado de las pruebas.
 */
function updateTotalTimeDisplay() {
    const totalTimeTrials = gameState.progressLog.reduce((sum, entry) => sum + entry.timeTaken, 0);
    UIElements.totalTimerDisplay.textContent = formatTime(totalTimeTrials);
}

/**
 * Formatea segundos a MM:SS.
 * @param {number} totalSeconds - Segundos totales.
 * @returns {string} Tiempo formateado.
 */
function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// =================================================================
// LÓGICA DE GEOLOCALIZACIÓN Y MAPA
// =================================================================

/**
 * Inicializa el mapa de Leaflet.
 * @param {string} mapContainerId - ID del contenedor del mapa.
 * @param {number} lat - Latitud inicial.
 * @param {number} lng - Longitud inicial.
 * @param {number} radius - Radio del círculo objetivo.
 */
function initMap(mapContainerId, lat, lng, radius) {
    if (map) {
        map.remove(); // Limpiar el mapa existente si lo hay
    }
    map = L.map(mapContainerId).setView([lat, lng], 16); // Zoom más cercano para pruebas

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    playerMarker = L.marker([0, 0]).addTo(map).bindPopup("¡Estás aquí!");
    targetMarker = L.marker([lat, lng], { icon: L.icon({ iconUrl: 'assets/target-icon.png', iconSize: [32, 32] }) }).addTo(map).bindPopup("Objetivo");
    targetCircle = L.circle([lat, lng], { color: 'blue', fillColor: '#30f', fillOpacity: 0.2, radius: radius || 20 }).addTo(map);

    // Asegurarse de que el mapa se invalide (refresque) cuando la vista es visible
    setTimeout(() => map.invalidateSize(), 100);
}

/**
 * Inicia el rastreo de la posición del jugador.
 * @param {object} target - El objeto (ubicación o prueba GPS) a rastrear.
 * @param {boolean} isTrialValidation - Si estamos validando una prueba GPS.
 */
function startLocationTracking(target, isTrialValidation = false) {
    if (!navigator.geolocation) {
        showAlert('Geolocalización no soportada por tu navegador.', 'error');
        return;
    }

    const targetLatLng = L.latLng(target.latitude, target.longitude);
    const activationRadius = target.radius || 20; // Radio de activación en metros

    if (watchPositionId) navigator.geolocation.clearWatch(watchPositionId);

    watchPositionId = navigator.geolocation.watchPosition(
        (position) => {
            const playerLatLng = L.latLng(position.coords.latitude, position.coords.longitude);

            if (playerMarker) {
                playerMarker.setLatLng(playerLatLng);
            } else {
                // Esto debería estar ya inicializado en initMap, pero como fallback
                playerMarker = L.marker(playerLatLng).addTo(map).bindPopup("¡Estás aquí!");
            }

            // Ajustar el zoom del mapa para abarcar ambos marcadores
            if (targetMarker && playerMarker) { // targetMarker es el de la ubicación/prueba
                const bounds = L.latLngBounds(playerLatLng, targetLatLng);
                map.fitBounds(bounds.pad(0.2)); // Añadir un poco de padding
            } else {
                map.setView(playerLatLng, map.getZoom()); // Si solo hay un marcador, centrar en el jugador
            }

            const distance = playerLatLng.distanceTo(targetLatLng);
            UIElements.distanceInfo.textContent = `Distancia al objetivo: ${distance.toFixed(0)} metros`;

            // Actualizar barra de progreso de llegada
            const maxDistanceForProgress = 200; // Distancia a partir de la cual empieza a mostrar progreso
            let progress = 100 - Math.min(100, (distance / maxDistanceForProgress) * 100);
            progress = Math.max(0, progress); // Asegurar que no sea negativo
            document.getElementById('arrival-progress-bar').style.setProperty('--width', `${progress}%`);


            // Lógica de validación
            if (distance <= activationRadius) {
                if (isTrialValidation) {
                    stopLocationTracking(); // Detener el seguimiento una vez validado
                    processAnswer(true); // Validar la prueba GPS
                    showAlert('¡Ubicación alcanzada! Prueba completada.', 'success');
                } else {
                    // Si es una ubicación y se ha alcanzado el destino, avanzar a las pruebas de la ubicación
                    stopLocationTracking();
                    showAlert('¡Has llegado a la ubicación!', 'success');
                    startLocationTrials();
                }
            }
        },
        (error) => {
            console.error("Error al obtener la ubicación:", error);
            showAlert(`Error de geolocalización: ${error.message}. Asegúrate de habilitar los permisos de ubicación.`, 'error');
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

/**
 * Detiene el rastreo de la posición del jugador.
 */
function stopLocationTracking() {
    if (watchPositionId) {
        navigator.geolocation.clearWatch(watchPositionId);
        watchPositionId = null;
        console.log("Seguimiento de ubicación detenido.");
    }
}


// =================================================================
// LÓGICA DE ESCÁNER QR
// =================================================================

/**
 * Inicia el escáner QR.
 */
function startQrScanner() {
    UIElements.qrScannerModal.classList.remove('hidden');
    if (!html5QrCode) {
        try {
            html5QrCode = new Html5Qrcode("qr-reader");
        } catch (e) {
            console.error("Error al inicializar Html5Qrcode:", e);
            showAlert('Error al preparar el escáner QR. Intenta de nuevo.', 'error');
            return; // Salir si la inicialización falla
        }
    }

    html5QrCode.start(
        { facingMode: "environment" }, // Pedir cámara trasera
        {
            fps: 10,
            qrbox: { width: 250, height: 250 }
        },
        (decodedText, decodedResult) => {
            // Éxito en el escaneo
            stopQrScanner();
            const trial = getCurrentTrial();
            const isCorrect = decodedText === trial.qr_content;
            processAnswer(isCorrect);
        },
        (errorMessage) => {
            // Ignorar errores de "no se encontró QR" si la cámara sigue activa
            // console.warn("QR Scan Error:", errorMessage);
        })
        .catch((err) => {
            console.error("Error al iniciar la cámara del escáner QR:", err);
            showAlert('No se pudo iniciar la cámara. Asegúrate de dar permisos o intenta con otro navegador.', 'error');
            stopQrScanner(); // Asegurarse de cerrar el modal en caso de error
        });
}

/**
 * Detiene el escáner QR.
 */
function stopQrScanner() {
    UIElements.qrScannerModal.classList.add('hidden');
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            html5QrCode.clear();
            console.log("QR scanner stopped.");
        }).catch(err => {
            console.error("Error stopping QR scanner:", err);
        });
    }
}


// =================================================================
// LÓGICA DE DRAG AND DROP (Para pruebas de ordenación)
// =================================================================

/**
 * Añade listeners de Drag & Drop a una lista sortable.
 * @param {HTMLElement} listElement - El elemento <ul> que contiene los items.
 */
function addDragAndDropListeners(listElement) {
    let draggedItem = null;

    listElement.addEventListener('dragstart', (e) => {
        draggedItem = e.target;
        setTimeout(() => {
            e.target.style.opacity = '0.5';
        }, 0);
        e.dataTransfer.effectAllowed = 'move';
    });

    listElement.addEventListener('dragend', (e) => {
        e.target.style.opacity = '1';
        draggedItem = null;
    });

    listElement.addEventListener('dragover', (e) => {
        e.preventDefault(); // Permite el drop
        const target = e.target;
        if (target.classList.contains('ordering-item') && target !== draggedItem) {
            const bounding = target.getBoundingClientRect();
            const offset = bounding.y + (bounding.height / 2);
            if (e.clientY > offset) {
                // Dragging below the center of the target
                listElement.insertBefore(draggedItem, target.nextElementSibling);
            } else {
                // Dragging above the center of the target
                listElement.insertBefore(draggedItem, target);
            }
        }
    });

    listElement.addEventListener('dragleave', (e) => {
        // No es necesario para esta implementación simple
    });

    listElement.addEventListener('drop', (e) => {
        e.preventDefault();
        // El movimiento ya se realizó en dragover
    });
}


// =================================================================
// LÓGICA DE FIN DE JUEGO Y RANKING
// =================================================================

/**
 * Termina el juego, muestra la puntuación final y el ranking.
 */
async function endGame() {
    stopTrialTimer();
    stopLocationTracking();

    UIElements.finalTeamName.textContent = gameState.teamName;
    UIElements.finalScore.textContent = gameState.totalScore;
    updateTotalTimeDisplay(); // Asegurar que el tiempo final esté actualizado
    UIElements.finalTime.textContent = UIElements.totalTimerDisplay.textContent;

    showScreen('gameOver');
    UIElements.gameHeader.classList.add('hidden'); // Ocultar el header del juego

    try {
        const { data, error } = await supabase
            .from('teams')
            .select('name, total_score, total_time_seconds')
            .eq('game_id', gameState.gameId)
            .eq('is_completed', true) // Solo equipos que hayan completado el juego
            .order('total_score', { ascending: false })
            .order('total_time_seconds', { ascending: true }); // A menor tiempo, mejor

        if (error) throw error;

        UIElements.finalRankingContainer.innerHTML = '<h3>Ranking de Equipos</h3>';
        if (data.length === 0) {
            UIElements.finalRankingContainer.innerHTML += '<p>No hay otros equipos en el ranking aún.</p>';
        } else {
            const rankingList = document.createElement('div');
            data.forEach((team, index) => {
                const rankingItem = document.createElement('div');
                rankingItem.className = `ranking-item ${team.name === gameState.teamName ? 'current-team' : ''}`;
                rankingItem.innerHTML = `
                    <span>${index + 1}. ${team.name}</span>
                    <span>${team.total_score} pts / ${formatTime(team.total_time_seconds || 0)}</span>
                `;
                rankingList.appendChild(rankingItem);
            });
            UIElements.finalRankingContainer.appendChild(rankingList);
        }
    } catch (error) {
        console.error("Error fetching ranking:", error);
        showAlert('No se pudo cargar el ranking.', 'error');
        UIElements.finalRankingContainer.innerHTML = '<p>No se pudo cargar el ranking.</p>';
    }
}

// =================================================================
// FUNCIONES DE UTILIDAD
// =================================================================

/**
 * Obtiene la prueba actual del estado del juego.
 * @returns {object|null} La prueba actual o null si no hay ninguna.
 */
function getCurrentTrial() {
    if (gameState.currentLocationIndex === -1 || gameState.currentTrialIndex === -1) return null;
    const location = gameState.gameData.locations[gameState.currentLocationIndex];
    if (!location || !location.trials || gameState.currentTrialIndex >= location.trials.length) return null;
    return location.trials[gameState.currentTrialIndex];
}

/**
 * Verifica si una prueba ha sido completada por el equipo.
 * @param {string} trialId - ID de la prueba.
 * @returns {boolean} True si la prueba está en el log de progreso y marcada como correcta.
 */
function isTrialCompleted(trialId) {
    return gameState.progressLog.some(entry => entry.trialId === trialId && entry.isCorrect);
}

/**
 * Verifica si todas las pruebas de una ubicación han sido completadas.
 * @param {string} locationId - ID de la ubicación.
 * @returns {boolean} True si todas las pruebas de la ubicación están completadas.
 */
function isLocationCompleted(locationId) {
    const location = gameState.gameData.locations.find(loc => loc.id === locationId);
    if (!location || !location.trials) return false;
    return location.trials.every(trial => isTrialCompleted(trial.id));
}

/**
 * Actualiza el estado del botón de pista según las pistas disponibles.
 */
function updateHintButtonState() {
    const trial = getCurrentTrial();
    if (!trial) {
        UIElements.hintBtn.classList.add('hidden');
        return;
    }
    const hintsUsedData = gameState.hints_used_per_trial.find(h => h.trialId === trial.id);
    const hintsCount = hintsUsedData ? hintsUsedData.count : 0;

    UIElements.hintBtn.classList.toggle('hidden', trial.hint_count === 0);
    UIElements.hintBtn.disabled = hintsCount >= trial.hint_count;
    UIElements.hintCostDisplay.textContent = `Coste: ${trial.hint_cost || 0} pts`;
}

/**
 * Muestra una alerta temporal.
 * @param {string} message - Mensaje a mostrar.
 * @param {string} type - 'success' o 'error'.
 */
function showAlert(message, type) {
    const alertBox = document.getElementById('app-alert');
    alertBox.textContent = message;
    alertBox.className = ''; // Limpiar clases anteriores
    alertBox.classList.add(type);
    alertBox.classList.remove('hidden');
    setTimeout(() => {
        alertBox.classList.add('hidden');
    }, 3000);
}

/**
 * Elimina acentos de una cadena de texto.
 * @param {string} str - La cadena de entrada.
 * @returns {string} La cadena sin acentos.
 */
function removeAccents(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}