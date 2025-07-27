// player-script.js

// Supabase ya está inicializado en player-supabase-config.js

// --- Global State Variables ---
let currentTeam = null; // Stores current team data from Supabase
let currentGame = null; // Stores current game data from Supabase
let currentLocations = []; // All locations for the current game
let currentTrials = []; // All trials for the current location
let currentLocationIndex = 0; // For linear games
let currentTrialIndex = 0; // For linear trials within a location

let gameTimerInterval = null;
let trialTimerInterval = null;
let trialStartTime = 0; // Timestamp when current trial started

let playerMap = null; // Leaflet map instance
let playerMarker = null; // Player's marker on the map
let targetMarker = null; // Target trial marker on the map
let gpsWatchId = null; // ID for navigator.geolocation.watchPosition

let qrScanner = null; // html5-qrcode instance

// --- DOM Elements ---
const loadingScreen = document.getElementById('loading-screen');
const welcomeScreen = document.getElementById('welcome-screen');
const gameSelectionScreen = document.getElementById('game-selection-screen');
const gameDetailsScreen = document.getElementById('game-details-screen');
const gameActiveScreen = document.getElementById('game-active-screen');
const gameCompletionScreen = document.getElementById('game-completion-screen');
const globalRankingsScreen = document.getElementById('global-rankings-screen');
const appAlert = document.getElementById('app-alert'); // Assuming it's in the main HTML

// Welcome Screen
const startAppBtn = document.getElementById('start-app-btn');

// Game Selection Screen
const activeGameList = document.getElementById('active-game-list');

// Game Details Screen
const gameDetailsTitle = document.getElementById('game-details-title');
const gameDetailsDescription = document.getElementById('game-details-description');
const gameDetailsMechanics = document.getElementById('game-details-mechanics');
const gameDetailsInitialNarrative = document.getElementById('game-details-initial-narrative');
const teamNameInput = document.getElementById('team-name-input');
const startGameBtn = document.getElementById('start-game-btn');
const backToGameSelectionBtn = document.getElementById('back-to-game-selection-btn');

// Game Active Screen
const activeGameTitle = document.getElementById('active-game-title');
const gameTimerDisplay = document.getElementById('game-timer');
const currentTeamNameDisplay = document.getElementById('current-team-name');
const currentTeamScoreDisplay = document.getElementById('current-team-score');

const preArrivalNarrativeDisplay = document.getElementById('pre-arrival-narrative-display');
const preArrivalNarrativeTitle = document.getElementById('pre-arrival-narrative-title');
const preArrivalNarrativeText = document.getElementById('pre-arrival-narrative-text');
const continueToLocationBtn = document.getElementById('continue-to-location-btn');

const currentLocationNarrativeDisplay = document.getElementById('current-location-narrative');
const currentLocationTitle = document.getElementById('current-location-title');
const currentLocationImage = document.getElementById('current-location-image');
const currentLocationAudio = document.getElementById('current-location-audio');
const currentLocationText = document.getElementById('current-location-text');
const continueToTrialsBtn = document.getElementById('continue-to-trials-btn');

const trialsListDisplay = document.getElementById('trials-list-display');
const trialsContainer = document.getElementById('trials-container');
const backToLocationListBtn = document.getElementById('back-to-location-list-btn');

const trialActiveDisplay = document.getElementById('trial-active-display');
const trialTitle = document.getElementById('trial-title');
const trialTimerDisplay = document.getElementById('trial-timer');
const trialImage = document.getElementById('trial-image');
const trialAudio = document.getElementById('trial-audio');
const trialNarrative = document.getElementById('trial-narrative');

const hintsRemainingDisplay = document.getElementById('hints-remaining-display');
const hintCostDisplay = document.getElementById('hint-cost-display');
const requestHintBtn = document.getElementById('request-hint-btn');
const hintDisplay = document.getElementById('hint-display');
const hintText = document.getElementById('hint-text');

// Trial specific fields
const gpsTrialFields = document.getElementById('gps-trial-fields');
const gpsMap = document.getElementById('gps-map');
const gpsStatusText = document.getElementById('gps-status-text');
const checkGpsBtn = document.getElementById('check-gps-btn');

const qrTrialFields = document.getElementById('qr-trial-fields');
const scanQrBtn = document.getElementById('scan-qr-btn');
const qrReader = document.getElementById('qr-reader');
const qrStatusText = document.getElementById('qr-status-text');

const textTrialFields = document.getElementById('text-trial-fields');
const textQuestion = document.getElementById('text-question');
const textAnswerInputContainer = document.getElementById('text-answer-input-container');
const submitTextAnswerBtn = document.getElementById('submit-text-answer-btn');

const backToTrialsListBtn = document.getElementById('back-to-trials-list-btn');

const feedbackDisplay = document.getElementById('feedback-display');
const feedbackTitle = document.getElementById('feedback-title');
const feedbackMessage = document.getElementById('feedback-message');
const continueGameBtn = document.getElementById('continue-game-btn');

// Game Completion Screen
const finalTeamName = document.getElementById('final-team-name');
const finalGameTitle = document.getElementById('final-game-title');
const finalScore = document.getElementById('final-score');
const finalTime = document.getElementById('final-time');
const playAgainBtn = document.getElementById('play-again-btn');
const viewFinalRankingsBtn = document.getElementById('view-final-rankings-btn');

// Global Rankings Screen
const globalRankingsGameSelect = document.getElementById('global-rankings-game-select');
const globalRankingsList = document.getElementById('global-rankings-list');
const backToMenuFromRankingsBtn = document.getElementById('back-to-menu-from-rankings-btn');


// --- Utility Functions ---

function showScreen(screenElement) {
    const screens = [
        loadingScreen, welcomeScreen, gameSelectionScreen, gameDetailsScreen,
        gameActiveScreen, gameCompletionScreen, globalRankingsScreen
    ];
    screens.forEach(screen => {
        if (screen === screenElement) {
            screen.classList.remove('hidden');
        } else {
            screen.classList.add('hidden');
        }
    });
    // Stop any media playing when changing screens
    if (currentLocationAudio.paused === false) currentLocationAudio.pause();
    if (trialAudio.paused === false) trialAudio.pause();
}

// Function to handle map initialization
function initPlayerMap(mapContainerId, centerLat, centerLon) {
    if (playerMap) {
        playerMap.remove(); // Clean up existing map
    }
    playerMap = L.map(mapContainerId).setView([centerLat, centerLon], 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(playerMap);
    playerMarker = L.marker([centerLat, centerLon], { icon: L.divIcon({className: 'player-marker', html: '🏃'}) }).addTo(playerMap);
}

function updatePlayerMap(lat, lon) {
    if (playerMarker) {
        playerMarker.setLatLng([lat, lon]);
        playerMap.setView([lat, lon]); // Keep player in center
    }
}

function addTargetMarker(lat, lon) {
    if (targetMarker) {
        playerMap.removeLayer(targetMarker); // Remove old target
    }
    targetMarker = L.marker([lat, lon], { icon: L.divIcon({className: 'target-marker', html: '🚩'}) }).addTo(playerMap);
}

function removeTargetMarker() {
    if (targetMarker) {
        playerMap.removeLayer(targetMarker);
        targetMarker = null;
    }
}

function startGpsWatch(targetLat, targetLon, tolerance) {
    if (gpsWatchId) {
        navigator.geolocation.clearWatch(gpsWatchId);
    }
    gpsStatusText.textContent = 'Buscando tu ubicación...';
    checkGpsBtn.disabled = true;

    gpsWatchId = navigator.geolocation.watchPosition(
        (position) => {
            const currentLat = position.coords.latitude;
            const currentLon = position.coords.longitude;
            const distance = getDistanceFromLatLonInMeters(targetLat, targetLon, currentLat, currentLon);

            updatePlayerMap(currentLat, currentLon); // Update player's position on map

            if (distance <= tolerance) {
                gpsStatusText.textContent = `¡Estás en la ubicación! Distancia: ${distance.toFixed(2)}m.`;
                showAlert('¡Ubicación alcanzada!', 'success');
                navigator.geolocation.clearWatch(gpsWatchId);
                gpsWatchId = null;
                completeTrial();
            } else {
                gpsStatusText.textContent = `Distancia al objetivo: ${distance.toFixed(2)}m.`;
                checkGpsBtn.disabled = false;
            }
        },
        (error) => {
            console.error("Error al obtener la ubicación GPS:", error);
            gpsStatusText.textContent = 'Error GPS: ' + error.message;
            checkGpsBtn.disabled = false;
            showAlert('Error GPS: ' + error.message, 'error');
            // If permissions denied, clear watch and stop trying
            if (error.code === error.PERMISSION_DENIED) {
                navigator.geolocation.clearWatch(gpsWatchId);
                gpsWatchId = null;
                showAlert('Permisos de ubicación denegados. No se podrá usar el GPS.', 'error', 5000);
            }
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
}

function stopGpsWatch() {
    if (gpsWatchId) {
        navigator.geolocation.clearWatch(gpsWatchId);
        gpsWatchId = null;
    }
}

// Haversine formula to calculate distance between two lat/lon points
function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
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

// Function to initialize QR scanner
function initQrScanner() {
    if (qrScanner) {
        qrScanner.clear(); // Clear previous instance if any
    }
    qrReader.innerHTML = ''; // Clear previous content

    qrScanner = new Html5Qrcode("qr-reader");
}

async function startQrScanner(expectedContent) {
    qrStatusText.textContent = 'Escaneando QR...';
    scanQrBtn.disabled = true;

    const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        rememberLastUsedCamera: true
    };

    try {
        await qrScanner.start({ facingMode: "environment" }, config,
            (decodedText, decodedResult) => {
                if (decodedText === expectedContent) {
                    qrStatusText.textContent = `QR correcto: ${decodedText}`;
                    showAlert('QR escaneado correctamente!', 'success');
                    qrScanner.stop().then(() => {
                        completeTrial();
                    }).catch(err => {
                        console.error("Error stopping QR scanner:", err);
                    });
                } else {
                    qrStatusText.textContent = `QR incorrecto: ${decodedText}`;
                    showAlert('QR incorrecto. Inténtalo de nuevo.', 'error');
                }
            },
            (errorMessage) => {
                // console.warn(`QR scan error: ${errorMessage}`);
            }
        );
        showAlert('Cámara QR iniciada.', 'info');
    } catch (err) {
        console.error("Error starting QR scanner:", err);
        qrStatusText.textContent = 'Error al iniciar la cámara QR.';
        showAlert('No se pudo iniciar la cámara QR. Asegúrate de dar permisos.', 'error', 5000);
        scanQrBtn.disabled = false;
    }
}

async function stopQrScanner() {
    if (qrScanner && qrScanner.is='qr' && qrScanner.getState() === Html5QrcodeSupportedFormats.CameraDeviceScan.state) { // Check if scanner is running
        try {
            await qrScanner.stop();
        } catch (err) {
            console.warn("Error stopping QR scanner:", err);
        }
    }
}


// --- Game Flow Functions ---

document.addEventListener('DOMContentLoaded', () => {
    // Initial load: check if team is persisted locally
    loadPersistedTeamState();
    // Simulate loading, then show welcome or game active screen
    setTimeout(() => {
        hideScreen(loadingScreen);
        if (currentTeam && currentGame) {
            showScreen(gameActiveScreen);
            // Resume game from saved state
            resumeGame();
        } else {
            showScreen(welcomeScreen);
        }
    }, 1000);
});

async function loadPersistedTeamState() {
    const persistedTeamId = localStorage.getItem('currentTeamId');
    if (persistedTeamId) {
        const { data: team, error: teamError } = await supabase
            .from('teams')
            .select('*')
            .eq('id', persistedTeamId)
            .single();

        if (team && !teamError && !team.is_completed) {
            currentTeam = team;
            // Fetch game data
            const { data: game, error: gameError } = await supabase
                .from('games')
                .select('*')
                .eq('id', currentTeam.game_id)
                .single();

            if (game && !gameError) {
                currentGame = game;
                showAlert(`Juego reanudado para el equipo: ${currentTeam.name}`, 'info');
                return true;
            } else if (gameError) {
                console.error("Error fetching game for persisted team:", gameError);
                showAlert("No se pudo cargar la información del juego.", 'error');
            }
        } else if (team && team.is_completed) {
            showAlert(`Tu última partida con ${team.name} ya está completada. Puedes ver los rankings o empezar una nueva.`, 'info', 6000);
            localStorage.removeItem('currentTeamId'); // Clear completed game
        } else if (teamError) {
            console.error("Error fetching persisted team:", teamError);
            showAlert("No se pudo cargar el progreso del equipo.", 'error');
            localStorage.removeItem('currentTeamId'); // Clear invalid persistence
        }
    }
    return false;
}

// Function to save team state to localStorage
function saveTeamStateLocally() {
    if (currentTeam) {
        localStorage.setItem('currentTeamId', currentTeam.id);
    } else {
        localStorage.removeItem('currentTeamId');
    }
}

async function fetchActiveGames() {
    activeGameList.innerHTML = '<p>Cargando juegos activos...</p>';
    const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching active games:', error);
        showAlert('Error al cargar juegos activos: ' + error.message, 'error');
        activeGameList.innerHTML = '<p>Error al cargar los juegos.</p>';
        return;
    }

    if (data.length === 0) {
        activeGameList.innerHTML = '<p>No hay juegos activos en este momento. Vuelve más tarde.</p>';
        return;
    }

    activeGameList.innerHTML = '';
    data.forEach(game => {
        const gameCard = document.createElement('div');
        gameCard.classList.add('game-card');
        gameCard.innerHTML = `
            <h3>${game.title}</h3>
            <p>${game.description}</p>
            <p>Tipo: ${game.adventure_type === 'linear' ? 'Lineal' : 'Seleccionable'}</p>
        `;
        gameCard.addEventListener('click', () => selectGame(game));
        activeGameList.appendChild(gameCard);
    });
}

function selectGame(game) {
    currentGame = game;
    gameDetailsTitle.textContent = game.title;
    gameDetailsDescription.textContent = game.description;
    gameDetailsMechanics.textContent = game.mechanics;
    gameDetailsInitialNarrative.textContent = game.initial_narrative;
    showScreen(gameDetailsScreen);
}

async function startGame() {
    const teamName = teamNameInput.value.trim();
    if (!teamName) {
        showAlert('Por favor, introduce un nombre para tu equipo.', 'warning');
        return;
    }
    if (!currentGame) {
        showAlert('No hay un juego seleccionado. Por favor, vuelve a la pantalla de selección.', 'error');
        return;
    }

    startGameBtn.disabled = true; // Prevent double submission

    // Check for existing team, if joining is implemented
    // For now, assume creating new or rejoining only by ID (persisted)
    // If we want actual "join by name", need to implement a lobby mechanism.
    // For simplicity, let's assume if teamName and gameId exist, it's a rejoin for score update,
    // otherwise create new. This simple version assumes a new team if no currentTeamId persisted.

    let teamData = {
        name: teamName,
        game_id: currentGame.id,
        current_location_id: null,
        current_trial_id: null,
        start_time: new Date().toISOString(),
        last_trial_start_time: new Date().toISOString(),
        pistas_used_global: 0,
        pistas_used_per_trial: [],
        total_time_seconds: 0,
        total_score: 0,
        progress_log: [],
        last_activity: new Date().toISOString(),
        is_completed: false
    };

    const { data: newTeam, error } = await supabase
        .from('teams')
        .insert([teamData])
        .select() // Select the newly inserted row
        .single();

    if (error) {
        console.error('Error starting game:', error);
        showAlert('Error al iniciar el juego: ' + error.message, 'error');
        startGameBtn.disabled = false;
        return;
    }

    currentTeam = newTeam;
    saveTeamStateLocally(); // Persist team ID
    showAlert(`¡Equipo ${currentTeam.name} registrado!`, 'success');

    // Fetch locations for the game
    await fetchGameLocations(currentGame.id);

    // Initialize timers and UI
    gameTimerDisplay.textContent = '00:00:00';
    currentTeamNameDisplay.textContent = currentTeam.name;
    currentTeamScoreDisplay.textContent = currentGame.initial_score_per_trial; // Start with initial score value (not total_score yet)

    // Start global game timer
    startGlobalTimer();

    // Begin game flow with the first location/trial
    await advanceGame();
}

async function resumeGame() {
    if (!currentTeam || !currentGame) {
        showAlert('No se pudo reanudar el juego. Empezando de nuevo.', 'error');
        showScreen(welcomeScreen);
        return;
    }

    showAlert(`Reanudando juego para ${currentTeam.name}`, 'info');

    // Fetch locations for the game
    await fetchGameLocations(currentGame.id);

    // Restore UI from currentTeam state
    activeGameTitle.textContent = currentGame.title;
    currentTeamNameDisplay.textContent = currentTeam.name;
    currentTeamScoreDisplay.textContent = currentTeam.total_score;
    gameTimerDisplay.textContent = formatTime(currentTeam.total_time_seconds);

    startGlobalTimer(); // Resume game timer

    // Determine where to resume
    if (currentTeam.is_completed) {
        completeGame(); // Should not happen if filtered, but safety check
    } else if (currentTeam.current_trial_id) {
        // Find the location and trial
        const currentLoc = currentLocations.find(loc => loc.id === currentTeam.current_location_id);
        const currentT = currentTrials.find(trial => trial.id === currentTeam.current_trial_id);
        if (currentLoc && currentT) {
             // Re-fetch trials for current location in case currentTrials is empty from previous state
            await fetchLocationTrials(currentLoc.id);
            // Ensure indices are correct for linear flow
            if (currentGame.adventure_type === 'linear' && !currentLoc.is_selectable_trials) {
                currentLocationIndex = currentLocations.findIndex(loc => loc.id === currentLoc.id);
                currentTrialIndex = currentTrials.findIndex(trial => trial.id === currentT.id);
            }
            displayTrial(currentT); // Go directly to the trial
        } else {
            // Something is off, reset to the beginning of game flow for that team's game
            showAlert('El progreso del juego está corrupto. Volviendo al inicio de la aventura.', 'warning');
            currentTeam.current_location_id = null;
            currentTeam.current_trial_id = null;
            await updateTeamStateInSupabase(currentTeam);
            await advanceGame(); // Restart game from first location
        }
    } else if (currentTeam.current_location_id) {
        // Player was at a location narrative, or selecting trials
        const currentLoc = currentLocations.find(loc => loc.id === currentTeam.current_location_id);
        if (currentLoc) {
            await fetchLocationTrials(currentLoc.id);
            if (currentLoc.pre_arrival_narrative && !currentTeam.progress_log.some(log => log.type === 'location_reached' && log.id === currentLoc.id)) {
                displayPreArrivalNarrative(currentLoc);
            } else {
                displayLocationNarrative(currentLoc);
            }
        } else {
            showAlert('El progreso de la ubicación está corrupto. Volviendo al inicio de la aventura.', 'warning');
            currentTeam.current_location_id = null;
            currentTeam.current_trial_id = null;
            await updateTeamStateInSupabase(currentTeam);
            await advanceGame(); // Restart game from first location
        }
    } else {
        // No current location or trial, start from the beginning
        await advanceGame();
    }
}

async function fetchGameLocations(gameId) {
    const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('game_id', gameId)
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching locations:', error);
        showAlert('Error al cargar las ubicaciones del juego: ' + error.message, 'error');
        return;
    }
    currentLocations = data;
}

async function fetchLocationTrials(locationId) {
    const { data, error } = await supabase
        .from('trials')
        .select('*')
        .eq('location_id', locationId)
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching trials for location:', error);
        showAlert('Error al cargar las pruebas de la ubicación: ' + error.message, 'error');
        return;
    }
    currentTrials = data;
}

async function advanceGame() {
    showScreen(gameActiveScreen);
    activeGameTitle.textContent = currentGame.title;
    currentTeamNameDisplay.textContent = currentTeam.name;
    currentTeamScoreDisplay.textContent = currentTeam.total_score;

    if (!currentLocations || currentLocations.length === 0) {
        showAlert('Este juego no tiene ubicaciones configuradas.', 'error');
        return;
    }

    let nextLocation = null;
    if (currentGame.adventure_type === 'linear') {
        // Find the next uncompleted location based on order_index
        const completedLocationIds = currentTeam.progress_log
            .filter(log => log.type === 'location_completed')
            .map(log => log.id);

        nextLocation = currentLocations.find(loc => !completedLocationIds.includes(loc.id));
        if (nextLocation) {
            currentLocationIndex = currentLocations.findIndex(loc => loc.id === nextLocation.id);
        }

    } else { // Selectable game, player chooses location from a map/list
        // This is more complex, might require a map view or list of all uncompleted locations
        // For now, let's assume it leads to a list/map of all available locations for selection
        // This needs a separate UI to display all locations and let players choose.
        showAlert('Juego seleccionable: esta funcionalidad aún no está implementada. Se cargará como lineal por ahora.', 'info');
        nextLocation = currentLocations[currentLocationIndex];
    }

    if (nextLocation) {
        // Update current_location_id in team state
        currentTeam.current_location_id = nextLocation.id;
        currentTeam.current_trial_id = null; // Reset trial when moving to new location
        await updateTeamStateInSupabase(currentTeam);
        await fetchLocationTrials(nextLocation.id); // Fetch trials for this new location

        // Check for pre-arrival narrative
        const hasReachedLocation = currentTeam.progress_log.some(log => log.type === 'location_reached' && log.id === nextLocation.id);

        if (nextLocation.pre_arrival_narrative && !hasReachedLocation) {
            displayPreArrivalNarrative(nextLocation);
        } else {
            displayLocationNarrative(nextLocation);
        }
    } else {
        // All locations completed, game finished
        completeGame();
    }
}

function displayPreArrivalNarrative(location) {
    currentLocationNarrativeDisplay.classList.add('hidden');
    trialsListDisplay.classList.add('hidden');
    trialActiveDisplay.classList.add('hidden');
    feedbackDisplay.classList.add('hidden');

    preArrivalNarrativeTitle.textContent = location.name;
    preArrivalNarrativeText.textContent = location.pre_arrival_narrative;
    preArrivalNarrativeDisplay.classList.remove('hidden');

    // Log that pre-arrival narrative was shown (optional, could be part of location_reached)
    // For now, we'll log location_reached only when continuing from here.
}

async function markLocationReached(location) {
    // Log location reached if not already logged
    if (!currentTeam.progress_log.some(log => log.type === 'location_reached' && log.id === location.id)) {
        currentTeam.progress_log.push({
            type: 'location_reached',
            id: location.id,
            name: location.name,
            timestamp: new Date().toISOString(),
            time_at_reached: currentTeam.total_time_seconds
        });
        await updateTeamStateInSupabase(currentTeam);
    }
}

async function displayLocationNarrative(location) {
    preArrivalNarrativeDisplay.classList.add('hidden');
    trialsListDisplay.classList.add('hidden');
    trialActiveDisplay.classList.add('hidden');
    feedbackDisplay.classList.add('hidden');

    await markLocationReached(location); // Mark location as reached here

    currentLocationTitle.textContent = location.name;
    currentLocationText.textContent = location.initial_narrative;

    if (location.image_url) {
        currentLocationImage.src = location.image_url;
        currentLocationImage.classList.remove('hidden');
    } else {
        currentLocationImage.classList.add('hidden');
    }

    if (location.audio_url) {
        currentLocationAudio.src = location.audio_url;
        currentLocationAudio.classList.remove('hidden');
        currentLocationAudio.play().catch(e => console.error("Error playing audio:", e));
    } else {
        currentLocationAudio.classList.add('hidden');
    }

    currentLocationNarrativeDisplay.classList.remove('hidden');
}

async function showTrialsForLocation(locationId, isSelectable) {
    currentLocationNarrativeDisplay.classList.add('hidden');
    trialActiveDisplay.classList.add('hidden');
    feedbackDisplay.classList.add('hidden');
    trialsListDisplay.classList.remove('hidden');
    stopQrScanner(); // Ensure QR scanner is stopped if we're coming from a trial

    await fetchLocationTrials(locationId); // Ensure trials are up-to-date

    trialsContainer.innerHTML = '';
    if (currentTrials.length === 0) {
        trialsContainer.innerHTML = '<p>No hay pruebas en esta ubicación.</p>';
        return;
    }

    const completedTrialIds = currentTeam.progress_log
        .filter(log => log.type === 'trial_completed')
        .map(log => log.id);

    if (isSelectable) {
        // Display all trials as selectable cards
        currentTrials.forEach(trial => {
            const trialCard = document.createElement('div');
            trialCard.classList.add('trial-card');
            if (completedTrialIds.includes(trial.id)) {
                trialCard.classList.add('completed');
                trialCard.innerHTML = `<h3>${trial.narrative || trial.question} ✅</h3><p>Completada</p>`;
                trialCard.style.opacity = '0.7';
                trialCard.style.cursor = 'default';
            } else {
                trialCard.innerHTML = `<h3>${trial.narrative || trial.question}</h3><p>Tipo: ${trial.trial_type.toUpperCase()}</p>`;
                trialCard.addEventListener('click', () => displayTrial(trial));
            }
            trialsContainer.appendChild(trialCard);
        });
        backToLocationListBtn.classList.remove('hidden');
    } else {
        // Linear flow: find next uncompleted trial
        const nextTrial = currentTrials.find(trial => !completedTrialIds.includes(trial.id));
        if (nextTrial) {
            currentTrialIndex = currentTrials.findIndex(trial => trial.id === nextTrial.id);
            displayTrial(nextTrial);
            backToLocationListBtn.classList.add('hidden'); // No need to go back if linear
        } else {
            // All trials in this location completed
            markLocationCompleted(currentTeam.current_location_id);
        }
    }
}

async function markLocationCompleted(locationId) {
    if (!currentTeam.progress_log.some(log => log.type === 'location_completed' && log.id === locationId)) {
        currentTeam.progress_log.push({
            type: 'location_completed',
            id: locationId,
            name: currentLocations.find(loc => loc.id === locationId)?.name || 'Desconocida',
            timestamp: new Date().toISOString(),
            time_at_completion: currentTeam.total_time_seconds,
            score_at_completion: currentTeam.total_score
        });
        await updateTeamStateInSupabase(currentTeam);
        showAlert('¡Ubicación completada!', 'success');
    }
    advanceGame(); // Move to next location or complete game
}


async function displayTrial(trial) {
    trialsListDisplay.classList.add('hidden');
    feedbackDisplay.classList.add('hidden');
    trialActiveDisplay.classList.remove('hidden');

    currentTeam.current_trial_id = trial.id;
    currentTeam.last_trial_start_time = new Date().toISOString();
    await updateTeamStateInSupabase(currentTeam);

    trialTitle.textContent = trial.narrative || trial.question || `Prueba ${trial.trial_type.toUpperCase()}`;
    trialNarrative.textContent = trial.narrative;

    if (trial.image_url) {
        trialImage.src = trial.image_url;
        trialImage.classList.remove('hidden');
    } else {
        trialImage.classList.add('hidden');
    }

    if (trial.audio_url) {
        trialAudio.src = trial.audio_url;
        trialAudio.classList.remove('hidden');
        trialAudio.play().catch(e => console.error("Error playing audio:", e));
    } else {
        trialAudio.classList.add('hidden');
    }

    // Reset hints UI
    hintDisplay.classList.add('hidden');
    hintText.textContent = '';
    requestHintBtn.disabled = false;
    // Get hints used for this trial from progress_log or team.pistas_used_per_trial
    const usedHintsCount = currentTeam.pistas_used_per_trial.find(pu => pu.trialId === trial.id)?.count || 0;
    hintsRemainingDisplay.textContent = Math.max(0, trial.hint_count - usedHintsCount);
    hintCostDisplay.textContent = trial.hint_cost;

    // Hide all specific fields first
    gpsTrialFields.classList.add('hidden');
    qrTrialFields.classList.add('hidden');
    textTrialFields.classList.add('hidden');
    stopGpsWatch(); // Stop GPS watch from previous trial
    stopQrScanner(); // Stop QR scanner from previous trial

    // Show fields based on trial type
    if (trial.trial_type === 'gps') {
        gpsTrialFields.classList.remove('hidden');
        initPlayerMap('gps-map', trial.latitude, trial.longitude);
        addTargetMarker(trial.latitude, trial.longitude);
        startGpsWatch(trial.latitude, trial.longitude, trial.tolerance_meters);
    } else if (trial.trial_type === 'qr') {
        qrTrialFields.classList.remove('hidden');
        initQrScanner();
        // The QR scanner will be started when scanQrBtn is clicked.
        qrStatusText.textContent = 'Presiona "Escanear Código QR"';
        scanQrBtn.disabled = false;
    } else if (trial.trial_type === 'text') {
        textTrialFields.classList.remove('hidden');
        textQuestion.textContent = trial.question;
        textAnswerInputContainer.innerHTML = ''; // Clear previous input

        if (trial.answer_type === 'single_choice' || trial.answer_type === 'numeric') {
            const input = document.createElement('input');
            input.type = trial.answer_type === 'numeric' ? 'number' : 'text';
            input.id = 'text-answer-input';
            input.placeholder = trial.answer_type === 'numeric' ? 'Introduce tu número' : 'Introduce tu respuesta';
            textAnswerInputContainer.appendChild(input);
        } else if (trial.answer_type === 'multiple_options') {
            trial.options.forEach((option, index) => {
                const div = document.createElement('div');
                div.className = 'option-item';
                const input = document.createElement('input');
                input.type = 'radio';
                input.name = 'text-option';
                input.id = `option-${index}`;
                input.value = option;
                const label = document.createElement('label');
                label.htmlFor = `option-${index}`;
                label.textContent = option;
                div.appendChild(input);
                div.appendChild(label);
                textAnswerInputContainer.appendChild(div);
            });
        } else if (trial.answer_type === 'ordering') {
            // Drag and drop for ordering (more complex, for future implementation)
            // For now, let's use a simple text input asking for comma-separated order.
            // Or display selectable items and collect their order.
            // For MVP, ask for comma-separated answer.
            const p = document.createElement('p');
            p.textContent = `Ordena las siguientes opciones (separadas por ;): ${trial.options.join('; ')}`;
            textAnswerInputContainer.appendChild(p);
            const input = document.createElement('input');
            input.type = 'text';
            input.id = 'text-answer-input';
            input.placeholder = 'Ej: Opción1;Opción2;Opción3';
            textAnswerInputContainer.appendChild(input);
        }
    }

    // Start trial timer
    clearInterval(trialTimerInterval);
    trialStartTime = Date.now();
    trialTimerDisplay.textContent = '00:00';
    trialTimerInterval = setInterval(updateTrialTimer, 1000);

    const currentLoc = currentLocations.find(loc => loc.id === currentTeam.current_location_id);
    if (currentLoc && currentLoc.is_selectable_trials) {
        backToTrialsListBtn.classList.remove('hidden');
    } else {
        backToTrialsListBtn.classList.add('hidden');
    }
}

async function validateTextAnswer(trial) {
    let userAnswer;
    if (trial.answer_type === 'single_choice' || trial.answer_type === 'numeric' || trial.answer_type === 'ordering') {
        userAnswer = document.getElementById('text-answer-input').value.trim();
        if (trial.answer_type === 'numeric') {
            userAnswer = parseFloat(userAnswer);
            // Ensure comparison is numeric
            trial.correct_answer = parseFloat(trial.correct_answer);
        } else if (trial.answer_type === 'ordering') {
            // Normalize both answers for comparison
            userAnswer = userAnswer.split(';').map(s => s.trim()).filter(s => s !== '').join(';');
            trial.correct_answer = trial.correct_answer.split(';').map(s => s.trim()).filter(s => s !== '').join(';');
        }
    } else if (trial.answer_type === 'multiple_options') {
        const selectedRadio = document.querySelector('input[name="text-option"]:checked');
        userAnswer = selectedRadio ? selectedRadio.value : '';
    }

    if (userAnswer === '' || userAnswer === null) {
        showAlert('Por favor, ingresa una respuesta.', 'warning');
        return;
    }

    if (userAnswer == trial.correct_answer) { // Use == for loose comparison (e.g., numeric string vs number)
        showAlert('¡Respuesta Correcta!', 'success');
        completeTrial();
    } else {
        showAlert('Respuesta Incorrecta. Inténtalo de nuevo.', 'error');
        // Optional: penalize for incorrect attempts
    }
}

async function requestHint() {
    const trial = currentTrials.find(t => t.id === currentTeam.current_trial_id);
    if (!trial) return;

    let usedHintsCount = currentTeam.pistas_used_per_trial.find(pu => pu.trialId === trial.id)?.count || 0;

    if (usedHintsCount >= trial.hint_count) {
        showAlert('No quedan más pistas para esta prueba.', 'warning');
        requestHintBtn.disabled = true;
        return;
    }

    usedHintsCount++;
    hintsRemainingDisplay.textContent = Math.max(0, trial.hint_count - usedHintsCount);

    // Update hints used in currentTeam object
    const hintEntryIndex = currentTeam.pistas_used_per_trial.findIndex(pu => pu.trialId === trial.id);
    if (hintEntryIndex !== -1) {
        currentTeam.pistas_used_per_trial[hintEntryIndex].count = usedHintsCount;
    } else {
        currentTeam.pistas_used_per_trial.push({ trialId: trial.id, count: usedHintsCount });
    }
    currentTeam.pistas_used_global = (currentTeam.pistas_used_global || 0) + 1; // Increment global count

    // Display the hint
    let hintToShow = '';
    if (usedHintsCount === 1) hintToShow = trial.hint1;
    else if (usedHintsCount === 2) hintToShow = trial.hint2;
    else if (usedHintsCount === 3) hintToShow = trial.hint3;

    if (hintToShow) {
        hintText.textContent = hintToShow;
        hintDisplay.classList.remove('hidden');
        showAlert(`Pista solicitada. Coste: ${trial.hint_cost} puntos.`, 'info');

        // Apply penalty immediately
        currentTeam.total_score = Math.max(0, currentTeam.total_score - trial.hint_cost); // Ensure score doesn't go negative
        currentTeamScoreDisplay.textContent = currentTeam.total_score;
        await updateTeamStateInSupabase(currentTeam);
    } else {
        showAlert('No hay contenido para esta pista.', 'warning');
    }

    if (usedHintsCount >= trial.hint_count) {
        requestHintBtn.disabled = true;
    }
}


async function completeTrial() {
    stopGpsWatch(); // Ensure GPS is off
    stopQrScanner(); // Ensure QR scanner is off
    clearInterval(trialTimerInterval); // Stop trial timer

    const trial = currentTrials.find(t => t.id === currentTeam.current_trial_id);
    if (!trial) return;

    const timeTakenSeconds = Math.floor((Date.now() - trialStartTime) / 1000);
    const initialScore = currentGame.initial_score_per_trial || 100; // Default if not set
    const scoreDeductionPerSecond = 1; // 1 point per second

    let scoreEarned = Math.max(0, initialScore - (timeTakenSeconds * scoreDeductionPerSecond));

    // Pista deductions are already applied when requested

    // Update team score and total time
    currentTeam.total_score = (currentTeam.total_score || 0) + scoreEarned;
    currentTeam.total_time_seconds = (currentTeam.total_time_seconds || 0) + timeTakenSeconds;

    // Log trial completion
    currentTeam.progress_log.push({
        type: 'trial_completed',
        id: trial.id,
        name: trial.narrative || trial.question,
        timestamp: new Date().toISOString(),
        time_taken_seconds: timeTakenSeconds,
        score_earned: scoreEarned,
        pistas_used: currentTeam.pistas_used_per_trial.find(pu => pu.trialId === trial.id)?.count || 0
    });
    currentTeam.current_trial_id = null; // Mark trial as completed

    await updateTeamStateInSupabase(currentTeam);
    currentTeamScoreDisplay.textContent = currentTeam.total_score;

    displayFeedback('¡Prueba Completada!', `Ganaste ${scoreEarned} puntos en ${formatTime(timeTakenSeconds)}.`, 'success');
}

function displayFeedback(title, message, type) {
    trialActiveDisplay.classList.add('hidden');
    feedbackDisplay.classList.remove('hidden');
    feedbackDisplay.className = `feedback-display feedback-${type}`; // Update classes

    feedbackTitle.textContent = title;
    feedbackMessage.textContent = message;
}

async function continueFromFeedback() {
    // Determine next step based on game type and current progress
    const currentLoc = currentLocations.find(loc => loc.id === currentTeam.current_location_id);
    if (!currentLoc) {
        // This should not happen, but for safety
        showAlert('Error: Ubicación actual no encontrada. Volviendo al inicio del juego.', 'error');
        advanceGame();
        return;
    }

    const completedTrialIds = currentTeam.progress_log
        .filter(log => log.type === 'trial_completed')
        .map(log => log.id);
    const remainingTrialsInLocation = currentTrials.filter(trial => !completedTrialIds.includes(trial.id));

    if (currentLoc.is_selectable_trials) {
        if (remainingTrialsInLocation.length > 0) {
            // Go back to the list of trials for this location
            showTrialsForLocation(currentLoc.id, true);
        } else {
            // All trials in this selectable location are completed
            markLocationCompleted(currentLoc.id);
        }
    } else { // Linear trials
        if (remainingTrialsInLocation.length > 0) {
            // Advance to the next linear trial
            const nextTrial = remainingTrialsInLocation[0]; // Already ordered
            displayTrial(nextTrial);
        } else {
            // All trials in this linear location are completed
            markLocationCompleted(currentLoc.id);
        }
    }
}


async function completeGame() {
    clearInterval(gameTimerInterval); // Stop game timer
    stopGpsWatch(); // Ensure GPS is off
    stopQrScanner(); // Ensure QR scanner is off

    currentTeam.is_completed = true;
    currentTeam.completion_time = new Date().toISOString();
    await updateTeamStateInSupabase(currentTeam);
    localStorage.removeItem('currentTeamId'); // Clear local storage for completed game

    finalTeamName.textContent = currentTeam.name;
    finalGameTitle.textContent = currentGame.title;
    finalScore.textContent = currentTeam.total_score;
    finalTime.textContent = formatTime(currentTeam.total_time_seconds);

    showScreen(gameCompletionScreen);
    showAlert('¡Felicidades, has completado la aventura!', 'success', 5000);
}

// --- Timers ---
function startGlobalTimer() {
    clearInterval(gameTimerInterval);
    gameTimerInterval = setInterval(() => {
        if (currentTeam) {
            currentTeam.total_time_seconds = (currentTeam.total_time_seconds || 0) + 1;
            gameTimerDisplay.textContent = formatTime(currentTeam.total_time_seconds);
            // Consider periodically updating Supabase, but not every second
            // e.g., every 30 seconds or on screen change/important event
        }
    }, 1000);
}

function updateTrialTimer() {
    const elapsedSeconds = Math.floor((Date.now() - trialStartTime) / 1000);
    trialTimerDisplay.textContent = formatTime(elapsedSeconds);
}

// --- Supabase Interaction Helpers ---

async function updateTeamStateInSupabase(teamData) {
    teamData.last_activity = new Date().toISOString(); // Update last activity timestamp
    const { error } = await supabase
        .from('teams')
        .update(teamData)
        .eq('id', teamData.id);

    if (error) {
        console.error('Error updating team state:', error);
        showAlert('Error al guardar progreso: ' + error.message, 'error');
        // Implement retry logic or a more robust sync if needed
    }
}

// --- Global Rankings ---
async function fetchGlobalRankings(gameId = null) {
    globalRankingsList.innerHTML = '<p>Cargando rankings...</p>';
    let query = supabase.from('teams').select(`
        id,
        name,
        total_score,
        total_time_seconds,
        is_completed,
        games(title)
    `).eq('is_completed', true);

    if (gameId) {
        query = query.eq('game_id', gameId);
    }

    const { data: rankings, error } = await query
        .order('total_score', { ascending: false })
        .order('total_time_seconds', { ascending: true });

    if (error) {
        console.error('Error fetching global rankings:', error);
        showAlert('Error al cargar rankings globales: ' + error.message, 'error');
        globalRankingsList.innerHTML = '<p>Error al cargar los rankings.</p>';
        return;
    }

    if (rankings.length === 0) {
        globalRankingsList.innerHTML = '<p>No hay rankings disponibles para este juego.</p>';
        return;
    }

    globalRankingsList.innerHTML = '';
    rankings.forEach((rank, index) => {
        const rankingItem = document.createElement('div');
        rankingItem.classList.add('ranking-item');
        const totalMinutes = Math.floor(rank.total_time_seconds / 60);
        const remainingSeconds = rank.total_time_seconds % 60;
        rankingItem.innerHTML = `
            <div class="team-info">#${index + 1} ${rank.name} ${rank.games ? `(${rank.games.title})` : ''}</div>
            <div class="score-time">Puntuación: ${rank.total_score} | Tiempo: ${formatTime(rank.total_time_seconds)}</div>
        `;
        globalRankingsList.appendChild(rankingItem);
    });
}

async function populateRankingGameSelect() {
    const { data: games, error } = await supabase
        .from('games')
        .select('id, title')
        .order('title', { ascending: true });

    if (error) {
        console.error('Error fetching games for select:', error);
        return;
    }

    globalRankingsGameSelect.innerHTML = '<option value="">Todos los Juegos</option>';
    games.forEach(game => {
        const option = document.createElement('option');
        option.value = game.id;
        option.textContent = game.title;
        globalRankingsGameSelect.appendChild(option);
    });
}


// --- Event Listeners ---

// Welcome screen
startAppBtn.addEventListener('click', () => {
    showScreen(gameSelectionScreen);
    fetchActiveGames();
});

// Game Details screen
startGameBtn.addEventListener('click', startGame);
backToGameSelectionBtn.addEventListener('click', () => {
    showScreen(gameSelectionScreen);
    teamNameInput.value = ''; // Clear team name
    fetchActiveGames(); // Re-fetch games just in case
});

// Game Active Screen navigation
continueToLocationBtn.addEventListener('click', () => {
    const currentLoc = currentLocations.find(loc => loc.id === currentTeam.current_location_id);
    if (currentLoc) {
        displayLocationNarrative(currentLoc);
    }
});
continueToTrialsBtn.addEventListener('click', () => {
    const currentLoc = currentLocations.find(loc => loc.id === currentTeam.current_location_id);
    if (currentLoc) {
        showTrialsForLocation(currentLoc.id, currentLoc.is_selectable_trials);
    }
});
backToLocationListBtn.addEventListener('click', () => {
    // For selectable locations, return to the main location narrative
    const currentLoc = currentLocations.find(loc => loc.id === currentTeam.current_location_id);
    if (currentLoc) {
        displayLocationNarrative(currentLoc);
    }
});

// Trial specific interactions
checkGpsBtn.addEventListener('click', () => {
    const trial = currentTrials.find(t => t.id === currentTeam.current_trial_id);
    if (trial && trial.trial_type === 'gps') {
        startGpsWatch(trial.latitude, trial.longitude, trial.tolerance_meters);
    }
});

scanQrBtn.addEventListener('click', () => {
    const trial = currentTrials.find(t => t.id === currentTeam.current_trial_id);
    if (trial && trial.trial_type === 'qr') {
        startQrScanner(trial.qr_content);
    }
});

submitTextAnswerBtn.addEventListener('click', () => {
    const trial = currentTrials.find(t => t.id === currentTeam.current_trial_id);
    if (trial && trial.trial_type === 'text') {
        validateTextAnswer(trial);
    }
});

requestHintBtn.addEventListener('click', requestHint);

backToTrialsListBtn.addEventListener('click', () => {
    // If it's a selectable trial in a selectable location, go back to list
    const currentLoc = currentLocations.find(loc => loc.id === currentTeam.current_location_id);
    if (currentLoc && currentLoc.is_selectable_trials) {
        showTrialsForLocation(currentLoc.id, true);
    } else {
        // This button shouldn't be visible for linear trails, but as fallback
        showAlert('Error de navegación. Volviendo al inicio de la ubicación.', 'error');
        displayLocationNarrative(currentLoc);
    }
});

// Feedback screen
continueGameBtn.addEventListener('click', continueFromFeedback);

// Game Completion screen
playAgainBtn.addEventListener('click', () => {
    currentTeam = null;
    currentGame = null;
    currentLocations = [];
    currentTrials = [];
    currentLocationIndex = 0;
    currentTrialIndex = 0;
    clearInterval(gameTimerInterval);
    clearInterval(trialTimerInterval);
    stopGpsWatch();
    stopQrScanner();
    localStorage.removeItem('currentTeamId'); // Clear any residual state
    showScreen(gameSelectionScreen);
    fetchActiveGames();
});

viewFinalRankingsBtn.addEventListener('click', () => {
    showScreen(globalRankingsScreen);
    populateRankingGameSelect(); // Populate the dropdown
    fetchGlobalRankings(); // Show all rankings initially
});

// Global Rankings screen
globalRankingsGameSelect.addEventListener('change', (e) => {
    const selectedGameId = e.target.value === '' ? null : e.target.value;
    fetchGlobalRankings(selectedGameId);
});
backToMenuFromRankingsBtn.addEventListener('click', () => {
    showScreen(gameSelectionScreen);
    fetchActiveGames();
});


// Initial screen setup (handled by DOMContentLoaded)