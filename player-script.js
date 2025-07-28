// player-script.js

// Supabase ya está inicializado en player-supabase-config.js
// Asegúrate de que player-supabase-config.js se carga ANTES de este script
// y que la variable 'supabase' está correctamente definida y accesible globalmente.

// --- Global State Variables ---
let currentTeam = null; // Stores current team data from Supabase
let currentGame = null; // Stores current game data from Supabase
let currentLocations = []; // All locations for the current game
let currentTrials = []; // All trials for the current location
let currentLocationIndex = 0; // For linear games
let currentTrialIndex = 0; // For linear trials within a location

let gameTimerInterval = null;
let trialTimerInterval = null;
let gameStartTime = 0; // Timestamp when current game started (initialized)
let trialStartTime = 0; // Timestamp when current trial started

let playerMap = null; // Leaflet map instance
let playerMarker = null; // Player's marker on the map
let targetMarker = null; // Target trial marker on the map
let gpsWatchId = null; // ID for navigator.geolocation.watchPosition

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
const gameDetailDescription = document.getElementById('game-detail-description');
const gameDetailMechanics = document.getElementById('game-detail-mechanics');
const gameDetailInitialNarrative = document.getElementById('game-detail-initial-narrative');
const gameDetailMedia = document.getElementById('game-detail-media'); // Container for image/audio
const teamNameInput = document.getElementById('team-name-input');
const startGameBtn = document.getElementById('start-game-btn');
const backToGameSelectionBtn = document.getElementById('back-to-game-selection-btn');

const gameActiveScreen = document.getElementById('game-active-screen');
const gameTotalTimeDisplay = document.getElementById('game-total-time');
const trialTimerDisplay = document.getElementById('trial-timer');
const currentScoreDisplay = document.getElementById('current-score');
const locationNarrativeSection = document.getElementById('location-narrative-section');
const locationNarrativeDisplay = document.getElementById('location-narrative');

// Specific trial sections
const textTrialSection = document.getElementById('text-trial-section');
const qrTrialSection = document.getElementById('qr-trial-section');
const gpsTrialSection = document.getElementById('gps-trial-section');

// Common trial elements
const trialNarrativeDisplay = document.getElementById('trial-narrative');
const trialImage = document.getElementById('trial-image');
const trialAudio = document.getElementById('trial-audio');
const hintBtn = document.getElementById('hint-btn');
const hintCostDisplay = document.getElementById('hint-cost');
const hintsRemainingDisplay = document.getElementById('hints-remaining');

// TEXT Trial elements
const textQuestionDisplay = document.getElementById('text-question');
const textAnswerInput = document.getElementById('text-answer-input');
const textOptionsContainer = document.getElementById('text-options-container');
const validateAnswerBtn = document.getElementById('validate-answer-btn');

// QR Trial elements
const qrScannerContainer = document.getElementById('qr-scanner');
const qrScanBtn = document.getElementById('qr-scan-btn');
const qrResultDisplay = document.getElementById('qr-result');
const qrHintBtn = document.getElementById('qr-hint-btn'); // Specific hint button for QR
const qrHintCostDisplay = document.getElementById('qr-hint-cost');
const qrHintsRemainingDisplay = document.getElementById('qr-hints-remaining');

// GPS Trial elements
const gpsMapContainer = document.getElementById('gps-map');
const gpsHintBtn = document.getElementById('gps-hint-btn'); // Specific hint button for GPS
const gpsHintCostDisplay = document.getElementById('gps-hint-cost');
const gpsHintsRemainingDisplay = document.getElementById('gps-hints-remaining');

const feedbackScreen = document.getElementById('feedback-screen');
const feedbackMessage = document.getElementById('feedback-message');
const feedbackScore = document.getElementById('feedback-score');
const continueGameBtn = document.getElementById('continue-game-btn');

const gameCompletionScreen = document.getElementById('game-completion-screen');
const finalGameTitle = document.getElementById('final-game-title');
const finalScore = document.getElementById('final-score');
const finalTime = document.getElementById('final-time');
const playAgainBtn = document.getElementById('play-again-btn');
const viewFinalRankingsBtn = document.getElementById('view-final-rankings-btn');

const globalRankingsScreen = document.getElementById('global-rankings-screen');
const globalRankingsGameSelect = document.getElementById('global-rankings-game-select');
const globalRankingsList = document.getElementById('global-rankings-list');
const backToMenuFromRankingsBtn = document.getElementById('back-to-menu-from-rankings-btn');

const appAlert = document.getElementById('app-alert');
const modalContainer = document.getElementById('modal-container');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalCloseBtn = document.getElementById('modal-close-btn');


// --- Utility Functions ---
function showScreen(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    screen.classList.remove('hidden');
}

function showAlert(message, type = 'info') {
    if (!appAlert) {
        console.warn('App alert element not found. Message:', message);
        console.log(`ALERT: ${message}`);
        return;
    }
    appAlert.textContent = message;
    appAlert.className = `app-alert ${type}`;
    appAlert.style.display = 'block';

    setTimeout(() => {
        appAlert.style.display = 'none';
    }, 3000);
}

function showModal(title, message) {
    if (!modalContainer || !modalTitle || !modalMessage) {
        console.error('Error: Generic modal elements not found in DOM. Falling back to native alert.');
        alert(`Modal Content:\nTitle: ${title}\nMessage: ${message}`);
        return;
    }
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modalContainer.classList.remove('hidden');
}

function hideModal() {
    if (modalContainer) {
        modalContainer.classList.add('hidden');
        modalTitle.textContent = '';
        modalMessage.textContent = '';
    }
}

function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    const pad = (num) => String(num).padStart(2, '0');

    if (hours > 0) {
        return `${pad(hours)}:${pad(minutes)}:${pad(remainingSeconds)}`;
    } else {
        return `${pad(minutes)}:${pad(remainingSeconds)}`;
    }
}

// Haversine formula for distance between two points on Earth (in meters)
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

// --- PWA Service Worker Registration ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
            navigator.serviceWorker.register('/service-worker.js')
                .then(reg => {
                    console.log('Service Worker registrado con éxito:', reg);
                })
                .catch(err => {
                    console.error('Fallo el registro del Service Worker:', err);
                    showAlert('Error: No se pudo registrar el Service Worker para funciones offline. Recarga la página en un servidor.', 'error');
                });
        } else {
            console.warn('Service Worker no registrado: El protocolo URL actual no es HTTP o HTTPS. Usa un servidor local.');
            showAlert('Advertencia: Funciones offline no disponibles. Usa un servidor web (ej. http://localhost) para la mejor experiencia.', 'warning');
        }
    });
}

// --- Main Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    showScreen(loadingScreen);

    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', hideModal);
    }

    const storedTeamId = localStorage.getItem('currentTeamId');
    if (storedTeamId) {
        const teamLoaded = await loadTeamState(storedTeamId);
        if (teamLoaded && currentTeam) {
            showScreen(gameActiveScreen);
            resumeGameTimers();
            await displayCurrentTrial();
            showAlert('Reanudando juego como equipo: ' + currentTeam.name, 'info'); // Usando 'name' para el equipo
            return;
        } else {
            localStorage.removeItem('currentTeamId');
            showAlert('Tu sesión de juego anterior no pudo ser recuperada. Por favor, selecciona un juego de nuevo.', 'warning');
        }
    }

    showScreen(welcomeScreen);
});

// --- Welcome Screen Logic ---
if (startNewGameFlowBtn) {
    startNewGameFlowBtn.addEventListener('click', () => {
        showScreen(gameSelectionScreen);
        fetchActiveGames();
    });
}

// --- Supabase Interaction Functions ---

async function fetchActiveGames() {
    if (!supabase) {
        showModal('Error de Conexión', 'La aplicación no pudo conectar con la base de datos. Por favor, recarga la página.');
        return;
    }

    const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('is_active', true)
        .order('title', { ascending: true });

    if (error) {
        console.error('Error fetching active games:', error);
        showModal('Error', 'No pudimos cargar los juegos activos. Por favor, intenta de nuevo más tarde. ' + error.message);
        return;
    }

    gameList.innerHTML = '';
    if (data.length === 0) {
        gameList.innerHTML = '<p class="info-message">No hay juegos activos disponibles en este momento. ¡Vuelve pronto!</p>';
        return;
    }

    data.forEach(game => {
        const gameCard = document.createElement('div');
        gameCard.className = 'game-card';
        gameCard.dataset.gameId = game.id;
        gameCard.innerHTML = `
            <h3>${game.title}</h3>
            <p>${game.description}</p>
            <button class="btn btn-primary select-game-btn" data-game-id="${game.id}">Seleccionar</button>
        `;
        gameList.appendChild(gameCard);
    });

    document.querySelectorAll('.select-game-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const gameId = e.target.dataset.gameId;
            await displayGameDetails(gameId);
        });
    });
}

async function displayGameDetails(gameId) {
    const { data: game, error } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

    if (error) {
        console.error('Error fetching game details:', error);
        showModal('Error', 'No pudimos cargar los detalles del juego. ' + error.message);
        return;
    }

    currentGame = game;
    gameDetailTitle.textContent = currentGame.title;
    gameDetailDescription.textContent = currentGame.description;
    gameDetailMechanics.textContent = currentGame.mechanics;
    gameDetailInitialNarrative.textContent = currentGame.initial_narrative;

    gameDetailMedia.innerHTML = ''; // Clear previous media
    if (currentGame.image_url) {
        const img = document.createElement('img');
        img.src = currentGame.image_url;
        img.alt = `Imagen de ${currentGame.title}`;
        img.classList.add('narrative-image');
        gameDetailMedia.appendChild(img);
    }
    if (currentGame.audio_url) {
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.src = currentGame.audio_url;
        audio.classList.add('narrative-audio');
        gameDetailMedia.appendChild(audio);
    }

    showScreen(gameDetailsScreen);
}

// Handle team creation/selection and then start game
if (startGameBtn) {
    startGameBtn.addEventListener('click', async () => {
        const teamName = teamNameInput.value.trim();
        if (!teamName) {
            showAlert('Por favor, introduce un nombre para tu equipo.', 'warning');
            return;
        }

        if (!currentGame) {
            showAlert('Error: No hay juego seleccionado.', 'error');
            return;
        }

        // 1. Intentar encontrar el equipo usando el nombre de columna 'name'
        let { data: existingTeam, error: teamCheckError } = await supabase
            .from('teams')
            .select('id')
            .eq('name', teamName) // Usando 'name' para el equipo
            .eq('game_id', currentGame.id)
            .single();

        if (teamCheckError && teamCheckError.code !== 'PGRST116') { // PGRST116 means "no rows found"
            showAlert('Error al verificar equipo: ' + teamCheckError.message, 'error');
            console.error('Error checking existing team:', teamCheckError);
            return;
        }

        if (existingTeam) {
            showAlert(`El equipo "${teamName}" ya existe para este juego. Por favor, elige otro nombre.`, 'warning');
            return;
        } else {
            // 2. Si el equipo NO existe, crearlo, usando 'name'
            const { data: newTeam, error: createError } = await supabase
                .from('teams')
                .insert({
                    name: teamName, // Usando 'name' para el equipo
                    game_id: currentGame.id,
                    current_location_id: null,
                    current_trial_id: null,
                    start_time: new Date().toISOString(),
                    last_trial_start_time: null,
                    hints_used_global: 0,
                    hints_used_per_trial: [],
                    total_time_seconds: 0, 
                    total_score: 0,
                    progress_log: [],
                    last_activity: new Date().toISOString()
                })
                .select()
                .single();

            if (createError) {
                showAlert('Error al crear el equipo: ' + createError.message, 'error');
                console.error('Error al crear el equipo:', createError);
                return;
            }
            currentTeam = newTeam;
            showAlert(`Equipo "${teamName}" creado con éxito.`, 'success');
        }

        // If we reach here, currentTeam is correctly set (either a new one created).
        // Now, proceed to actually start the game flow.
        await initializeGameFlowForTeam();
    });
} else {
    console.warn('Botón de Iniciar Juego (#start-game-btn) no encontrado.');
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

    // Set initial game state for the team in DB
    currentLocationIndex = 0; // Start at the first location
    currentTrialIndex = 0;    // Reset trial index for new game flow

    const { error: updateTeamError } = await supabase
        .from('teams')
        .update({
            current_location_id: currentLocations[0].id,
            current_trial_id: null, // Will be set when first trial starts
            last_activity: new Date().toISOString(),
            start_time: new Date().toISOString(), // Ensure start_time is updated for new game sessions
            // Reset progression stats for a new game
            total_time_sec: 0, // CAMBIADO: total_time a total_time_sec
            total_score: 0,
            hints_used_global: 0,
            hints_used_per_trial: [],
            progress_log: [],
        })
        .eq('id', currentTeam.id);

    if (updateTeamError) {
        console.error('Error updating team on game start:', updateTeamError);
        showAlert('Error al preparar el equipo para el juego.', 'error');
        return;
    }
    // Update local currentTeam object to reflect the changes for current game session
    currentTeam.current_location_id = currentLocations[0].id;
    currentTeam.current_trial_id = null;
    currentTeam.start_time = new Date().toISOString();
    currentTeam.total_time_sec = 0; // CAMBIADO: total_time a total_time_sec
    currentTeam.total_score = 0;
    currentTeam.hints_used_global = 0;
    currentTeam.hints_used_per_trial = [];
    currentTeam.progress_log = [];


    gameStartTime = new Date(currentTeam.start_time).getTime(); // Initialize global game start time
    startGlobalTimer(); // Start the main game timer
    currentScoreDisplay.textContent = currentTeam.total_score; // Update score display

    showScreen(gameActiveScreen);
    await displayLocationNarrative(currentLocations[0]); // Display first location narrative
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
        console.error('Error loading team state:', error);
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
            console.error('Error fetching locations for loaded game:', locError);
            showAlert('Error al cargar ubicaciones para juego reanudado.', 'error');
            return false;
        }
        currentLocations = locations;

        // Determine current location index
        currentLocationIndex = currentLocations.findIndex(loc => loc.id === currentTeam.current_location_id);
        if (currentLocationIndex === -1 && currentLocations.length > 0) currentLocationIndex = 0;
        else if (currentLocationIndex === -1) { // No current location or no locations in game
            console.warn("No current location found or no locations exist. Starting from beginning.");
            currentLocationIndex = 0;
        }

        // Fetch trials for the current location, using 'order_index' for trials
        if (currentTeam.current_location_id) {
            const { data: trials, error: trialError } = await supabase
                .from('trials')
                .select('*')
                .eq('location_id', currentTeam.current_location_id)
                .order('order_index', { ascending: true }); // Usando 'order_index' para trials
            if (trialError) {
                console.error('Error fetching trials for loaded location:', trialError);
                showAlert('Error al cargar pruebas para ubicación reanudada.', 'error');
                return false;
            }
            currentTrials = trials;

            // Determine current trial index
            currentTrialIndex = currentTrials.findIndex(trial => trial.id === currentTeam.current_trial_id);
            if (currentTrialIndex === -1 && currentTrials.length > 0) {
                // If trial ID is null or not found, it means we might be at a location narrative or first trial
                currentTrialIndex = 0;
            } else if (currentTrialIndex === -1) {
                console.warn("No current trial found or no trials exist in location.");
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
    // Hide all trial-specific sections
    textTrialSection.classList.add('hidden');
    qrTrialSection.classList.add('hidden');
    gpsTrialSection.classList.add('hidden');
    locationNarrativeSection.classList.remove('hidden'); // Show location narrative section

    // Usar 'initial_narrative' de la tabla locations
    locationNarrativeDisplay.innerHTML = `
        <h2>${location.name}</h2>
        <p>${location.initial_narrative}</p>
        ${location.image_url ? `<img src="${location.image_url}" alt="Ubicación" class="narrative-image">` : ''}
        ${location.audio_url ? `<audio controls src="${location.audio_url}"></audio>` : ''}
        <button id="start-location-trials-btn" class="main-action-button">Comenzar Pruebas</button>
    `;

    const startLocationTrialsBtn = document.getElementById('start-location-trials-btn');
    if (startLocationTrialsBtn) {
        startLocationTrialsBtn.addEventListener('click', async () => {
            // Assuming 'order_index' for trials
            const { data: trials, error: trialError } = await supabase
                .from('trials')
                .select('*')
                .eq('location_id', location.id)
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
            currentTrialIndex = 0; // Reset trial index for new location
            await displayCurrentTrial();
        });
    }
}

async function displayCurrentTrial() {
    if (!currentGame || !currentTeam || currentLocations.length === 0) {
        showModal('Error de Juego', 'El estado del juego es incorrecto. Por favor, reinicia la aplicación.');
        return;
    }

    const currentTrial = currentTrials[currentTrialIndex];
    if (!currentTrial) {
        // All trials for this location completed
        currentLocationIndex++; // Move to next location
        if (currentLocationIndex < currentLocations.length) {
            await displayLocationNarrative(currentLocations[currentLocationIndex]);
        } else {
            await completeGame();
        }
        return;
    }

    // Update current trial ID in team state
    const { error: updateTeamError } = await supabase
        .from('teams')
        .update({
            current_trial_id: currentTrial.id,
            last_activity: new Date().toISOString(),
            last_trial_start_time: new Date().toISOString()
        })
        .eq('id', currentTeam.id);

    if (updateTeamError) {
        console.error('Error updating current_trial_id:', updateTeamError);
        showAlert('Error al actualizar progreso.', 'error');
    }

    currentTeam.current_trial_id = currentTrial.id;
    currentTeam.last_trial_start_time = new Date().toISOString();


    document.querySelectorAll('.trial-section').forEach(sec => sec.classList.add('hidden'));
    locationNarrativeSection.classList.add('hidden');

    trialNarrativeDisplay.textContent = currentTrial.narrative;
    trialImage.src = ''; trialImage.classList.add('hidden');
    trialAudio.src = ''; trialAudio.classList.add('hidden');

    if (currentTrial.image_url) {
        trialImage.src = currentTrial.image_url;
        trialImage.classList.remove('hidden');
    }
    if (currentTrial.audio_url) {
        trialAudio.src = currentTrial.audio_url;
        trialAudio.classList.remove('hidden');
        trialAudio.play().catch(e => console.error("Error playing audio:", e));
    }

    const hintInfo = currentTeam.hints_used_per_trial.find(h => h.trialId === currentTrial.id);
    const hintsUsed = hintInfo ? hintInfo.count : 0;
    const hintsRemaining = (currentTrial.hints_count || 0) - hintsUsed;

    // Reset all hint displays and buttons
    [hintBtn, qrHintBtn, gpsHintBtn].forEach(btn => {
        if (btn) {
            btn.classList.add('hidden');
        }
    });

    switch (currentTrial.trial_type) { // Usando 'trial_type'
        case 'QR':
            qrTrialSection.classList.remove('hidden');
            qrResultDisplay.textContent = '';
            qrScannerContainer.classList.remove('hidden');
            if (qrHintsRemainingDisplay) qrHintsRemainingDisplay.textContent = hintsRemaining;
            if (qrHintCostDisplay) qrHintCostDisplay.textContent = currentTrial.hints_cost || 0;
            if (qrHintBtn && hintsRemaining > 0) qrHintBtn.classList.remove('hidden');
            break;
        case 'GPS':
            gpsTrialSection.classList.remove('hidden');
            gpsMapContainer.classList.remove('hidden');
            // Usando 'latitude', 'longitude', 'tolerance_meters'
            initializePlayerMap(currentTrial.latitude, currentTrial.longitude, currentTrial.tolerance_meters);
            if (gpsHintsRemainingDisplay) gpsHintsRemainingDisplay.textContent = hintsRemaining;
            if (gpsHintCostDisplay) gpsHintCostDisplay.textContent = currentTrial.hints_cost || 0;
            if (gpsHintBtn && hintsRemaining > 0) gpsHintBtn.classList.remove('hidden');
            break;
        case 'TEXT':
            textTrialSection.classList.remove('hidden');
            // Usando 'question'
            textQuestionDisplay.textContent = currentTrial.question;
            textAnswerInput.value = '';
            textAnswerInput.classList.remove('hidden');
            textOptionsContainer.innerHTML = '';
            textOptionsContainer.classList.add('hidden');

            if (hintsRemainingDisplay) hintsRemainingDisplay.textContent = hintsRemaining;
            if (hintCostDisplay) hintCostDisplay.textContent = currentTrial.hints_cost || 0;
            if (hintBtn && hintsRemaining > 0) hintBtn.classList.remove('hidden');

            switch (currentTrial.answer_type) {
                case 'SINGLE_CHOICE':
                case 'NUMERIC':
                    break;
                case 'MULTIPLE_OPTIONS':
                    textOptionsContainer.classList.remove('hidden');
                    textAnswerInput.classList.add('hidden');
                    // Options en CSV viene como un JSON string, necesitamos parsearlo
                    try {
                        const optionsArray = JSON.parse(currentTrial.options);
                        optionsArray.forEach((option) => {
                            const btn = document.createElement('button');
                            btn.className = 'btn btn-option';
                            btn.textContent = option.trim();
                            btn.dataset.value = option.trim();
                            btn.addEventListener('click', (e) => {
                                textAnswerInput.value = e.target.dataset.value;
                                validateAnswerBtn.click();
                            });
                            textOptionsContainer.appendChild(btn);
                        });
                    } catch (e) {
                        console.error('Error parsing options for TEXT trial:', e);
                        showAlert('Error cargando opciones de la prueba. Consulta al administrador.', 'error');
                    }
                    break;
                case 'ORDERING':
                    textOptionsContainer.classList.remove('hidden');
                    textAnswerInput.classList.add('hidden');
                    // Options en CSV viene como un JSON string, necesitamos parsearlo
                    try {
                        const optionsArray = JSON.parse(currentTrial.options);
                        optionsArray.forEach((option) => {
                            const btn = document.createElement('button');
                            btn.className = 'btn btn-option-ordering';
                            btn.textContent = option.trim();
                            btn.dataset.value = option.trim();
                            btn.addEventListener('click', () => {
                                if (textAnswerInput.value === '') {
                                    textAnswerInput.value = btn.dataset.value;
                                } else {
                                    textAnswerInput.value += ';' + btn.dataset.value;
                                }
                                showAlert(`Añadido: ${btn.dataset.value}`, 'info');
                            });
                            textOptionsContainer.appendChild(btn);
                        });
                    } catch (e) {
                        console.error('Error parsing options for TEXT trial:', e);
                        showAlert('Error cargando opciones de la prueba. Consulta al administrador.', 'error');
                    }

                    const clearOrderBtn = document.createElement('button');
                    clearOrderBtn.className = 'btn btn-secondary';
                    clearOrderBtn.textContent = 'Limpiar Orden';
                    clearOrderBtn.addEventListener('click', () => {
                        textAnswerInput.value = '';
                        showAlert('Orden limpiado.', 'info');
                    });
                    textOptionsContainer.appendChild(clearOrderBtn);
                    break;
            }
            break;
        default:
            showAlert('Tipo de prueba no reconocido: ' + currentTrial.trial_type, 'error');
            showModal('Error de Prueba', `El tipo de prueba '${currentTrial.trial_type}' no es reconocido. Contacta al administrador.`);
            break;
    }
    startTrialTimer();
}

async function completeTrial(pointsAwarded) {
    stopTrialTimer();
    stopGpsWatch();
    stopQrScanner();

    const timeTaken = Math.floor((Date.now() - trialStartTime) / 1000);
    let finalTrialScore = Math.max(0, pointsAwarded - timeTaken);

    const currentTrial = currentTrials[currentTrialIndex];
    const hintsUsedInThisTrial = currentTeam.hints_used_per_trial.find(h => h.trialId === currentTrial.id)?.count || 0;
    finalTrialScore -= (hintsUsedInThisTrial * (currentTrial.hints_cost || 0));
    finalTrialScore = Math.max(0, finalTrialScore);

    const progressLogEntry = {
        trial_id: currentTrial.id,
        location_id: currentLocations[currentLocationIndex].id,
        time_taken: timeTaken,
        score: finalTrialScore,
        timestamp: new Date().toISOString(),
        hints_used: hintsUsedInThisTrial
    };

    const { error } = await supabase
        .from('teams')
        .update({
            total_time_seconds: (currentTeam.total_time_seconds || 0) + timeTaken, //
            total_score: (currentTeam.total_score || 0) + finalTrialScore,
            progress_log: [...(currentTeam.progress_log || []), progressLogEntry],
            last_activity: new Date().toISOString()
        })
        .eq('id', currentTeam.id);

    if (error) {
        console.error('Error updating team progress:', error);
        showAlert('Error al guardar el progreso.', 'error');
    } else {
        currentTeam.total_time_seconds = (currentTeam.total_time_seconds || 0) + timeTaken; // 
        currentTeam.total_score = (currentTeam.total_score || 0) + finalTrialScore;
        currentTeam.progress_log = [...(currentTeam.progress_log || []), progressLogEntry];
        currentScoreDisplay.textContent = currentTeam.total_score;
    }

    feedbackMessage.textContent = '¡Prueba Completada!';
    feedbackScore.textContent = `Puntos: ${finalTrialScore} (${pointsAwarded} base - ${timeTaken}s - ${hintsUsedInThisTrial * (currentTrial.hints_cost || 0)} pts por pistas)`;
    showScreen(feedbackScreen);
}

async function continueFromFeedback() {
    currentTrialIndex++;
    await displayCurrentTrial(); // This function handles checking if location is complete or game is complete
}

async function completeGame() {
    stopGlobalTimer();
    const totalGameTimeSeconds = currentTeam.total_time_seconds; 
    const finalScoreValue = currentTeam.total_score;

    const { error: rankingError } = await supabase
        .from('rankings')
        .insert({
            game_id: currentGame.id,
            team_id: currentTeam.id,
            final_score: finalScoreValue,
            completion_time: totalGameTimeSeconds,
            completion_date: new Date().toISOString()
        });

    if (rankingError) {
        console.error('Error saving ranking:', rankingError);
        showAlert('Error al guardar el ranking final. ' + rankingError.message, 'error');
    } else {
        showAlert('¡Juego completado con éxito! Tu ranking ha sido guardado.', 'success');
    }

    finalGameTitle.textContent = currentGame.title;
    finalScore.textContent = finalScoreValue;
    finalTime.textContent = formatTime(totalGameTimeSeconds);
    showScreen(gameCompletionScreen);

    localStorage.removeItem('currentTeamId');
    currentTeam = null;
    currentGame = null;
    currentLocations = [];
    currentTrials = [];
    currentLocationIndex = 0;
    currentTrialIndex = 0;
}

// --- Timers ---
function startGlobalTimer() {
    if (gameTimerInterval) clearInterval(gameTimerInterval);
    gameTimerInterval = setInterval(() => {
        const elapsedSinceGameStart = Math.floor((Date.now() - gameStartTime) / 1000);
        gameTotalTimeDisplay.textContent = 'Tiempo Total: ' + formatTime(elapsedSinceGameStart);
    }, 1000);
}

function stopGlobalTimer() {
    if (gameTimerInterval) {
        clearInterval(gameTimerInterval);
        gameTimerInterval = null;
    }
}

function startTrialTimer() {
    trialStartTime = Date.now();
    if (trialTimerInterval) clearInterval(trialTimerInterval);
    trialTimerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - trialStartTime) / 1000);
        trialTimerDisplay.textContent = 'Tiempo Prueba: ' + formatTime(elapsed);
    }, 1000);
}

function stopTrialTimer() {
    if (trialTimerInterval) {
        clearInterval(trialTimerInterval);
        trialTimerInterval = null;
    }
}

function resumeGameTimers() {
    startGlobalTimer();

    if (currentTeam && currentTeam.current_trial_id && currentTeam.last_trial_start_time) {
        trialStartTime = new Date(currentTeam.last_trial_start_time).getTime();
        startTrialTimer();
    }
}

// --- Answer Validation and Hints ---
if (validateAnswerBtn) {
    validateAnswerBtn.addEventListener('click', async () => {
        if (!currentTrial) {
            showAlert('No hay una prueba activa para validar.', 'warning');
            return;
        }

        let userAnswer = '';
        const currentTrialType = currentTrial.trial_type;
        const currentAnswerType = currentTrial.answer_type;

        if (currentTrialType === 'TEXT') {
            userAnswer = textAnswerInput.value.trim();
            if (currentAnswerType === 'NUMERIC') {
                userAnswer = parseFloat(userAnswer);
                if (isNaN(userAnswer)) {
                    showAlert('Por favor, introduce una respuesta numérica válida.', 'warning');
                    return;
                }
            }
        } else if (currentTrialType === 'QR') {
            userAnswer = qrResultDisplay.textContent.trim();
            if (!userAnswer) {
                showAlert('Por favor, escanea un código QR primero.', 'warning');
                return;
            }
        } else if (currentTrialType === 'GPS') {
            showAlert('La validación GPS es automática cuando llegas a la zona.', 'info');
            return;
        }

        let isCorrect = false;
        let basePoints = currentGame.initial_score_per_trial || 100;

        switch (currentTrialType) {
            case 'TEXT':
                // Asegurar que la comparación sea case-insensitive y maneje números si `correct_answer` es string
                if (currentAnswerType === 'NUMERIC') {
                    isCorrect = userAnswer === parseFloat(currentTrial.correct_answer);
                } else if (currentAnswerType === 'MULTIPLE_OPTIONS' || currentAnswerType === 'SINGLE_CHOICE') {
                    isCorrect = userAnswer.toLowerCase() === currentTrial.correct_answer.toLowerCase();
                } else if (currentAnswerType === 'ORDERING') {
                    // Para ordenación, el CSV guarda "OpciónA;OpciónB", comparamos strings directamente
                    isCorrect = userAnswer.toLowerCase() === currentTrial.correct_answer.toLowerCase();
                }
                break;
            case 'QR':
                isCorrect = userAnswer === currentTrial.qr_content;
                break;
            case 'GPS':
                isCorrect = false; // Handled by watchPosition
                break;
        }

        if (isCorrect) {
            showAlert('¡Respuesta Correcta!', 'success');
            await completeTrial(basePoints);
        } else {
            showAlert('Respuesta Incorrecta. Inténtalo de nuevo.', 'error');
        }
    });
}

// Generic hint button logic, applies to whichever hint button is visible
[hintBtn, qrHintBtn, gpsHintBtn].forEach(btn => {
    if (btn) {
        btn.addEventListener('click', async (e) => {
            if (!currentTrial || !currentTeam) {
                showAlert('No hay una prueba activa para pedir pista.', 'warning');
                return;
            }

            const hintsUsedInThisTrial = currentTeam.hints_used_per_trial.find(h => h.trialId === currentTrial.id)?.count || 0;
            if (hintsUsedInThisTrial >= (currentTrial.hints_count || 0)) {
                showAlert('No quedan más pistas para esta prueba.', 'warning');
                e.target.classList.add('hidden');
                return;
            }

            // Update hintsUsedPerTrial in a way that handles the array correctly
            let updatedHintsUsedPerTrial = [...currentTeam.hints_used_per_trial];
            const existingHintIndex = updatedHintsUsedPerTrial.findIndex(h => h.trialId === currentTrial.id);

            if (existingHintIndex !== -1) {
                updatedHintsUsedPerTrial[existingHintIndex].count++;
            } else {
                updatedHintsUsedPerTrial.push({ trialId: currentTrial.id, count: 1 });
            }


            const { error } = await supabase
                .from('teams')
                .update({
                    hints_used_global: (currentTeam.hints_used_global || 0) + 1,
                    hints_used_per_trial: updatedHintsUsedPerTrial,
                    last_activity: new Date().toISOString()
                })
                .eq('id', currentTeam.id);

            if (error) {
                console.error('Error logging hint:', error);
                showAlert('Error al registrar la pista. ' + error.message, 'error');
                return;
            }

            // Update local state
            currentTeam.hints_used_global = (currentTeam.hints_used_global || 0) + 1;
            currentTeam.hints_used_per_trial = updatedHintsUsedPerTrial; // Ensure local state is updated

            const newHintsRemaining = (currentTrial.hints_count || 0) - (hintsUsedInThisTrial + 1);

            if (e.target === hintBtn) hintsRemainingDisplay.textContent = newHintsRemaining;
            if (e.target === qrHintBtn && qrHintsRemainingDisplay) qrHintsRemainingDisplay.textContent = newHintsRemaining;
            if (e.target === gpsHintBtn && gpsHintsRemainingDisplay) gpsHintsRemainingDisplay.textContent = newHintsRemaining;

            showAlert(`Pista utilizada. ${currentTrial.hints_cost || 0} puntos restados. Te quedan ${newHintsRemaining} pistas.`, 'info');

            if (newHintsRemaining <= 0) {
                e.target.classList.add('hidden');
            }
            showModal('Pista', currentTrial.hint_content || 'No hay contenido de pista disponible para esta prueba.');
        });
    }
});


// --- GPS Functions ---
function initializePlayerMap(targetLat, targetLng, tolerance) {
    if (playerMap) {
        playerMap.remove();
    }

    gpsMapContainer.classList.remove('hidden');

    playerMap = L.map(gpsMapContainer).setView([targetLat, targetLng], 17);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(playerMap);

    if (targetMarker) {
        playerMap.removeLayer(targetMarker);
    }
    targetMarker = L.circleMarker([targetLat, targetLng], {
        color: 'red',
        fillColor: '#f03',
        fillOpacity: 0.5,
        radius: 8
    }).addTo(playerMap).bindPopup(`Objetivo: ${currentTrial.narrative || 'Prueba'}`).openPopup(); // Usando 'narrative' para la prueba

    L.circle([targetLat, targetLng], {
        color: 'blue',
        fillColor: '#30a',
        fillOpacity: 0.2,
        radius: tolerance
    }).addTo(playerMap);

    if (playerMarker) {
        playerMap.removeLayer(playerMarker);
    }
    playerMarker = L.circleMarker([0, 0], {
        color: 'green',
        fillColor: '#0f3',
        fillOpacity: 0.8,
        radius: 6
    }).addTo(playerMap).bindPopup('Tu ubicación');

    startGpsWatch(targetLat, targetLng, tolerance);
}

function startGpsWatch(targetLat, targetLng, tolerance) {
    if (gpsWatchId) {
        stopGpsWatch();
    }

    if (!navigator.geolocation) {
        showAlert('Tu navegador no soporta geolocalización.', 'error');
        showModal('Error GPS', 'Tu navegador no soporta la API de geolocalización, necesaria para pruebas GPS.');
        return;
    }

    const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
    };

    gpsWatchId = navigator.geolocation.watchPosition(
        async (position) => {
            const { latitude, longitude } = position.coords;
            playerMarker.setLatLng([latitude, longitude]);
            playerMap.panTo([latitude, longitude]);

            const distance = getDistance(latitude, longitude, targetLat, targetLng);
            console.log(`Distancia al objetivo: ${distance.toFixed(2)} metros`);

            // Asegurarse de usar tolerance_meters del trial
            if (distance <= currentTrial.tolerance_meters) {
                showAlert('¡Ubicación alcanzada! Validando prueba...', 'success');
                stopGpsWatch();
                await completeTrial(currentGame.initial_score_per_trial || 100);
            }
        },
        (error) => {
            console.error('Error de geolocalización:', error);
            let errorMessage = '';
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = 'Permiso de geolocalización denegado. Por favor, habilítalo en la configuración de tu navegador.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = 'Información de ubicación no disponible.';
                    break;
                case error.TIMEOUT:
                    errorMessage = 'La solicitud de ubicación ha caducado.';
                    break;
                case error.UNKNOWN_ERROR:
                    errorMessage = 'Un error desconocido ocurrió al obtener la ubicación.';
                    break;
            }
            showModal('Error GPS', errorMessage + ' Asegúrate de tener buena señal GPS.');
        },
        options
    );
}

function stopGpsWatch() {
    if (gpsWatchId !== null) {
        navigator.geolocation.clearWatch(gpsWatchId);
        gpsWatchId = null;
        console.log('GPS watch stopped.');
    }
    if (gpsMapContainer) {
        gpsMapContainer.classList.add('hidden');
    }
    if (playerMap) {
        playerMap.invalidateSize();
    }
}

// --- QR Scanner Functions ---
if (qrScanBtn) {
    qrScanBtn.addEventListener('click', () => {
        if (qrScanning) {
            stopQrScanner();
            qrScanBtn.textContent = 'Escanear QR';
            qrResultDisplay.textContent = 'Escáner detenido.';
        } else {
            startQrScanner();
            qrScanBtn.textContent = 'Detener Escáner';
            qrResultDisplay.textContent = 'Scanning...';
        }
    });
}


function startQrScanner() {
    qrScannerContainer.classList.remove('hidden');
    if (qrScanner) {
        qrScanner.clear();
    }

    qrScanner = new Html5Qrcode("qr-scanner");
    const qrCodeSuccessCallback = async (decodedText, decodedResult) => {
        stopQrScanner();
        qrResultDisplay.textContent = decodedText;
        showAlert('QR Escaneado: ' + decodedText, 'info');

        if (currentTrial && currentTrial.trial_type === 'QR' && currentTrial.qr_content === decodedText) { // Usando 'trial_type'
            showAlert('¡QR Correcto! Validando prueba...', 'success');
            await completeTrial(currentGame.initial_score_per_trial || 100); // Usando initial_score_per_trial
        } else {
            showAlert('QR incorrecto o no corresponde a esta prueba.', 'error');
        }
    };

    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    qrScanner.start({ facingMode: "environment" }, config, qrCodeSuccessCallback)
        .catch((err) => {
            console.error("Error al iniciar el escáner QR:", err);
            showModal('Error Escáner QR', 'No se pudo iniciar la cámara. Asegúrate de dar permiso y de que no esté en uso por otra aplicación. ' + err.message);
            stopQrScanner();
        });
    qrScanning = true;
}

function stopQrScanner() {
    if (qrScanner && qrScanning) {
        qrScanner.stop().then(() => {
            console.log("QR scanner stopped.");
            qrScannerContainer.classList.add('hidden');
            qrScanning = false;
        }).catch((err) => {
            console.error("Error deteniendo el escáner QR:", err);
            qrScanning = false;
        });
    }
}

// --- Global Rankings ---
async function populateRankingGameSelect() {
    const { data, error } = await supabase
        .from('games')
        .select('id, title')
        .order('title', { ascending: true });

    if (error) {
        console.error('Error fetching games for rankings select:', error);
        showAlert('Error al cargar juegos para rankings.', 'error');
        return;
    }

    globalRankingsGameSelect.innerHTML = '<option value="">Todos los Juegos</option>';
    data.forEach(game => {
        const option = document.createElement('option');
        option.value = game.id;
        option.textContent = game.title;
        globalRankingsGameSelect.appendChild(option);
    });
}

async function fetchGlobalRankings(gameId = null) {
    let query = supabase
        .from('rankings')
        .select(`
            *,
            teams (name),
            games (title)
        `)
        .order('final_score', { ascending: false })
        .order('completion_time', { ascending: true });

    if (gameId) {
        query = query.eq('game_id', gameId);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching global rankings:', error);
        showAlert('Error al cargar rankings globales: ' + error.message, 'error');
        globalRankingsList.innerHTML = '<p>Error al cargar los rankings.</p>';
        return;
    }

    globalRankingsList.innerHTML = '';
    if (data.length === 0) {
        globalRankingsList.innerHTML = '<p class="info-message">No hay rankings disponibles para esta selección.</p>';
        return;
    }

    data.forEach((rank, index) => {
        const rankCard = document.createElement('div');
        rankCard.className = 'card ranking-card';
        rankCard.innerHTML = `
            <h3>#${index + 1} - ${rank.teams ? rank.teams.name : 'Equipo Desconocido'}</h3>
            <p>Puntuación Final: <span>${rank.final_score}</span></p>
            <p>Tiempo de Completado: <span>${formatTime(rank.completion_time)}</span></p>
            <p>Juego: <span>${rank.games ? rank.games.title : 'Desconocido'}</span></p>
            <p>Fecha: <span>${new Date(rank.completion_date).toLocaleDateString()}</span></p>
        `;
        globalRankingsList.appendChild(rankCard);
    });
}

// --- Event Listeners (Rest of the application) ---

if (backToGameSelectionBtn) {
    backToGameSelectionBtn.addEventListener('click', () => {
        showScreen(gameSelectionScreen);
        teamNameInput.value = ''; // Clear team name input
        fetchActiveGames();
    });
}

if (continueGameBtn) {
    continueGameBtn.addEventListener('click', continueFromFeedback);
}

if (playAgainBtn) {
    playAgainBtn.addEventListener('click', () => {
        currentTeam = null;
        currentGame = null;
        currentLocations = [];
        currentTrials = [];
        currentLocationIndex = 0;
        currentTrialIndex = 0;
        stopGlobalTimer();
        stopTrialTimer();
        stopGpsWatch();
        stopQrScanner();
        localStorage.removeItem('currentTeamId'); // Clear any residual state
        showScreen(gameSelectionScreen);
        fetchActiveGames();
    });
}

if (viewFinalRankingsBtn) {
    viewFinalRankingsBtn.addEventListener('click', () => {
        showScreen(globalRankingsScreen);
        populateRankingGameSelect();
        fetchGlobalRankings();
    });
}

if (globalRankingsGameSelect) {
    globalRankingsGameSelect.addEventListener('change', (e) => {
        const selectedGameId = e.target.value === '' ? null : e.target.value;
        fetchGlobalRankings(selectedGameId);
    });
}

if (backToMenuFromRankingsBtn) {
    backToMenuFromRankingsBtn.addEventListener('click', () => {
        showScreen(gameSelectionScreen);
        fetchActiveGames();
    });
}