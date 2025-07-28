// player-script.js

// Supabase ya está inicializado en player-supabase-config.js
// Asegúrate de que player-supabase-config.js se carga ANTES de este script
// y que la variable 'supabase' está correctamente definida y accesible globalmente.

// --- Global State Variables ---
let currentTeam = null;
let currentGame = null;
let currentLocations = [];
let currentLocationIndex = -1; // -1 when no location is active (e.g., in selectable game at selection screen)
let currentTrials = [];
let currentTrialIndex = 0;
let gameStartTime = null; // Timestamp when the game officially started (or resumed)
let globalGameTimerInterval = null;
let trialTimerInterval = null;
let currentTrialDuration = 0; // Duration for the current trial in seconds

let playerMap = null; // Leaflet map instance for GPS TRIALS
let playerMarker = null; // Player's marker on the map for GPS TRIALS
let targetMarker = null; // Target trial marker on the map for GPS TRIALS
let gpsWatchId = null; // ID for navigator.geolocation.watchPosition for GPS TRIALS

// New: Map for LOCATION ARRIVAL (EXISTING, but ensure correct ID)
let locationArrivalMap = null; // Leaflet map instance for LOCATION ARRIVAL
let locationPlayerMarker = null; // Player's marker on the location arrival map
let locationTargetMarker = null; // Target location marker on the location arrival map
let locationGpsWatchId = null; // ID for navigator.geolocation.watchPosition for LOCATION ARRIVAL

let qrScanner = null; // html5-qrcode instance
let qrScanning = false; // Flag to prevent multiple scanner instances

// --- DOM Elements ---
const loadingScreen = document.getElementById('loading-screen');
const welcomeScreen = document.getElementById('welcome-screen');
const startNewGameFlowBtn = document.getElementById('start-new-game-flow-btn');
const gameSelectionScreen = document.getElementById('game-selection-screen');
const gameList = document.getElementById('game-list');

const gameDetailsScreen = document.getElementById('game-details-screen');
const gameDetailTitle = document.getElementById('game-detail-title');
const gameDetailDescription = document.getElementById('game-detail-description'); // CORRECTED LINE
const gameDetailMechanics = document.getElementById('game-detail-mechanics');
const gameDetailInitialNarrative = document.getElementById('game-detail-initial-narrative');
const gameDetailMedia = document.getElementById('game-detail-media'); // Container for image/audio
const teamNameInput = document.getElementById('team-name-input');
const startGameBtn = document.getElementById('start-game-btn');
const backToGameSelectionBtn = document.getElementById('back-to-game-selection-btn');

// New: Location Selection Screen Elements
const locationSelectionScreen = document.getElementById('location-selection-screen');
const gameSelectionInitialNarrative = document.getElementById('game-selection-initial-narrative');
const locationListContainer = document.getElementById('location-list-container');
const backToGameDetailsFromLocationSelectBtn = document.getElementById('back-to-game-details-from-location-select-btn');

const gameActiveScreen = document.getElementById('game-active-screen');
const gameTotalTimeDisplay = document.getElementById('game-total-time');
const trialTimerDisplay = document.getElementById('trial-timer');
const currentScoreDisplay = document.getElementById('current-score');
const locationNarrativeSection = document.getElementById('location-narrative-section');
const locationNarrativeDisplay = document.getElementById('location-narrative');
const locationMedia = document.getElementById('location-media'); // Container for location image/audio

// New: Elements for Location Arrival GPS (existing, but double check IDs)
const locationArrivalMapContainer = document.getElementById('location-arrival-map');
const locationArrivalMessage = document.getElementById('location-arrival-message');
const startLocationTrialsBtn = document.getElementById('start-location-trials-btn'); // Moved here for global access


const trialScreen = document.getElementById('trial-screen');
const trialQuestionDisplay = document.getElementById('trial-question');
const qrReaderContainer = document.getElementById('qr-reader-container');
const qrReaderVideo = document.getElementById('qr-reader');
const qrReaderBtn = document.getElementById('qr-reader-btn');
const qrCodeValueDisplay = document.getElementById('qr-code-value');
const qrSubmitBtn = document.getElementById('qr-submit-btn');
const answerInput = document.getElementById('answer-input');
const submitAnswerBtn = document.getElementById('submit-answer-btn');
const hintBtn = document.getElementById('hint-btn');
const trialMedia = document.getElementById('trial-media'); // Container for image/audio/video in trials

const feedbackScreen = document.getElementById('feedback-screen');
const feedbackMessageDisplay = document.getElementById('feedback-message');
const feedbackDetailsDisplay = document.getElementById('feedback-details');
const feedbackScoreChange = document.getElementById('feedback-score-change');
const continueGameBtn = document.getElementById('continue-game-btn');

const finalScreen = document.getElementById('final-screen');
const finalScoreDisplay = document.getElementById('final-score');
const finalTimeDisplay = document.getElementById('final-time');
const finalRankingList = document.getElementById('final-ranking-list');
const startNewGameAgainBtn = document.getElementById('start-new-game-again-btn');

const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalCloseBtn = document.getElementById('modal-close-btn');

const gameProgressDisplay = document.getElementById('game-progress-display');
const globalAlert = document.getElementById('global-alert');
const alertMessage = document.getElementById('alert-message');
const closeAlertBtn = document.getElementById('close-alert-btn');

// --- Main Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    showScreen(loadingScreen);

    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', hideModal);
    }
    if (closeAlertBtn) {
        closeAlertBtn.addEventListener('click', hideAlert);
    }

    startNewGameFlowBtn.addEventListener('click', () => {
        teamNameInput.value = ''; // Clear previous team name
        fetchActiveGames();
    });

    backToGameSelectionBtn.addEventListener('click', () => {
        showScreen(gameSelectionScreen);
    });

    startGameBtn.addEventListener('click', createAndStartGame);

    submitAnswerBtn.addEventListener('click', submitAnswer);
    hintBtn.addEventListener('click', requestHint);

    qrReaderBtn.addEventListener('click', toggleQrScanner);
    qrSubmitBtn.addEventListener('click', () => {
        const qrValue = qrCodeValueDisplay.textContent;
        if (qrValue) {
            submitAnswer(qrValue); // Use the QR value as the answer
            stopQrScanner();
        } else {
            showAlert('No se ha escaneado ningún código QR.', 'warning');
        }
    });

    continueGameBtn.addEventListener('click', continueFromFeedback);
    startNewGameAgainBtn.addEventListener('click', () => {
        localStorage.removeItem('currentTeamId'); // Clear saved game state
        location.reload(); // Reload the page to start fresh
    });

    // Event listener for the "Comenzar Pruebas" button for location arrival (EXISTING)
    if (startLocationTrialsBtn) {
        startLocationTrialsBtn.addEventListener('click', async () => {
            // Stop GPS tracking for location arrival
            if (locationGpsWatchId) {
                navigator.geolocation.clearWatch(locationGpsWatchId);
                locationGpsWatchId = null;
            }
            locationArrivalMapContainer.innerHTML = ''; // Clear map

            if (currentTrials.length === 0) {
                // Fetch trials if not already fetched (e.g., first time entering location)
                const { data: trials, error: trialError } = await supabase
                    .from('trials')
                    .select('*')
                    .eq('location_id', currentLocations[currentLocationIndex].id)
                    .order('order_index', { ascending: true }); // Usando 'order_index' para trials

                if (trialError) {
                    console.error('Error fetching trials for location:', trialError);
                    showModal('Error', 'Error al cargar las pruebas de esta ubicación. ' + trialError.message);
                    return;
                }
                currentTrials = trials;

                if (currentTrials.length === 0) {
                    showModal('Sin Pruebas', 'Esta ubicación no tiene pruebas configuradas. Contacta al administrador.');
                    return;
                }
            }
            currentTrialIndex = 0; // Reset trial index for new location
            await displayCurrentTrial();
        });
    }

    // New: Back button from location selection
    if (backToGameDetailsFromLocationSelectBtn) {
        backToGameDetailsFromLocationSelectBtn.addEventListener('click', () => {
            showScreen(gameDetailsScreen);
        });
    }

    // Service Worker registration
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('./service-worker.js'); // Adjusted path for GitHub Pages
            console.log('Service Worker registered with scope:', registration.scope);
        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    }

    const storedTeamId = localStorage.getItem('currentTeamId');
    if (storedTeamId) {
        const teamLoaded = await loadTeamState(storedTeamId);
        if (teamLoaded && currentTeam) {
            showScreen(gameActiveScreen);
            resumeGameTimers();
            // If already in a trial, display it. Otherwise, display location narrative or check arrival.
            if (currentTeam.current_trial_id) {
                await displayCurrentTrial();
            } else if (currentTeam.current_location_id) {
                const currentLoc = currentLocations.find(loc => loc.id === currentTeam.current_location_id);
                if (currentLoc) {
                    // Check if location has GPS coordinates and if arrival is pending
                    if (currentLoc.latitude && currentLoc.longitude && !currentTeam.progress_log.some(log => log.location_id === currentLoc.id && log.event === 'location_arrived')) {
                        await checkLocationArrival(currentLoc); // Check arrival again if resuming at a location with GPS
                    } else {
                        // If already arrived or no GPS, just display narrative
                        await displayLocationNarrative(currentLoc);
                    }
                } else {
                    // Fallback if current_location_id is set but the location itself is not found in the fetched list
                    showAlert('No se pudo encontrar la ubicación actual. Reiniciando el flujo.', 'warning');
                    await initializeGameFlowForTeam(); // Re-initialize game flow
                }
            }
            showAlert('Reanudando juego como equipo: ' + currentTeam.name, 'info'); // Usando 'name' para el equipo
            return;
        } else {
            localStorage.removeItem('currentTeamId');
            showAlert('Tu sesión de juego anterior no pudo ser recuperada. Por favor, selecciona un juego de nuevo.', 'warning');
        }
    }

    showScreen(welcomeScreen);
});

// --- Screen Management ---
function showScreen(screenElement) {
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => screen.classList.add('hidden'));
    screenElement.classList.remove('hidden');
}

function showModal(title, message) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modal.classList.remove('hidden');
}

function hideModal() {
    modal.classList.add('hidden');
}

function showAlert(message, type = 'info', duration = 5000) {
    alertMessage.textContent = message;
    globalAlert.className = `global-alert ${type}`; // Add type class for styling (e.g., 'info', 'warning', 'error', 'success')
    globalAlert.classList.remove('hidden');

    setTimeout(() => {
        hideAlert();
    }, duration);
}

function hideAlert() {
    globalAlert.classList.add('hidden');
}

// --- Game Selection ---
async function fetchActiveGames() {
    showScreen(loadingScreen);
    const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching games:', error);
        showModal('Error', 'No se pudieron cargar los juegos disponibles. ' + error.message);
        showScreen(welcomeScreen); // Go back to welcome screen on error
        return;
    }

    gameList.innerHTML = '';
    if (data.length === 0) {
        gameList.innerHTML = '<p>No hay juegos activos disponibles en este momento. Inténtalo más tarde.</p>';
        showScreen(gameSelectionScreen);
        return;
    }

    data.forEach(game => {
        const gameCard = document.createElement('div');
        gameCard.className = 'game-card';
        gameCard.innerHTML = `
            <h3>${game.name}</h3>
            <p>${game.description}</p>
            <button class="btn btn-secondary select-game-btn" data-game-id="${game.id}">Seleccionar</button>
        `;
        gameList.appendChild(gameCard);
    });

    document.querySelectorAll('.select-game-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const gameId = e.target.dataset.gameId;
            const selectedGame = data.find(g => g.id === gameId);
            displayGameDetails(selectedGame);
        });
    });

    showScreen(gameSelectionScreen);
}

function displayGameDetails(game) {
    currentGame = game;
    gameDetailTitle.textContent = game.name;
    gameDetailDescription.textContent = game.description;
    gameDetailMechanics.textContent = game.mechanics || 'No hay mecánicas adicionales especificadas.';
    gameDetailInitialNarrative.textContent = game.initial_narrative || 'Comienza una emocionante aventura.';

    // Display game media (image/audio)
    gameDetailMedia.innerHTML = '';
    if (game.image_url) {
        const img = document.createElement('img');
        img.src = game.image_url;
        img.alt = 'Imagen del juego';
        img.className = 'narrative-image';
        gameDetailMedia.appendChild(img);
    }
    if (game.audio_url) {
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.src = game.audio_url;
        gameDetailMedia.appendChild(audio);
    }

    showScreen(gameDetailsScreen);
}

async function createAndStartGame() {
    const teamName = teamNameInput.value.trim();
    if (!teamName) {
        showAlert('Por favor, introduce un nombre para tu equipo.', 'warning');
        return;
    }

    if (!currentGame) {
        showAlert('Error: No se ha seleccionado ningún juego.', 'error');
        return;
    }

    // Create a new team entry
    const { data, error } = await supabase
        .from('teams')
        .insert({
            name: teamName,
            game_id: currentGame.id,
            start_time: new Date().toISOString(),
            last_activity: new Date().toISOString(),
            status: 'active',
            total_score: 0,
            total_time_seconds: 0,
            hints_used_global: 0,
            hints_used_per_trial: [],
            progress_log: []
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating team:', error);
        showModal('Error', 'No se pudo crear el equipo. ' + error.message);
        return;
    }

    currentTeam = data;
    await initializeGameFlowForTeam();
}

async function initializeGameFlowForTeam() {
    if (!currentTeam || !currentGame) {
        showAlert('Error interno: Información del equipo o juego incompleta.', 'error');
        return;
    }

    localStorage.setItem('currentTeamId', currentTeam.id); // Persist team ID

    // Fetch locations for the current game, using 'order_index'
    const { data: locationsData, error: locError } = await supabase
        .from('locations')
        .select('*')
        .eq('game_id', currentGame.id)
        .order('order_index', { ascending: true }); // Usando 'order_index' para locations

    if (locError) {
        console.error('Error fetching locations:', locError);
        showModal('Error', 'Error al cargar las ubicaciones del juego. ' + locError.message);
        return;
    }
    currentLocations = locationsData;

    if (currentLocations.length === 0) {
        showModal('Juego Vacío', 'Este juego no tiene ubicaciones configuradas. Contacta al administrador.');
        return;
    }

    // Determine initial flow based on adventure_type
    const adventureType = currentGame.adventure_type || 'linear'; // Default to 'linear' if not specified

    // Reset general game state for a new session
    currentTeam.total_time_seconds = 0;
    currentTeam.total_score = 0;
    currentTeam.hints_used_global = 0;
    currentTeam.hints_used_per_trial = [];
    currentTeam.progress_log = [];

    // Reset timers
    gameStartTime = new Date().getTime(); // Initialize global game start time
    startGlobalTimer(); // Start the main game timer
    currentScoreDisplay.textContent = currentTeam.total_score; // Update score display

    let initialLocationId = null;

    if (adventureType === 'linear') {
        currentLocationIndex = 0; // Start at the first location
        initialLocationId = currentLocations[0].id;
        showScreen(gameActiveScreen); // Go directly to active game screen
        await displayLocationNarrative(currentLocations[0]); // Display first location narrative
    } else if (adventureType === 'selectable') {
        currentLocationIndex = -1; // Indicate no specific location is active yet
        initialLocationId = null; // No initial location set yet, user will choose
        await displayLocationSelectionScreen(); // Show location selection screen
    } else {
        // Fallback for unknown adventure type
        showAlert(`Tipo de aventura desconocido: ${adventureType}. Asumiendo lineal.`, 'warning');
        currentLocationIndex = 0;
        initialLocationId = currentLocations[0].id;
        showScreen(gameActiveScreen);
        await displayLocationNarrative(currentLocations[0]);
    }

    // Update initial team state in DB
    const { error: updateTeamError } = await supabase
        .from('teams')
        .update({
            current_location_id: initialLocationId, // Will be null for selectable initially
            current_trial_id: null,
            last_activity: new Date().toISOString(),
            start_time: new Date().toISOString(),
            total_time_seconds: currentTeam.total_time_seconds,
            total_score: currentTeam.total_score,
            hints_used_global: currentTeam.hints_used_global,
            hints_used_per_trial: currentTeam.hints_used_per_trial,
            progress_log: currentTeam.progress_log,
        })
        .eq('id', currentTeam.id);

    if (updateTeamError) {
        console.error('Error al preparar el equipo para el juego:', updateTeamError);
        showAlert('Error al preparar el equipo para el juego.', 'error');
        return;
    }
    // Update local currentTeam object to reflect the changes
    currentTeam.current_location_id = initialLocationId;
    currentTeam.current_trial_id = null;
    currentTeam.start_time = new Date().toISOString(); // Re-set start time for fresh game
}


async function loadTeamState(teamId) {
    const { data, error } = await supabase
        .from('teams')
        .select(`
            *,
            games(*)
        `)
        .eq('id', teamId)
        .single();

    if (error) {
        console.error('Error al cargar estado del equipo:', error);
        showAlert('Error al cargar estado del equipo: ' + error.message, 'error');
        return false;
    }

    if (data) {
        currentTeam = data;
        currentGame = data.games;

        // Fetch all locations for the current game, using 'order_index'
        const { data: locations, error: locError } = await supabase
            .from('locations')
            .select('*')
            .eq('game_id', currentGame.id)
            .order('order_index', { ascending: true }); // Usando 'order_index' para locations
        if (locError) {
            console.error('Error al cargar ubicaciones para juego reanudado:', locError);
            showAlert('Error al cargar ubicaciones para juego reanudada.', 'error');
            return false;
        }
        currentLocations = locations;

        // Determine current location index based on adventure_type
        const adventureType = currentGame.adventure_type || 'linear';

        if (adventureType === 'linear') {
            currentLocationIndex = currentLocations.findIndex(loc => loc.id === currentTeam.current_location_id);
            if (currentLocationIndex === -1 && currentLocations.length > 0) currentLocationIndex = 0;
            else if (currentLocationIndex === -1) { // No current location or no locations in game
                console.warn("No se encontró la ubicación actual o no existen ubicaciones para el juego lineal. Comenzando desde el principio.");
                currentLocationIndex = 0;
            }
        } else { // 'selectable' or other
            // For selectable, just find the current location by ID, index is less critical for flow
            currentLocationIndex = currentLocations.findIndex(loc => loc.id === currentTeam.current_location_id);
            if (currentLocationIndex === -1 && currentLocations.length > 0) {
                // If no specific location was set, it means they are at selection screen or just started
                console.warn("No se encontró la ubicación actual para el juego 'seleccionable'. El usuario podría necesitar seleccionar una.");
                // If the game is selectable and no location is set, the index can remain -1,
                // and the main init logic will display the selection screen.
                // If there are no locations in a selectable game, it's an issue.
                if (currentLocations.length === 0) {
                    showModal('Juego Vacío', 'Este juego no tiene ubicaciones configuradas. Contacta al administrador.');
                    return false;
                }
            } else if (currentLocationIndex === -1) { // No locations at all
                console.warn("No se encontraron ubicaciones para el juego.");
                return false;
            }
        }

        // Fetch trials for the current location if one is set
        if (currentTeam.current_location_id) {
            const { data: trials, error: trialError } = await supabase
                .from('trials')
                .select('*')
                .eq('location_id', currentTeam.current_location_id)
                .order('order_index', { ascending: true }); // Usando 'order_index' para trials
            if (trialError) {
                console.error('Error al cargar pruebas para ubicación reanudada:', trialError);
                showAlert('Error al cargar pruebas para ubicación reanudada.', 'error');
                return false;
            }
            currentTrials = trials;

            // Determine current trial index
            currentTrialIndex = currentTrials.findIndex(trial => trial.id === currentTeam.current_trial_id);
            if (currentTrialIndex === -1 && currentTrials.length > 0) {
                // If trial ID is null or not found, it means we might be at a location narrative or first trial
                currentTrialIndex = 0;
            } else if (currentTrialIndex === -1) { // No trials in location
                console.warn("No se encontró la prueba actual o no existen pruebas en la ubicación.");
                currentTrialIndex = 0;
            }
        } else {
            currentTrials = []; // No current location, so no trials loaded
            currentTrialIndex = 0;
        }

        gameStartTime = new Date(currentTeam.start_time).getTime();
        currentScoreDisplay.textContent = currentTeam.total_score;

        return true;
    }
    return false;
}

// --- Game Flow and Navigation ---

async function displayLocationNarrative(location) {
    if (!location) {
        console.error('No location provided for displayLocationNarrative.');
        showAlert('Error: No se pudo cargar la narrativa de la ubicación.', 'error');
        return;
    }

    showScreen(gameActiveScreen); // Ensure we are on the active game screen

    gameProgressDisplay.textContent = `Ubicación: ${location.name}`;
    locationNarrativeDisplay.textContent = location.narrative;

    // Display location media (image/audio/video)
    locationMedia.innerHTML = '';
    if (location.image_url) {
        const img = document.createElement('img');
        img.src = location.image_url;
        img.alt = `Imagen de ${location.name}`;
        img.className = 'narrative-image';
        locationMedia.appendChild(img);
    }
    if (location.audio_url) {
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.src = location.audio_url;
        locationMedia.appendChild(audio);
    }
    if (location.video_url) {
        const video = document.createElement('video');
        video.controls = true;
        video.src = location.video_url;
        video.className = 'narrative-video';
        locationMedia.appendChild(video);
    }

    // Hide trial elements
    trialScreen.classList.add('hidden');
    feedbackScreen.classList.add('hidden');
    locationNarrativeSection.classList.remove('hidden');

    // Check if location has GPS coordinates
    if (location.latitude && location.longitude) {
        await checkLocationArrival(location);
    } else {
        // If no GPS, automatically allow starting trials
        locationArrivalMapContainer.classList.add('hidden');
        locationArrivalMessage.textContent = '¡Has llegado a tu destino!';
        startLocationTrialsBtn.classList.remove('hidden');
    }

    // Update team's current_location_id if not already set or changed
    if (currentTeam.current_location_id !== location.id) {
        const { error: updateError } = await supabase
            .from('teams')
            .update({
                current_location_id: location.id,
                current_trial_id: null,
                last_activity: new Date().toISOString(),
                progress_log: [...currentTeam.progress_log, {
                    timestamp: new Date().toISOString(),
                    event: 'location_narrative_displayed',
                    location_id: location.id,
                    location_name: location.name
                }]
            })
            .eq('id', currentTeam.id);

        if (updateError) {
            console.error('Error updating current location for team:', updateError);
            showAlert('Error al actualizar la ubicación actual del equipo.', 'error');
        } else {
            currentTeam.current_location_id = location.id; // Update local state
            currentTeam.current_trial_id = null;
            currentTeam.progress_log.push({
                timestamp: new Date().toISOString(),
                event: 'location_narrative_displayed',
                location_id: location.id,
                location_name: location.name
            });
        }
    }
}


async function displayCurrentTrial() {
    if (currentTrialIndex >= currentTrials.length) {
        console.log('Todas las pruebas de la ubicación completadas.');
        return await completeLocation();
    }

    const trial = currentTrials[currentTrialIndex];
    if (!trial) {
        console.error('Trial not found at index:', currentTrialIndex);
        showModal('Error', 'No se pudo cargar la prueba actual. Por favor, contacta al administrador.');
        return;
    }

    // Reset trial UI
    answerInput.value = '';
    answerInput.classList.remove('hidden');
    submitAnswerBtn.classList.remove('hidden');
    qrReaderContainer.classList.add('hidden');
    qrCodeValueDisplay.textContent = '';
    qrSubmitBtn.classList.add('hidden');
    qrReaderVideo.srcObject = null; // Clear video stream
    stopQrScanner(); // Ensure scanner is stopped
    hintBtn.classList.remove('hidden'); // Show hint button by default

    // Hide location narrative elements
    locationNarrativeSection.classList.add('hidden');
    // Hide arrival map/message if they were visible
    locationArrivalMapContainer.classList.add('hidden');
    locationArrivalMessage.textContent = '';
    startLocationTrialsBtn.classList.add('hidden');


    showScreen(trialScreen);
    gameProgressDisplay.textContent = `Ubicación: ${currentLocations[currentLocationIndex].name} - Prueba ${currentTrialIndex + 1}/${currentTrials.length}`;
    trialQuestionDisplay.innerHTML = trial.question_text;

    // Display trial media (image/audio/video)
    trialMedia.innerHTML = '';
    if (trial.image_url) {
        const img = document.createElement('img');
        img.src = trial.image_url;
        img.alt = 'Imagen de la prueba';
        img.className = 'narrative-image';
        trialMedia.appendChild(img);
    }
    if (trial.audio_url) {
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.src = trial.audio_url;
        trialMedia.appendChild(audio);
    }
    if (trial.video_url) {
        const video = document.createElement('video');
        video.controls = true;
        video.src = trial.video_url;
        video.className = 'narrative-video';
        trialMedia.appendChild(video);
    }

    // Adjust UI based on trial type
    if (trial.type === 'qr_scan') {
        answerInput.classList.add('hidden');
        submitAnswerBtn.classList.add('hidden');
        qrReaderContainer.classList.remove('hidden');
        qrSubmitBtn.classList.remove('hidden');
        qrReaderBtn.classList.remove('hidden'); // Ensure QR scan button is visible
        qrCodeValueDisplay.textContent = 'Escaneando QR...'; // Initial message
    } else {
        qrReaderContainer.classList.add('hidden');
        qrReaderBtn.classList.add('hidden');
        qrSubmitBtn.classList.add('hidden');
    }

    // Manage trial timer
    clearInterval(trialTimerInterval); // Clear any previous trial timer
    currentTrialDuration = trial.time_limit_seconds || 0; // Set duration from DB
    if (currentTrialDuration > 0) {
        trialTimerDisplay.classList.remove('hidden');
        startTrialTimer();
    } else {
        trialTimerDisplay.classList.add('hidden');
    }

    // Update current trial ID in DB
    const { error: updateError } = await supabase
        .from('teams')
        .update({
            current_trial_id: trial.id,
            last_activity: new Date().toISOString(),
            progress_log: [...currentTeam.progress_log, {
                timestamp: new Date().toISOString(),
                event: 'trial_displayed',
                location_id: currentTeam.current_location_id,
                location_name: currentLocations[currentLocationIndex].name,
                trial_id: trial.id,
                trial_question: trial.question_text
            }]
        })
        .eq('id', currentTeam.id);

    if (updateError) {
        console.error('Error updating current trial for team:', updateError);
        showAlert('Error al actualizar la prueba actual del equipo.', 'error');
    } else {
        currentTeam.current_trial_id = trial.id; // Update local state
        currentTeam.progress_log.push({
            timestamp: new Date().toISOString(),
            event: 'trial_displayed',
            location_id: currentTeam.current_location_id,
            location_name: currentLocations[currentLocationIndex].name,
            trial_id: trial.id,
            trial_question: trial.question_text
        });
    }
}

async function submitAnswer(qrAnswer = null) {
    const trial = currentTrials[currentTrialIndex];
    if (!trial) {
        showAlert('Error: No hay prueba activa para responder.', 'error');
        return;
    }

    const playerAnswer = qrAnswer || answerInput.value.trim();
    if (!playerAnswer) {
        showAlert('Por favor, ingresa tu respuesta.', 'warning');
        return;
    }

    const isCorrect = playerAnswer.toLowerCase() === trial.correct_answer.toLowerCase();
    let scoreChange = 0;
    let message = '';
    let details = '';

    if (isCorrect) {
        scoreChange = trial.points;
        message = '¡Respuesta Correcta!';
        details = 'Has ganado ' + trial.points + ' puntos.';
    } else {
        scoreChange = -trial.penalty_points;
        message = 'Respuesta Incorrecta.';
        details = 'Has perdido ' + trial.penalty_points + ' puntos.';
    }

    // Deduct points for hints used in this trial
    const hintsUsedInTrial = (currentTeam.hints_used_per_trial || []).filter(h => h.trial_id === trial.id).length;
    if (hintsUsedInTrial > 0) {
        scoreChange -= (hintsUsedInTrial * trial.hint_penalty_points);
        details += ` Se deducen ${hintsUsedInTrial * trial.hint_penalty_points} puntos por ${hintsUsedInTrial} pista(s) utilizada(s).`;
    }

    currentTeam.total_score = Math.max(0, currentTeam.total_score + scoreChange); // Ensure score doesn't go below zero
    currentScoreDisplay.textContent = currentTeam.total_score;

    // Log the answer
    currentTeam.progress_log.push({
        timestamp: new Date().toISOString(),
        event: 'trial_answered',
        location_id: currentTeam.current_location_id,
        location_name: currentLocations[currentLocationIndex].name,
        trial_id: trial.id,
        trial_question: trial.question_text,
        player_answer: playerAnswer,
        correct_answer: trial.correct_answer,
        is_correct: isCorrect,
        score_change: scoreChange,
        total_score_after: currentTeam.total_score,
        time_taken_seconds: trial.time_limit_seconds > 0 ? (currentTrialDuration - parseTimeToSeconds(trialTimerDisplay.textContent)) : null,
        hints_used_in_trial: hintsUsedInTrial
    });

    // Update team state in DB
    const { error: updateError } = await supabase
        .from('teams')
        .update({
            total_score: currentTeam.total_score,
            last_activity: new Date().toISOString(),
            progress_log: currentTeam.progress_log
        })
        .eq('id', currentTeam.id);

    if (updateError) {
        console.error('Error updating team score and progress:', updateError);
        showAlert('Error al guardar el progreso del equipo.', 'error');
    }

    // Stop trial timer
    clearInterval(trialTimerInterval);
    trialTimerDisplay.classList.add('hidden');

    displayFeedback(message, details, scoreChange);
}

function displayFeedback(message, details, scoreChange) {
    feedbackMessageDisplay.textContent = message;
    feedbackDetailsDisplay.textContent = details;
    feedbackScoreChange.textContent = `Puntuación: ${scoreChange >= 0 ? '+' : ''}${scoreChange} puntos`;
    feedbackScoreChange.style.color = scoreChange >= 0 ? 'green' : 'red';
    showScreen(feedbackScreen);
}

async function requestHint() {
    const trial = currentTrials[currentTrialIndex];
    if (!trial || !trial.hint_text) {
        showAlert('No hay pistas disponibles para esta prueba.', 'info');
        return;
    }

    currentTeam.hints_used_global = (currentTeam.hints_used_global || 0) + 1;
    currentTeam.hints_used_per_trial = currentTeam.hints_used_per_trial || [];
    currentTeam.hints_used_per_trial.push({
        trial_id: trial.id,
        timestamp: new Date().toISOString(),
        penalty: trial.hint_penalty_points
    });

    // Update hints used in DB
    const { error: updateError } = await supabase
        .from('teams')
        .update({
            hints_used_global: currentTeam.hints_used_global,
            hints_used_per_trial: currentTeam.hints_used_per_trial,
            last_activity: new Date().toISOString()
        })
        .eq('id', currentTeam.id);

    if (updateError) {
        console.error('Error updating hint usage:', updateError);
        showAlert('Error al guardar el uso de la pista.', 'error');
    }

    showModal('Pista', trial.hint_text + (trial.hint_penalty_points > 0 ? ` (Te costará ${trial.hint_penalty_points} puntos)` : ''));
}

async function continueFromFeedback() {
    currentTrialIndex++;
    // Reset hints for the current trial as it's completed
    currentTeam.hints_used_per_trial = (currentTeam.hints_used_per_trial || []).filter(h => h.trial_id !== currentTrials[currentTrialIndex - 1]?.id);

    if (currentTrialIndex < currentTrials.length) {
        await displayCurrentTrial();
    } else {
        await completeLocation();
    }
}

async function completeLocation() {
    showAlert(`Ubicación "${currentLocations[currentLocationIndex].name}" completada.`, 'success');

    // Add location completed log
    currentTeam.progress_log.push({
        timestamp: new Date().toISOString(),
        event: 'location_completed',
        location_id: currentLocations[currentLocationIndex].id,
        location_name: currentLocations[currentLocationIndex].name,
        total_score_after: currentTeam.total_score,
        total_time_seconds_after: currentTeam.total_time_seconds
    });

    // Update current_location_id to null and update progress log
    const { error: updateError } = await supabase
        .from('teams')
        .update({
            current_location_id: null, // Clear current location
            current_trial_id: null, // Clear current trial
            last_activity: new Date().toISOString(),
            progress_log: currentTeam.progress_log
        })
        .eq('id', currentTeam.id);

    if (updateError) {
        console.error('Error updating team state after location completion:', updateError);
        showAlert('Error al finalizar la ubicación. ' + updateError.message, 'error');
    }

    // Logic for next location based on adventure_type
    const adventureType = currentGame.adventure_type || 'linear';

    if (adventureType === 'linear') {
        currentLocationIndex++;
        if (currentLocationIndex < currentLocations.length) {
            await displayLocationNarrative(currentLocations[currentLocationIndex]);
        } else {
            await completeGame();
        }
    } else if (adventureType === 'selectable') {
        // For selectable, go back to location selection screen
        currentLocationIndex = -1; // No active location
        await displayLocationSelectionScreen();
    }
}


async function completeGame() {
    clearInterval(globalGameTimerInterval); // Stop the global timer
    currentTeam.total_time_seconds = parseTimeToSeconds(gameTotalTimeDisplay.textContent);

    // Add game completed log
    currentTeam.progress_log.push({
        timestamp: new Date().toISOString(),
        event: 'game_completed',
        total_score: currentTeam.total_score,
        total_time_seconds: currentTeam.total_time_seconds
    });

    const { error: updateError } = await supabase
        .from('teams')
        .update({
            status: 'completed',
            total_time_seconds: currentTeam.total_time_seconds,
            last_activity: new Date().toISOString(),
            progress_log: currentTeam.progress_log,
            current_location_id: null, // Clear active location
            current_trial_id: null // Clear active trial
        })
        .eq('id', currentTeam.id);

    if (updateError) {
        console.error('Error updating team status to completed:', updateError);
        showAlert('Error al finalizar el juego en la base de datos.', 'error');
    }

    finalScoreDisplay.textContent = currentTeam.total_score;
    finalTimeDisplay.textContent = formatTime(currentTeam.total_time_seconds);

    await displayRanking();
    showScreen(finalScreen);
    localStorage.removeItem('currentTeamId'); // Clear stored team ID
}

async function displayRanking() {
    const { data, error } = await supabase
        .from('teams')
        .select('name, total_score, total_time_seconds')
        .eq('game_id', currentGame.id)
        .eq('status', 'completed')
        .order('total_score', { ascending: false })
        .order('total_time_seconds', { ascending: true })
        .limit(10); // Top 10

    if (error) {
        console.error('Error fetching rankings:', error);
        finalRankingList.innerHTML = '<li>Error al cargar el ranking.</li>';
        return;
    }

    finalRankingList.innerHTML = '';
    if (data.length === 0) {
        finalRankingList.innerHTML = '<li>Nadie ha completado este juego todavía. ¡Sé el primero!</li>';
        return;
    }

    data.forEach((team, index) => {
        const listItem = document.createElement('li');
        listItem.textContent = `${index + 1}. ${team.name} - Puntuación: ${team.total_score} - Tiempo: ${formatTime(team.total_time_seconds)}`;
        finalRankingList.appendChild(listItem);
    });
}

async function displayLocationSelectionScreen() {
    showScreen(locationSelectionScreen);
    gameSelectionInitialNarrative.textContent = currentGame.initial_narrative;
    locationListContainer.innerHTML = ''; // Clear previous list

    currentLocations.forEach(location => {
        const locationCard = document.createElement('div');
        locationCard.className = 'game-card location-card'; // Reuse game-card styling
        locationCard.innerHTML = `
            <h3>${location.name}</h3>
            <p>${location.description}</p>
            ${location.image_url ? `<img src="${location.image_url}" alt="Imagen de ${location.name}" class="narrative-image small-img">` : ''}
            <button class="btn btn-primary select-location-btn" data-location-id="${location.id}">Elegir Ubicación</button>
        `;
        locationListContainer.appendChild(locationCard);
    });

    document.querySelectorAll('.select-location-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const locationId = e.target.dataset.locationId;
            await selectLocation(locationId);
        });
    });
}

async function selectLocation(locationId) {
    const selectedLocation = currentLocations.find(loc => loc.id === locationId);
    if (!selectedLocation) {
        showAlert('Ubicación no encontrada.', 'error');
        return;
    }

    currentLocationIndex = currentLocations.findIndex(loc => loc.id === locationId);
    if (currentLocationIndex === -1) {
        console.error('Error: Ubicación seleccionada no encontrada en la lista de ubicaciones cargadas.');
        showAlert('Error interno al seleccionar ubicación. Por favor, reinicia.', 'error');
        return;
    }

    // Update team's current_location_id in DB
    const { error: updateTeamError } = await supabase
        .from('teams')
        .update({
            current_location_id: selectedLocation.id,
            current_trial_id: null, // Reset trial for new location
            last_activity: new Date().toISOString(),
            progress_log: [...currentTeam.progress_log, {
                timestamp: new Date().toISOString(),
                event: 'location_selected',
                location_id: selectedLocation.id,
                location_name: selectedLocation.name
            }]
        })
        .eq('id', currentTeam.id);

    if (updateTeamError) {
        console.error('Error al actualizar la ubicación actual del equipo:', updateTeamError);
        showAlert('Error al guardar la ubicación elegida. ' + updateTeamError.message, 'error');
        return;
    }
    currentTeam.current_location_id = selectedLocation.id; // Update local state
    currentTeam.current_trial_id = null; // Ensure local state reflects DB
    currentTeam.progress_log.push({
        timestamp: new Date().toISOString(),
        event: 'location_selected',
        location_id: selectedLocation.id,
        location_name: selectedLocation.name
    });


    showScreen(gameActiveScreen); // Switch to the active game screen
    await displayLocationNarrative(selectedLocation);
}


// --- Timers ---
function startGlobalTimer() {
    clearInterval(globalGameTimerInterval); // Clear any existing timer
    globalGameTimerInterval = setInterval(() => {
        const elapsed = Math.floor((new Date().getTime() - gameStartTime) / 1000);
        gameTotalTimeDisplay.textContent = formatTime(elapsed);
        currentTeam.total_time_seconds = elapsed; // Keep local state updated
    }, 1000);
}

function startTrialTimer() {
    let timeLeft = currentTrialDuration;
    trialTimerDisplay.textContent = formatTime(timeLeft); // Initial display

    clearInterval(trialTimerInterval);
    trialTimerInterval = setInterval(() => {
        timeLeft--;
        trialTimerDisplay.textContent = formatTime(timeLeft);
        if (timeLeft <= 0) {
            clearInterval(trialTimerInterval);
            showAlert('¡Tiempo agotado para esta prueba!', 'warning', 3000);
            submitAnswer('TIME_EXPIRED'); // Submit a special answer for time out
        }
    }, 1000);
}

function resumeGameTimers() {
    if (currentTeam && currentTeam.start_time) {
        gameStartTime = new Date(currentTeam.start_time).getTime();
        startGlobalTimer();
        // If resuming within a trial, also resume its timer
        if (currentTeam.current_trial_id && currentTrialIndex !== -1 && currentTrials[currentTrialIndex] && currentTrials[currentTrialIndex].time_limit_seconds > 0) {
            const trial = currentTrials[currentTrialIndex];
            // Calculate remaining time. This assumes `progress_log` contains the `trial_displayed` event.
            // A more robust solution might save `trial_start_time` in the team state directly.
            const trialStartLog = currentTeam.progress_log.findLast(log =>
                log.event === 'trial_displayed' && log.trial_id === trial.id
            );

            if (trialStartLog) {
                const trialElapsedTime = Math.floor((new Date().getTime() - new Date(trialStartLog.timestamp).getTime()) / 1000);
                currentTrialDuration = Math.max(0, trial.time_limit_seconds - trialElapsedTime);
                if (currentTrialDuration > 0) {
                    trialTimerDisplay.classList.remove('hidden');
                    startTrialTimer();
                } else {
                    showAlert('El tiempo para la prueba actual ha expirado al reanudar.', 'warning');
                    submitAnswer('TIME_EXPIRED'); // Immediately submit if time already ran out
                }
            } else {
                // If trial start log not found, assume starting fresh for this trial
                currentTrialDuration = trial.time_limit_seconds;
                trialTimerDisplay.classList.remove('hidden');
                startTrialTimer();
            }
        }
    }
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function parseTimeToSeconds(timeString) {
    const parts = timeString.split(':');
    if (parts.length === 2) {
        const minutes = parseInt(parts[0], 10);
        const seconds = parseInt(parts[1], 10);
        return (minutes * 60) + seconds;
    }
    return 0;
}

// --- GPS Functionality ---
async function checkLocationArrival(location) {
    locationNarrativeSection.classList.add('hidden'); // Hide narrative initially
    startLocationTrialsBtn.classList.add('hidden'); // Hide button until arrival
    locationArrivalMapContainer.classList.remove('hidden'); // Show map container
    locationArrivalMessage.textContent = 'Buscando tu ubicación...';

    // Initialize map if not already done
    if (!locationArrivalMap) {
        locationArrivalMap = L.map('location-arrival-map').setView([location.latitude, location.longitude], 16);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(locationArrivalMap);

        locationTargetMarker = L.marker([location.latitude, location.longitude]).addTo(locationArrivalMap)
            .bindPopup(`<b>Destino: ${location.name}</b>`).openPopup();
    } else {
        // If map exists, just update view and target marker
        locationArrivalMap.setView([location.latitude, location.longitude], 16);
        if (locationTargetMarker) {
            locationTargetMarker.setLatLng([location.latitude, location.longitude]);
            locationTargetMarker.setPopupContent(`<b>Destino: ${location.name}</b>`).openPopup();
        } else {
            locationTargetMarker = L.marker([location.latitude, location.longitude]).addTo(locationArrivalMap)
                .bindPopup(`<b>Destino: ${location.name}</b>`).openPopup();
        }
    }

    // Clear any previous watchPosition
    if (locationGpsWatchId) {
        navigator.geolocation.clearWatch(locationGpsWatchId);
    }

    // Start watching position
    locationGpsWatchId = navigator.geolocation.watchPosition(
        (position) => {
            const { latitude, longitude, accuracy } = position.coords;
            const distance = getDistance(
                latitude, longitude,
                location.latitude, location.longitude
            );
            const threshold = 20; // meters

            if (locationPlayerMarker) {
                locationPlayerMarker.setLatLng([latitude, longitude]);
            } else {
                locationPlayerMarker = L.marker([latitude, longitude], { icon: L.divIcon({ className: 'player-marker', html: '<div style="background-color: blue; width: 10px; height: 10px; border-radius: 50%;"></div>' }) }).addTo(locationArrivalMap)
                    .bindPopup('Tu ubicación actual').openPopup();
            }

            locationArrivalMap.panTo([latitude, longitude]); // Keep map centered on player

            locationArrivalMessage.textContent = `Distancia al destino: ${distance.toFixed(0)} metros. Precisión GPS: ${accuracy.toFixed(0)}m`;

            if (distance < threshold) {
                clearInterval(locationGpsWatchId);
                locationGpsWatchId = null;
                locationArrivalMessage.textContent = `¡Has llegado a ${location.name}!`;
                startLocationTrialsBtn.classList.remove('hidden');

                // Log location arrival
                currentTeam.progress_log.push({
                    timestamp: new Date().toISOString(),
                    event: 'location_arrived',
                    location_id: location.id,
                    location_name: location.name,
                    arrival_coords: { latitude, longitude, accuracy },
                    distance_at_arrival: distance
                });
                supabase.from('teams').update({ progress_log: currentTeam.progress_log }).eq('id', currentTeam.id).then(({ error }) => {
                    if (error) console.error('Error logging location arrival:', error);
                });
            }
        },
        (error) => {
            console.error('Error al obtener la ubicación GPS:', error);
            locationArrivalMessage.textContent = 'Error al obtener tu ubicación GPS. Por favor, asegúrate de que el GPS esté activado y permite el acceso.';
            startLocationTrialsBtn.classList.remove('hidden'); // Allow manual continuation if GPS fails
            showModal('Error GPS', 'No pudimos obtener tu ubicación. Asegúrate de que el GPS esté encendido y que el navegador tenga permisos. Si el problema persiste, puedes intentar iniciar las pruebas manualmente.');
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
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

// --- QR Code Scanner Functionality ---
async function toggleQrScanner() {
    if (!qrScanning) {
        startQrScanner();
        qrReaderBtn.textContent = 'Detener Escáner QR';
    } else {
        stopQrScanner();
        qrReaderBtn.textContent = 'Activar Escáner QR';
    }
}

async function startQrScanner() {
    if (qrScanning) return; // Prevent multiple instances

    qrScanning = true;
    qrReaderContainer.classList.remove('hidden'); // Show QR elements

    qrScanner = new Html5Qrcode("qr-reader");
    const config = { fps: 10, qrbox: 250 };

    try {
        await qrScanner.start({ facingMode: "environment" }, config,
            (decodedText, decodedResult) => {
                // onScanSuccess
                qrCodeValueDisplay.textContent = decodedText;
                showAlert(`QR Escaneado: ${decodedText}`, 'success', 2000);
                // Optionally stop scanner after first successful scan
                // stopQrScanner(); // You might want to remove this if multiple scans are needed
            },
            (errorMessage) => {
                // onScanError (optional)
                // console.warn(`QR Scan Error: ${errorMessage}`);
                // qrCodeValueDisplay.textContent = `Error al escanear: ${errorMessage}`;
            });
        qrCodeValueDisplay.textContent = 'Escaneando QR...';
    } catch (err) {
        console.error("Error starting QR scanner:", err);
        showAlert("Error al iniciar el escáner QR. Asegúrate de permitir el acceso a la cámara.", 'error');
        qrScanning = false;
        qrReaderContainer.classList.add('hidden');
    }
}

function stopQrScanner() {
    if (qrScanner && qrScanning) {
        qrScanner.stop().then(() => {
            console.log("QR scanner stopped.");
            qrScanning = false;
            qrReaderContainer.classList.add('hidden');
            qrReaderVideo.srcObject = null; // Clear video stream
            qrCodeValueDisplay.textContent = '';
            qrReaderBtn.textContent = 'Activar Escáner QR';
        }).catch((err) => {
            console.error("Error stopping QR scanner:", err);
            qrScanning = false; // Still try to reset flag even if stop fails
        });
    }
}
