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
    gameDetailNarrative: document.getElementById('game-detail-initial-narrative'),
    gameDetailDescription: document.getElementById('game-detail-description'),
    gameDetailMechanics: document.getElementById('game-detail-mechanics'),
    teamNameInput: document.getElementById('team-name-input'),
    narrativeImage: document.getElementById('narrative-image'),
    narrativeAudio: document.getElementById('narrative-audio'),
    narrativeText: document.getElementById('narrative-text'),
    navLocationName: document.getElementById('nav-location-name'),
    navPreArrivalNarrative: document.getElementById('nav-pre-arrival-narrative'),
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
    buttons.narrativeContinue.addEventListener('click', handleNarrativeContinue);
    UIElements.hintBtn.addEventListener('click', requestHint);
    buttons.closeHint.addEventListener('click', () => UIElements.hintModal.classList.add('hidden'));
    buttons.validateAnswer.addEventListener('click', validateCurrentAnswer);
    buttons.closeQrScanner.addEventListener('click', stopQrScanner);
    buttons.playAgain.addEventListener('click', () => {
        localStorage.removeItem('treasureHuntGameState');
        location.reload();
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
    Object.keys(gameViews).forEach(key => {
        gameViews[key].classList.add('hidden');
    });
    if (gameViews[viewName]) {
        gameViews[viewName].classList.remove('hidden');
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
    UIElements.gameDetailNarrative.textContent = game.initial_narrative;
    UIElements.gameDetailDescription.textContent = game.description;
    UIElements.gameDetailMechanics.textContent = game.mechanics;
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
                pistas_used_per_trial: [],
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
            currentLocationIndex: -1, // Empezamos antes de la primera ubicación
            currentTrialIndex: -1,
            totalScore: 0,
            startTime: startTime.toISOString(),
            progressLog: [],
            isCompleted: false,
        };

        // 4. Guardar estado y continuar
        saveState();
        await syncStateWithSupabase();
        resumeGame();

    } catch (error) {
        console.error("Error starting game:", error);
        showAlert('Error al iniciar la partida. Inténtalo de nuevo.', 'error');
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

    startTotalTimer();
    renderCurrentState();
}

/**
 * Sincroniza el estado local (gameState) con la base de datos.
 */
async function syncStateWithSupabase() {
    if (!gameState.teamId) return;

    const updates = {
        current_location_id: gameState.gameData.locations[gameState.currentLocationIndex]?.id || null,
        current_trial_id: gameState.gameData.locations[gameState.currentLocationIndex]?.trials[gameState.currentTrialIndex]?.id || null,
        total_score: gameState.totalScore,
        progress_log: gameState.progressLog,
        pistas_used_per_trial: gameState.pistas_used_per_trial || [],
        total_time_seconds: Math.floor((new Date() - new Date(gameState.startTime)) / 1000),
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

    // Si aún no hemos empezado la primera ubicación
    if (locIndex === -1) {
        // Mostrar la narrativa inicial del juego
        showNarrativeView(game.initial_narrative, null, null, advanceToNextLocation);
        return;
    }

    const location = game.locations[locIndex];
    const trialIndex = gameState.currentTrialIndex;
    
    // Si hemos llegado a una ubicación pero aún no hemos empezado las pruebas
    if (trialIndex === -1) {
        // Mostrar la narrativa de introducción de la ubicación
        showNarrativeView(location.initial_narrative, location.image_url, location.audio_url, startLocationTrials);
        return;
    }

    const trial = location.trials[trialIndex];

    // Si la prueba actual está marcada como completada, avanzar
    if (isTrialCompleted(trial.id)) {
        advanceToNextTrial();
        return;
    }
    
    // Renderizar la prueba actual
    renderTrial(trial);
}


/**
 * Avanza a la siguiente ubicación.
 */
function advanceToNextLocation() {
    stopLocationTracking();
    gameState.currentLocationIndex++;
    gameState.currentTrialIndex = -1; // Reiniciar índice de pruebas

    if (gameState.currentLocationIndex >= gameState.gameData.locations.length) {
        // Se han completado todas las ubicaciones
        gameState.isCompleted = true;
        renderCurrentState();
        return;
    }
    
    const location = gameState.gameData.locations[gameState.currentLocationIndex];

    // Mostrar el mapa para navegar a la nueva ubicación
    showLocationNavigationView(location);
}

/**
 * Inicia las pruebas de la ubicación actual.
 */
function startLocationTrials() {
    const location = gameState.gameData.locations[gameState.currentLocationIndex];

    if (location.is_selectable_trials) {
        // Mostrar lista de pruebas para que el jugador elija
        showListView('pruebas', location.trials, (trial) => {
            // Encontrar el índice de la prueba seleccionada y empezarla
            gameState.currentTrialIndex = location.trials.findIndex(t => t.id === trial.id);
            renderCurrentState();
        });
    } else {
        // Empezar la primera prueba (o la siguiente)
        advanceToNextTrial();
    }
}

/**
 * Avanza a la siguiente prueba en la ubicación actual.
 */
function advanceToNextTrial() {
    gameState.currentTrialIndex++;
    const location = gameState.gameData.locations[gameState.currentLocationIndex];

    if (gameState.currentTrialIndex >= location.trials.length) {
        // Todas las pruebas de la ubicación completadas
        // Si el juego es seleccionable, volvemos a la lista de ubicaciones
        if (gameState.gameData.adventure_type === 'selectable') {
            // TODO: Implementar lógica para volver a lista de ubicaciones
        } else {
            advanceToNextLocation();
        }
    } else {
        renderCurrentState();
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
    UIElements.narrativeText.textContent = text || "Un momento de calma antes de la siguiente prueba...";
    
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
    UIElements.navLocationName.textContent = `Próximo Destino: ${location.name}`;
    UIElements.navPreArrivalNarrative.textContent = location.pre_arrival_narrative;
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
}

/**
 * Muestra una lista de elementos seleccionables (ubicaciones o pruebas).
 * @param {string} type - 'ubicaciones' o 'pruebas'.
 * @param {Array} items - Los elementos a listar.
 * @param {function} onSelect - Callback a ejecutar con el item seleccionado.
 */
function showListView(type, items, onSelect) {
    UIElements.listTitle.textContent = type === 'ubicaciones' ? 'Elige tu próximo destino' : 'Elige tu próxima prueba';
    UIElements.listItemsContainer.innerHTML = '';

    items.forEach(item => {
        // No mostrar pruebas ya completadas
        if (type === 'pruebas' && isTrialCompleted(item.id)) return;

        const itemDiv = document.createElement('div');
        itemDiv.className = 'list-item'; // Necesitará estilos en CSS
        itemDiv.textContent = item.name || item.narrative.substring(0, 50) + '...';
        itemDiv.onclick = () => onSelect(item);
        UIElements.listItemsContainer.appendChild(itemDiv);
    });

    showGameView('list');
}

/**
 * Renderiza la vista de una prueba específica.
 * @param {object} trial - El objeto de la prueba.
 */
function renderTrial(trial) {
    console.log("Rendering trial:", trial);
    UIElements.trialNarrative.textContent = trial.narrative;
    
    UIElements.trialImage.classList.toggle('hidden', !trial.image_url);
    UIElements.trialImage.src = trial.image_url || '';

    UIElements.trialAudio.src = trial.audio_url || '';
    if (trial.audio_url) UIElements.trialAudio.play().catch(e => console.log("Audio play prevented."));
    
    UIElements.hintCostDisplay.textContent = trial.hint_cost;
    const hintsUsed = getHintsUsedForTrial(trial.id);
    UIElements.hintBtn.disabled = hintsUsed >= trial.hint_count;
    
    renderTrialContent(trial);
    startTrialTimer();
    showGameView('trial');
}

/**
 * Renderiza el contenido específico del tipo de prueba (QR, GPS, Texto).
 * @param {object} trial - El objeto de la prueba.
 */
function renderTrialContent(trial) {
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
            UIElements.trialContent.innerHTML = `<p>Dirígete a las coordenadas indicadas. La prueba se validará automáticamente cuando estés en la zona.</p><div id="trial-gps-map" class="map-container"></div>`;
            initMap('trial-gps-map');
            const targetCoords = [trial.latitude, trial.longitude];
            L.marker(targetCoords).addTo(map).bindPopup("Punto de la prueba");
            L.circle(targetCoords, { radius: trial.tolerance_meters }).addTo(map);
            startLocationTracking(trial, true); // true para modo de validación de prueba
            UIElements.validateAnswer.classList.add('hidden');
            break;

        case 'text':
            renderTextTrial(trial);
            break;
    }
}

/**
 * Renderiza los campos para una prueba de tipo Texto.
 * @param {object} trial - El objeto de la prueba de texto.
 */
function renderTextTrial(trial) {
    const question = document.createElement('p');
    question.textContent = trial.question;
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
                optionDiv.textContent = option;
                optionDiv.dataset.value = option;
                optionDiv.onclick = () => {
                    // Deseleccionar otros y seleccionar este
                    document.querySelectorAll('.text-option').forEach(el => el.classList.remove('selected'));
                    optionDiv.classList.add('selected');
                };
                optionsContainer.appendChild(optionDiv);
            });
            UIElements.trialContent.appendChild(optionsContainer);
            break;

        case 'ordering':
            // Lógica de ordenación (Drag and Drop simple)
            alert('Prueba de ordenación pendiente de implementación.');
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

    // Obtener respuesta del usuario según el tipo de prueba
    if (trial.trial_type === 'text') {
        switch (trial.answer_type) {
            case 'single_choice':
            case 'numeric':
                userAnswer = document.getElementById('text-answer-input').value.trim();
                // Comparación insensible a mayúsculas/minúsculas
                isCorrect = userAnswer.toLowerCase() === trial.correct_answer.toLowerCase();
                break;
            case 'multiple_options':
                const selectedOption = document.querySelector('.text-option.selected');
                userAnswer = selectedOption ? selectedOption.dataset.value : '';
                isCorrect = userAnswer === trial.correct_answer;
                break;
        }
    }
    // La validación de QR y GPS se maneja en sus propias funciones
    
    processAnswer(isCorrect);
}

/**
 * Procesa el resultado de una validación.
 * @param {boolean} isCorrect - Si la respuesta fue correcta.
 */
function processAnswer(isCorrect) {
    stopTrialTimer();
    const trial = getCurrentTrial();
    const timeTaken = Math.floor((new Date() - new Date(lastTrialStartTime)) / 1000);
    const hintsUsed = getHintsUsedForTrial(trial.id);
    
    if (isCorrect) {
        // Calcular puntos
        const baseScore = gameState.gameData.initial_score_per_trial;
        const timePenalty = timeTaken; // 1 punto por segundo
        const hintPenalty = hintsUsed * trial.hint_cost;
        const trialScore = Math.max(0, baseScore - timePenalty - hintPenalty);

        gameState.totalScore += trialScore;
        UIElements.scoreDisplay.textContent = gameState.totalScore;
        
        // Registrar en el log
        gameState.progressLog.push({
            trialId: trial.id,
            completedAt: new Date().toISOString(),
            timeTaken: timeTaken,
            score: trialScore,
            hintsUsed: hintsUsed
        });
        
        showAlert('¡Correcto!', 'success');
        syncStateWithSupabase();
        
        // Transición a la siguiente prueba
        setTimeout(advanceToNextTrial, 1500);

    } else {
        showAlert('Respuesta incorrecta. ¡Inténtalo de nuevo!', 'error');
        // El jugador puede volver a intentarlo, el tiempo sigue corriendo
        startTrialTimer(); 
    }
}

/**
 * Solicita una pista para la prueba actual.
 */
function requestHint() {
    const trial = getCurrentTrial();
    if (!trial) return;

    let hintsUsedData = gameState.pistas_used_per_trial?.find(p => p.trialId === trial.id);
    if (!hintsUsedData) {
        hintsUsedData = { trialId: trial.id, count: 0 };
        if (!gameState.pistas_used_per_trial) gameState.pistas_used_per_trial = [];
        gameState.pistas_used_per_trial.push(hintsUsedData);
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
    
    UIElements.hintText.textContent = hintText;
    UIElements.hintModal.classList.remove('hidden');

    // Aplicar penalización y actualizar estado
    gameState.totalScore = Math.max(0, gameState.totalScore - trial.hint_cost);
    UIElements.scoreDisplay.textContent = gameState.totalScore;
    hintsUsedData.count++;

    UIElements.hintBtn.disabled = hintsUsedData.count >= trial.hint_count;
    
    saveState();
    syncStateWithSupabase();
}


// =================================================================
// FUNCIONES DE TEMPORIZADOR
// =================================================================

function startTotalTimer() {
    if (totalTimerInterval) clearInterval(totalTimerInterval);
    const startTime = new Date(gameState.startTime);
    totalTimerInterval = setInterval(() => {
        const elapsed = Math.floor((new Date() - startTime) / 1000);
        const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const seconds = String(elapsed % 60).padStart(2, '0');
        UIElements.totalTimerDisplay.textContent = `${minutes}:${seconds}`;
    }, 1000);
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
}


// =================================================================
// FUNCIONES DE GEOLOCALIZACIÓN Y MAPA (Leaflet)
// =================================================================

/**
 * Inicializa un mapa Leaflet en el contenedor especificado.
 * @param {string} containerId - El ID del div contenedor del mapa.
 */
function initMap(containerId) {
    if (map) {
        map.remove();
        map = null;
    }
    map = L.map(containerId).setView([43.535, -5.661], 13); // Default Gijón
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
}

/**
 * Inicia el seguimiento de la ubicación del jugador.
 * @param {object} target - El objeto (ubicación o prueba GPS) a rastrear.
 * @param {boolean} isTrialValidation - Si estamos validando una prueba GPS.
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
            
            if (!playerMarker) {
                playerMarker = L.marker(playerLatLng).addTo(map).bindPopup("¡Estás aquí!");
            } else {
                playerMarker.setLatLng(playerLatLng);
            }
            map.setView(playerLatLng, map.getZoom());

            const distance = playerLatLng.distanceTo(targetLatLng);
            
            if (isTrialValidation) {
                // Lógica para validar prueba GPS
                if (distance <= target.tolerance_meters) {
                    processAnswer(true);
                    stopLocationTracking();
                }
            } else {
                // Lógica para navegar a una ubicación
                UIElements.distanceInfo.textContent = `Distancia al objetivo: ${distance.toFixed(0)} metros`;
                if (distance <= target.tolerance_meters) {
                    showAlert('¡Has llegado a la ubicación!', 'success');
                    stopLocationTracking();
                    renderCurrentState(); // La ubicación se alcanzó, renderizar el siguiente estado (narrativa de ubicación)
                }
            }
        },
        (error) => {
            console.error("Geolocation error:", error);
            UIElements.distanceInfo.textContent = 'No se puede obtener tu ubicación.';
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

function stopLocationTracking() {
    if (watchPositionId) {
        navigator.geolocation.clearWatch(watchPositionId);
        watchPositionId = null;
    }
}


// =================================================================
// FUNCIONES DE ESCÁNER QR
// =================================================================

function startQrScanner() {
    UIElements.qrScannerModal.classList.remove('hidden');
    
    if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("qr-reader");
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
            // Ignorar errores de "no se encontró QR"
        })
    .catch((err) => {
        console.error("Error al iniciar el escáner QR:", err);
        showAlert('No se pudo iniciar la cámara.', 'error');
        stopQrScanner();
    });
}

function stopQrScanner() {
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(err => console.error("Error al detener el escáner:", err));
    }
    UIElements.qrScannerModal.classList.add('hidden');
}


// =================================================================
// FIN DEL JUEGO
// =================================================================

async function endGame() {
    stopTotalTimer();
    stopLocationTracking();

    const finalTimeSeconds = Math.floor((new Date() - new Date(gameState.startTime)) / 1000);
    gameState.totalTimeSeconds = finalTimeSeconds;
    
    // Sincronización final
    await syncStateWithSupabase();
    
    // Mostrar pantalla de fin de juego
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
        data.forEach(team => {
            const item = document.createElement('div');
            item.className = 'ranking-item';
            if (team.name === gameState.teamName) {
                item.classList.add('current-team');
            }
            const minutes = String(Math.floor(team.total_time_seconds / 60)).padStart(2, '0');
            const seconds = String(team.total_time_seconds % 60).padStart(2, '0');
            item.innerHTML = `<span>${team.name}</span><span>${team.total_score} pts (${minutes}:${seconds})</span>`;
            UIElements.finalRankingContainer.appendChild(item);
        });

    } catch (error) {
        console.error("Error loading final ranking:", error);
        UIElements.finalRankingContainer.innerHTML = '<p>No se pudo cargar el ranking.</p>';
    }
}


// =================================================================
// FUNCIONES DE UTILIDAD
// =================================================================

function getCurrentTrial() {
    if (gameState.currentLocationIndex === -1 || gameState.currentTrialIndex === -1) return null;
    return gameState.gameData.locations[gameState.currentLocationIndex].trials[gameState.currentTrialIndex];
}

function isTrialCompleted(trialId) {
    return gameState.progressLog.some(log => log.trialId === trialId);
}

function getHintsUsedForTrial(trialId) {
    const hintData = gameState.pistas_used_per_trial?.find(p => p.trialId === trialId);
    return hintData ? hintData.count : 0;
}