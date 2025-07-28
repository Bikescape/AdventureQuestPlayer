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
// Cuidado: asegúrate de que todos estos IDs existen en player-index.html
const loadingScreen = document.getElementById('loading-screen');
const welcomeScreen = document.getElementById('welcome-screen');
const startNewGameFlowBtn = document.getElementById('start-new-game-flow-btn'); // Nuevo
const gameSelectionScreen = document.getElementById('game-selection-screen');
const gameListContainer = document.getElementById('game-list');
const gameDetailsScreen = document.getElementById('game-details-screen'); // Añadido
const teamNameInput = document.getElementById('team-name-input');
const createTeamBtn = document.getElementById('create-team-btn');
const joinGameBtn = document.getElementById('join-team-btn'); // Asumo que existe para el flujo de unirse a juego
const gameDetailsTitle = document.getElementById('game-details-title');
const gameDetailsDesc = document.getElementById('game-details-description');
const gameDetailsMechanics = document.getElementById('game-details-mechanics');
const gameDetailsNarrative = document.getElementById('game-details-narrative');
const backToGameSelectionBtn = document.getElementById('back-to-game-selection-btn'); // Nuevo

const gameActiveScreen = document.getElementById('game-active-screen');
const gameTotalTimeDisplay = document.getElementById('game-total-time');
const trialTimerDisplay = document.getElementById('trial-timer');
const currentScoreDisplay = document.getElementById('current-score'); // Añadido
const locationNarrativeSection = document.getElementById('location-narrative-section'); // Añadido para mostrar/ocultar secciones
const locationNarrativeDisplay = document.getElementById('location-narrative');

// Referencias específicas para cada tipo de prueba, para ocultar/mostrar secciones
const textTrialSection = document.getElementById('text-trial-section');
const qrTrialSection = document.getElementById('qr-trial-section');
const gpsTrialSection = document.getElementById('gps-trial-section');

// Elementos comunes de la prueba
const trialNarrativeDisplay = document.getElementById('trial-narrative');
const trialImage = document.getElementById('trial-image');
const trialAudio = document.getElementById('trial-audio');
const hintBtn = document.getElementById('hint-btn');
const hintCostDisplay = document.getElementById('hint-cost');
const hintsRemainingDisplay = document.getElementById('hints-remaining');

// Elementos de Prueba TEXT
const textQuestionDisplay = document.getElementById('text-question');
const textAnswerInput = document.getElementById('text-answer-input');
const textOptionsContainer = document.getElementById('text-options-container'); // For multiple choice/ordering
const validateAnswerBtn = document.getElementById('validate-answer-btn');

// Elementos de Prueba QR
const qrScannerContainer = document.getElementById('qr-scanner');
const qrScanBtn = document.getElementById('qr-scan-btn');
const qrResultDisplay = document.getElementById('qr-result');
// Referencias para QR hints (si tienen IDs separadas)
const qrHintBtn = document.getElementById('qr-hint-btn');
const qrHintCostDisplay = document.getElementById('qr-hint-cost');
const qrHintsRemainingDisplay = document.getElementById('qr-hints-remaining');

// Elementos de Prueba GPS
const gpsMapContainer = document.getElementById('gps-map');
// Referencias para GPS hints (si tienen IDs separadas)
const gpsHintBtn = document.getElementById('gps-hint-btn');
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

const appAlert = document.getElementById('app-alert'); // The toast alert
const modalContainer = document.getElementById('modal-container'); // The generic modal
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalCloseBtn = document.getElementById('modal-close-btn');


// --- Utility Functions (These can be moved to shared/utils.js for reusability if desired) ---

// Function to show/hide screens
function showScreen(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    screen.classList.remove('hidden');
}

// Function for toast alerts (brief messages at bottom)
function showAlert(message, type = 'info') {
    if (!appAlert) {
        console.warn('App alert element not found. Message:', message);
        console.log(`ALERT: ${message}`); // Fallback to console if element missing
        return;
    }
    appAlert.textContent = message;
    appAlert.className = `app-alert ${type}`; // Add type class for styling
    appAlert.style.display = 'block'; // Make it visible

    setTimeout(() => {
        appAlert.style.display = 'none'; // Hide after a delay
    }, 3000);
}

// Functions for the generic modal (the blank one with "Cerrar")
function showModal(title, message) {
    if (!modalContainer || !modalTitle || !modalMessage) {
        console.error('Error: Elementos del modal genérico no encontrados en el DOM. Mostrando alerta nativa.');
        alert(`Modal Content:\nTitle: ${title}\nMessage: ${message}`); // Fallback to native alert
        return;
    }
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modalContainer.classList.remove('hidden'); // Show the modal
    // console.log(`Modal Shown: ${title} - ${message}`); // Debugging
}

function hideModal() {
    if (modalContainer) {
        modalContainer.classList.add('hidden'); // Oculta el modal
        modalTitle.textContent = ''; // Clear content for next use
        modalMessage.textContent = '';
        // console.log('Modal Hidden.'); // Debugging
    }
}

// Time formatting function
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

// --- PWA Service Worker Registration ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Asegúrate de que el protocolo no sea 'null' (i.e., no 'file://')
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
    // Show loading screen initially
    showScreen(loadingScreen);

    // Add event listener for the generic modal close button
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', hideModal);
    } else {
        console.warn('Botón de cierre de modal genérico (#modal-close-btn) no encontrado al cargar el DOM.');
    }

    // Attempt to load current team from localStorage
    const storedTeamId = localStorage.getItem('currentTeamId');
    if (storedTeamId) {
        const teamLoaded = await loadTeamState(storedTeamId);
        if (teamLoaded && currentTeam) {
            // If team state loaded, go directly to game active screen
            showScreen(gameActiveScreen);
            // Re-initialize timers and current trial display
            resumeGameTimers();
            await displayCurrentTrial(); // Use await here as it might fetch data
            showAlert('Reanudando juego como equipo: ' + currentTeam.team_name, 'info');
            return; // Exit DOMContentLoaded as we're resuming
        } else {
            // If storedTeamId but team not found, clear it
            localStorage.removeItem('currentTeamId');
            showAlert('Tu sesión de juego anterior no pudo ser recuperada. Por favor, selecciona un juego de nuevo.', 'warning');
        }
    }

    // If no team state, show welcome screen first
    showScreen(welcomeScreen);
    // Games will be fetched when "Comenzar Aventura" is clicked
});

// --- Welcome Screen Logic ---
if (startNewGameFlowBtn) {
    startNewGameFlowBtn.addEventListener('click', () => {
        showScreen(gameSelectionScreen);
        fetchActiveGames(); // Fetch games when user decides to start
    });
}

// --- Supabase Interaction Functions ---

async function fetchActiveGames() {
    console.log('Fetching active games...');
    // Ensure supabase client is available
    if (!supabase) {
        showModal('Error de Conexión', 'La aplicación no pudo conectar con la base de datos. Por favor, recarga la página.');
        return;
    }

    const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('is_active', true);

    if (error) {
        console.error('Error fetching active games:', error);
        showModal('Error', 'No pudimos cargar los juegos activos. Por favor, intenta de nuevo más tarde. ' + error.message);
        return;
    }

    gameListContainer.innerHTML = ''; // Clear previous list
    if (data.length === 0) {
        gameListContainer.innerHTML = '<p class="info-message">No hay juegos activos disponibles en este momento. ¡Vuelve pronto!</p>';
        return;
    }

    data.forEach(game => {
        const gameCard = document.createElement('div');
        gameCard.className = 'game-card';
        gameCard.innerHTML = `
            <h3>${game.title}</h3>
            <p>${game.description}</p>
            <button class="btn btn-primary select-game-btn" data-game-id="${game.id}">Seleccionar</button>
        `;
        gameListContainer.appendChild(gameCard);
    });

    // Add event listeners for new game cards
    document.querySelectorAll('.select-game-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const gameId = e.target.dataset.gameId;
            await selectGame(gameId);
        });
    });
}

async function selectGame(gameId) {
    const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

    if (error) {
        console.error('Error fetching game details:', error);
        showModal('Error', 'No pudimos cargar los detalles del juego. ' + error.message);
        return;
    }

    currentGame = data;
    gameDetailsTitle.textContent = currentGame.title;
    gameDetailsDesc.textContent = currentGame.description;
    gameDetailsMechanics.textContent = currentGame.mechanics;
    gameDetailsNarrative.textContent = currentGame.initial_narrative;
    showScreen(gameDetailsScreen);
}

async function startGame() {
    if (!currentGame) {
        showModal('Error', 'Por favor, selecciona un juego antes de iniciar.');
        return;
    }

    const teamName = teamNameInput.value.trim();
    if (!teamName) {
        showModal('Falta Nombre', 'Por favor, introduce un nombre para tu equipo.');
        return;
    }

    // Check if team name already exists for this game (optional but good)
    const { data: existingTeam, error: teamError } = await supabase
        .from('teams')
        .select('id')
        .eq('game_id', currentGame.id)
        .eq('team_name', teamName);

    if (teamError) {
        console.error('Error checking existing team:', teamError);
        showModal('Error', 'Error al verificar el nombre del equipo. ' + teamError.message);
        return;
    }

    if (existingTeam && existingTeam.length > 0) {
        showModal('Nombre Existente', 'Este nombre de equipo ya está en uso para este juego. Por favor, elige otro.');
        return;
    }

    // Fetch initial locations for the game
    const { data: locationsData, error: locError } = await supabase
        .from('locations')
        .select('*')
        .eq('game_id', currentGame.id)
        .order('order', { ascending: true }); // Order locations if needed

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

    // Create new team in Supabase
    const { data: newTeam, error: insertError } = await supabase
        .from('teams')
        .insert({
            game_id: currentGame.id,
            team_name: teamName,
            current_location_id: currentLocations[0].id, // Start with the first location
            current_trial_id: null, // Will be set when first trial starts
            start_time: new Date().toISOString(),
            last_trial_start_time: null,
            pistas_used_global: 0,
            pistas_used_per_trial: [],
            total_time: 0,
            total_score: 0,
            progress_log: [],
            last_activity: new Date().toISOString()
        })
        .select()
        .single();

    if (insertError) {
        console.error('Error creating team:', insertError);
        showModal('Error', 'Error al crear el equipo. ' + insertError.message);
        return;
    }

    currentTeam = newTeam;
    localStorage.setItem('currentTeamId', currentTeam.id); // Persist team ID

    gameStartTime = Date.now(); // Initialize game start time
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
        currentGame = data.games; // The joined game data
        // Reconstruct game progress
        // Fetch locations and trials to properly set current index and render UI
        currentLocations = (await supabase.from('locations').select('*').eq('game_id', currentGame.id).order('order', { ascending: true })).data;

        // Find current location index
        currentLocationIndex = currentLocations.findIndex(loc => loc.id === currentTeam.current_location_id);
        if (currentLocationIndex === -1) currentLocationIndex = 0; // Fallback if ID not found

        // Fetch trials for the current location
        currentTrials = (await supabase.from('trials').select('*').eq('location_id', currentTeam.current_location_id).order('order', { ascending: true })).data;
        currentTrialIndex = currentTrials.findIndex(trial => trial.id === currentTeam.current_trial_id);
        if (currentTrialIndex === -1) currentTrialIndex = 0; // Fallback if ID not found or if resuming after location narrative

        // Set game start time from team data
        gameStartTime = new Date(currentTeam.start_time).getTime();
        currentScoreDisplay.textContent = currentTeam.total_score; // Update score display

        showAlert(`Reanudando juego para ${currentTeam.team_name} en ${currentGame.title}`, 'success');
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

    locationNarrativeDisplay.innerHTML = `
        <h2>${location.name}</h2>
        <p>${location.narrative}</p>
        ${location.image_url ? `<img src="${location.image_url}" alt="Ubicación" class="narrative-image">` : ''}
        ${location.audio_url ? `<audio controls src="${location.audio_url}"></audio>` : ''}
        <button id="start-location-trials-btn" class="main-action-button">Comenzar Pruebas</button>
    `;

    // Add event listener for the "Comenzar Pruebas" button
    const startLocationTrialsBtn = document.getElementById('start-location-trials-btn');
    if (startLocationTrialsBtn) {
        startLocationTrialsBtn.addEventListener('click', async () => {
            currentTrials = (await supabase.from('trials').select('*').eq('location_id', location.id).order('order', { ascending: true })).data;
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
        await completeLocation(); // This function will handle moving to next location or game completion
        return;
    }

    // Update current trial ID in team state
    const { error: updateTeamError } = await supabase
        .from('teams')
        .update({
            current_trial_id: currentTrial.id,
            last_activity: new Date().toISOString(),
            last_trial_start_time: new Date().toISOString() // Set new trial start time in DB
        })
        .eq('id', currentTeam.id);

    if (updateTeamError) {
        console.error('Error updating current_trial_id:', updateTeamError);
        showAlert('Error al actualizar progreso.', 'error');
    }

    // Update local currentTeam for accurate timers/score
    currentTeam.current_trial_id = currentTrial.id;
    currentTeam.last_trial_start_time = new Date().toISOString();


    // Hide all trial-specific sections first
    document.querySelectorAll('.trial-section').forEach(sec => sec.classList.add('hidden'));
    locationNarrativeSection.classList.add('hidden'); // Hide location narrative

    // Clear previous trial content and hide common media elements
    trialNarrativeDisplay.textContent = '';
    trialImage.src = '';
    trialImage.classList.add('hidden');
    trialAudio.src = '';
    trialAudio.classList.add('hidden');

    // Display common trial elements
    trialNarrativeDisplay.textContent = currentTrial.narrative;
    if (currentTrial.image_url) {
        trialImage.src = currentTrial.image_url;
        trialImage.classList.remove('hidden');
    }
    if (currentTrial.audio_url) {
        trialAudio.src = currentTrial.audio_url;
        trialAudio.classList.remove('hidden');
        trialAudio.play().catch(e => console.error("Error playing audio:", e));
    }

    // Setup hint button (main hintBtn for Text, or specific for QR/GPS)
    const hintInfo = currentTeam.pistas_used_per_trial.find(h => h.trialId === currentTrial.id);
    const hintsUsed = hintInfo ? hintInfo.count : 0;
    const hintsRemaining = currentTrial.max_hints - hintsUsed;

    // Reset all hint displays to hidden by default for next trial
    hintBtn.classList.add('hidden');
    if (qrHintBtn) qrHintBtn.classList.add('hidden');
    if (gpsHintBtn) gpsHintBtn.classList.add('hidden');

    // Display trial type specific content
    switch (currentTrial.type) {
        case 'QR':
            qrTrialSection.classList.remove('hidden');
            qrResultDisplay.textContent = ''; // Clear previous QR result
            qrScannerContainer.classList.remove('hidden'); // Show QR scanner area
            // Specific QR hint setup
            if (qrHintsRemainingDisplay) qrHintsRemainingDisplay.textContent = hintsRemaining;
            if (qrHintCostDisplay) qrHintCostDisplay.textContent = currentTrial.hint_cost;
            if (qrHintBtn && hintsRemaining > 0) qrHintBtn.classList.remove('hidden');
            break;
        case 'GPS':
            gpsTrialSection.classList.remove('hidden');
            gpsMapContainer.classList.remove('hidden'); // Ensure map container is visible
            initializePlayerMap(currentTrial.latitude, currentTrial.longitude, currentTrial.tolerance);
            // Specific GPS hint setup
            if (gpsHintsRemainingDisplay) gpsHintsRemainingDisplay.textContent = hintsRemaining;
            if (gpsHintCostDisplay) gpsHintCostDisplay.textContent = currentTrial.hint_cost;
            if (gpsHintBtn && hintsRemaining > 0) gpsHintBtn.classList.remove('hidden');
            break;
        case 'TEXT':
            textTrialSection.classList.remove('hidden');
            textQuestionDisplay.textContent = currentTrial.question;
            textAnswerInput.value = ''; // Clear previous answer
            textAnswerInput.classList.remove('hidden'); // Show input by default
            textOptionsContainer.innerHTML = ''; // Clear previous options
            textOptionsContainer.classList.add('hidden'); // Hide options by default

            // Main TEXT hint setup
            if (hintsRemainingDisplay) hintsRemainingDisplay.textContent = hintsRemaining;
            if (hintCostDisplay) hintCostDisplay.textContent = currentTrial.hint_cost;
            if (hintBtn && hintsRemaining > 0) hintBtn.classList.remove('hidden');


            switch (currentTrial.answer_type) {
                case 'SINGLE':
                case 'NUMERIC':
                    // Just input field, already visible
                    break;
                case 'MULTIPLE_CHOICE':
                    textOptionsContainer.classList.remove('hidden');
                    textAnswerInput.classList.add('hidden'); // Hide input for multiple choice
                    currentTrial.options.split(';').forEach((option, index) => {
                        const btn = document.createElement('button');
                        btn.className = 'btn btn-option';
                        btn.textContent = option.trim();
                        btn.dataset.value = option.trim(); // Store value for validation
                        btn.addEventListener('click', (e) => {
                            textAnswerInput.value = e.target.dataset.value; // Set value to hidden input
                            validateAnswerBtn.click(); // Automatically validate on option click
                        });
                        textOptionsContainer.appendChild(btn);
                    });
                    break;
                case 'ORDERING':
                    textOptionsContainer.classList.remove('hidden');
                    textAnswerInput.classList.add('hidden'); // Hide input for ordering
                    currentTrial.options.split(';').forEach((option, index) => {
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
            showAlert('Tipo de prueba no reconocido: ' + currentTrial.type, 'error');
            showModal('Error de Prueba', `El tipo de prueba '${currentTrial.type}' no es reconocido. Contacta al administrador.`);
            break;
    }
    startTrialTimer(); // Start timer for the current trial
}

async function completeTrial(pointsAwarded) {
    stopTrialTimer(); // Stop trial timer
    stopGpsWatch(); // Stop GPS watch if active
    stopQrScanner(); // Stop QR scanner if active

    const timeTaken = Math.floor((Date.now() - trialStartTime) / 1000); // Time in seconds
    let finalTrialScore = Math.max(0, pointsAwarded - timeTaken); // Penalize by time

    // Apply hint penalty
    const currentTrial = currentTrials[currentTrialIndex];
    const hintsUsedInThisTrial = currentTeam.pistas_used_per_trial.find(h => h.trialId === currentTrial.id)?.count || 0;
    finalTrialScore -= (hintsUsedInThisTrial * (currentTrial.hint_cost || 0)); // Ensure hint_cost is a number
    finalTrialScore = Math.max(0, finalTrialScore); // Score cannot be negative

    // Update team progress in Supabase
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
            total_time: (currentTeam.total_time || 0) + timeTaken, // Ensure initial value is 0 if null
            total_score: (currentTeam.total_score || 0) + finalTrialScore, // Ensure initial value is 0 if null
            progress_log: [...(currentTeam.progress_log || []), progressLogEntry],
            last_activity: new Date().toISOString()
        })
        .eq('id', currentTeam.id);

    if (error) {
        console.error('Error updating team progress:', error);
        showAlert('Error al guardar el progreso.', 'error');
    } else {
        // Update local team state to reflect changes
        currentTeam.total_time = (currentTeam.total_time || 0) + timeTaken;
        currentTeam.total_score = (currentTeam.total_score || 0) + finalTrialScore;
        currentTeam.progress_log = [...(currentTeam.progress_log || []), progressLogEntry];
        currentScoreDisplay.textContent = currentTeam.total_score; // Update score display
    }

    // Show feedback screen
    feedbackMessage.textContent = '¡Prueba Completada!';
    feedbackScore.textContent = `Puntos: ${finalTrialScore} (${pointsAwarded} base - ${timeTaken}s - ${hintsUsedInThisTrial * (currentTrial.hint_cost || 0)} pts por pistas)`;
    showScreen(feedbackScreen);
}

async function continueFromFeedback() {
    currentTrialIndex++;
    if (currentTrialIndex < currentTrials.length) {
        // More trials in current location
        await displayCurrentTrial();
    } else {
        // All trials in current location completed
        currentLocationIndex++;
        if (currentLocationIndex < currentLocations.length) {
            // More locations in game
            await displayLocationNarrative(currentLocations[currentLocationIndex]);
        } else {
            // Game completed!
            await completeGame();
        }
    }
}

async function completeLocation() {
    // This function is called implicitly when all trials in a location are done
    // If there's a specific narrative for location completion, display it here
    // For now, it will just move to the next location or complete the game.
    console.log('Location completed!');
    // The flow continues via continueFromFeedback which increments currentLocationIndex
    // This function is here more as a placeholder for potential future logic.
}

async function completeGame() {
    stopGlobalTimer();
    const totalGameTimeSeconds = currentTeam.total_time; // Already accumulated in progress
    const finalScoreValue = currentTeam.total_score;

    // Save final ranking
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

    // Clear local state for a new game
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
    if (gameTimerInterval) clearInterval(gameTimerInterval); // Clear any existing
    gameTimerInterval = setInterval(() => {
        // total_time is accumulated in completeTrial, this just displays it
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
    if (trialTimerInterval) clearInterval(trialTimerInterval); // Clear any existing
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
    // Resume global game timer
    startGlobalTimer();

    // Resume trial timer if a trial was active
    if (currentTeam && currentTeam.current_trial_id && currentTeam.last_trial_start_time) {
        // Set trialStartTime from the stored timestamp
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
        const currentTrialType = currentTrial.type;
        const currentAnswerType = currentTrial.answer_type;

        if (currentTrialType === 'TEXT') {
            userAnswer = textAnswerInput.value.trim();
            if (currentAnswerType === 'NUMERIC') {
                userAnswer = parseFloat(userAnswer); // Convert to number for numeric comparison
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
            // GPS validation is handled by watchPosition or a dedicated check
            showAlert('La validación GPS es automática cuando llegas a la zona.', 'info');
            return;
        }

        let isCorrect = false;
        let basePoints = currentTrial.base_score || 100; // Default score if not set

        switch (currentTrialType) {
            case 'TEXT':
                if (currentAnswerType === 'NUMERIC') {
                    isCorrect = userAnswer === parseFloat(currentTrial.correct_answer);
                } else if (currentAnswerType === 'MULTIPLE_CHOICE' || currentAnswerType === 'SINGLE') {
                    isCorrect = userAnswer.toLowerCase() === currentTrial.correct_answer.toLowerCase();
                } else if (currentAnswerType === 'ORDERING') {
                    isCorrect = userAnswer.toLowerCase() === currentTrial.correct_answer.toLowerCase();
                }
                break;
            case 'QR':
                isCorrect = userAnswer === currentTrial.qr_content;
                break;
            case 'GPS': // Should not be reached via button click
                isCorrect = false;
                break;
        }

        if (isCorrect) {
            showAlert('¡Respuesta Correcta!', 'success');
            await completeTrial(basePoints);
        } else {
            showAlert('Respuesta Incorrecta. Inténtalo de nuevo.', 'error');
            // Optional: penalize for incorrect attempts here
        }
    });
} else {
    console.warn('Botón de Validar Respuesta (#validate-answer-btn) no encontrado.');
}

// Generic hint button logic, applies to whichever hint button is visible
[hintBtn, qrHintBtn, gpsHintBtn].forEach(btn => {
    if (btn) { // Check if the element exists
        btn.addEventListener('click', async (e) => {
            if (!currentTrial || !currentTeam) {
                showAlert('No hay una prueba activa para pedir pista.', 'warning');
                return;
            }

            const hintsUsedInThisTrial = currentTeam.pistas_used_per_trial.find(h => h.trialId === currentTrial.id)?.count || 0;
            if (hintsUsedInThisTrial >= (currentTrial.max_hints || 0)) {
                showAlert('No quedan más pistas para esta prueba.', 'warning');
                // Hide specific hint button if no more hints
                e.target.classList.add('hidden');
                return;
            }

            const { error } = await supabase
                .from('teams')
                .update({
                    pistas_used_global: (currentTeam.pistas_used_global || 0) + 1,
                    pistas_used_per_trial: [
                        ...(currentTeam.pistas_used_per_trial.filter(h => h.trialId !== currentTrial.id)),
                        { trialId: currentTrial.id, count: hintsUsedInThisTrial + 1 }
                    ],
                    last_activity: new Date().toISOString()
                })
                .eq('id', currentTeam.id);

            if (error) {
                console.error('Error logging hint:', error);
                showAlert('Error al registrar la pista. ' + error.message, 'error');
                return;
            }

            // Update local state
            currentTeam.pistas_used_global = (currentTeam.pistas_used_global || 0) + 1;
            let currentTrialHintEntry = currentTeam.pistas_used_per_trial.find(h => h.trialId === currentTrial.id);
            if (currentTrialHintEntry) {
                currentTrialHintEntry.count++;
            } else {
                currentTeam.pistas_used_per_trial.push({ trialId: currentTrial.id, count: 1 });
            }

            const newHintsRemaining = (currentTrial.max_hints || 0) - (hintsUsedInThisTrial + 1);
            // Update the correct display based on which button was clicked
            if (e.target === hintBtn) hintsRemainingDisplay.textContent = newHintsRemaining;
            if (e.target === qrHintBtn && qrHintsRemainingDisplay) qrHintsRemainingDisplay.textContent = newHintsRemaining;
            if (e.target === gpsHintBtn && gpsHintsRemainingDisplay) gpsHintsRemainingDisplay.textContent = newHintsRemaining;


            showAlert(`Pista utilizada. ${currentTrial.hint_cost || 0} puntos restados. Te quedan ${newHintsRemaining} pistas.`, 'info');

            if (newHintsRemaining <= 0) {
                e.target.classList.add('hidden');
            }
            // Display the hint content
            showModal('Pista', currentTrial.hint_content || 'No hay contenido de pista disponible para esta prueba.');
        });
    }
});


// --- GPS Functions ---
function initializePlayerMap(targetLat, targetLng, tolerance) {
    if (playerMap) {
        playerMap.remove(); // Remove existing map if any
    }

    gpsMapContainer.classList.remove('hidden'); // Ensure map container is visible

    playerMap = L.map(gpsMapContainer).setView([targetLat, targetLng], 17); // Set view slightly zoomed
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(playerMap);

    // Target marker (the trial location)
    if (targetMarker) {
        playerMap.removeLayer(targetMarker);
    }
    targetMarker = L.circleMarker([targetLat, targetLng], {
        color: 'red',
        fillColor: '#f03',
        fillOpacity: 0.5,
        radius: 8
    }).addTo(playerMap).bindPopup(`Objetivo: ${currentTrial.name || 'Prueba'}`).openPopup();

    // Tolerance circle
    L.circle([targetLat, targetLng], {
        color: 'blue',
        fillColor: '#30a',
        fillOpacity: 0.2,
        radius: tolerance
    }).addTo(playerMap);

    // Player's current location marker
    if (playerMarker) {
        playerMap.removeLayer(playerMarker);
    }
    playerMarker = L.circleMarker([0, 0], { // Placeholder
        color: 'green',
        fillColor: '#0f3',
        fillOpacity: 0.8,
        radius: 6
    }).addTo(playerMap).bindPopup('Tu ubicación');

    startGpsWatch(targetLat, targetLng, tolerance);
}

function startGpsWatch(targetLat, targetLng, tolerance) {
    if (gpsWatchId) {
        stopGpsWatch(); // Clear any previous watch
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
            playerMarker.setLatLng([latitude, longitude]); // Update player marker position
            playerMap.panTo([latitude, longitude]); // Center map on player

            const distance = getDistance(latitude, longitude, targetLat, targetLng);
            console.log(`Distancia al objetivo: ${distance.toFixed(2)} metros`);

            if (distance <= tolerance) {
                showAlert('¡Ubicación alcanzada! Validando prueba...', 'success');
                stopGpsWatch();
                await completeTrial(currentTrial.base_score || 100); // Assuming GPS trials get base_score
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
    // Don't remove map entirely, just hide its container
    if (gpsMapContainer) {
        gpsMapContainer.classList.add('hidden');
    }
    if (playerMap) {
        // Invalidate size to prevent map rendering issues when hidden/shown
        playerMap.invalidateSize();
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
} else {
    console.warn('Botón de Escanear QR (#qr-scan-btn) no encontrado.');
}


function startQrScanner() {
    qrScannerContainer.classList.remove('hidden');
    if (qrScanner) {
        qrScanner.clear(); // Clear previous instance if exists
    }

    qrScanner = new Html5Qrcode("qr-scanner"); // "qr-scanner" is the ID of the div where the camera feed will appear
    const qrCodeSuccessCallback = async (decodedText, decodedResult) => {
        // Stop the scanner once a QR is successfully scanned
        stopQrScanner();
        qrResultDisplay.textContent = decodedText; // Display the scanned text
        showAlert('QR Escaneado: ' + decodedText, 'info');

        // Automatically validate QR code if it's the current trial
        if (currentTrial && currentTrial.type === 'QR' && currentTrial.qr_content === decodedText) {
            showAlert('¡QR Correcto! Validando prueba...', 'success');
            await completeTrial(currentTrial.base_score || 100);
        } else {
            showAlert('QR incorrecto o no corresponde a esta prueba.', 'error');
        }
    };

    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    qrScanner.start({ facingMode: "environment" }, config, qrCodeSuccessCallback)
        .catch((err) => {
            console.error("Error al iniciar el escáner QR:", err);
            showModal('Error Escáner QR', 'No se pudo iniciar la cámara. Asegúrate de dar permiso y de que no esté en uso por otra aplicación. ' + err.message);
            stopQrScanner(); // Ensure scanner state is reset on error
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
            qrScanning = false; // Force stop flag even on error
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
            teams (team_name)
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

    globalRankingsList.innerHTML = ''; // Clear previous list
    if (data.length === 0) {
        globalRankingsList.innerHTML = '<p class="info-message">No hay rankings disponibles para esta selección.</p>';
        return;
    }

    data.forEach((rank, index) => {
        const rankCard = document.createElement('div');
        rankCard.className = 'card ranking-card';
        rankCard.innerHTML = `
            <h3>#${index + 1} - ${rank.teams ? rank.teams.team_name : 'Equipo Desconocido'}</h3>
            <p>Puntuación Final: <span>${rank.final_score}</span></p>
            <p>Tiempo de Completado: <span>${formatTime(rank.completion_time)}</span></p>
            <p>Juego: <span>${rank.games ? rank.games.title : 'Desconocido'}</span></p>
            <p>Fecha: <span>${new Date(rank.completion_date).toLocaleDateString()}</span></p>
        `;
        globalRankingsList.appendChild(rankCard);
    });
}

// --- Event Listeners (Rest of the application) ---

if (createTeamBtn) { // This button now starts the game from details screen
    createTeamBtn.addEventListener('click', startGame);
}

if (backToGameSelectionBtn) {
    backToGameSelectionBtn.addEventListener('click', () => {
        showScreen(gameSelectionScreen);
        fetchActiveGames(); // Re-fetch games
    });
}

if (joinGameBtn) {
    joinGameBtn.addEventListener('click', () => {
        showModal('Función No Implementada', 'La funcionalidad para unirse a un equipo existente no está implementada todavía.');
    });
}

if (continueGameBtn) {
    continueGameBtn.addEventListener('click', continueFromFeedback);
} else {
    console.warn('Botón de Continuar Juego (#continue-game-btn) no encontrado.');
}

if (playAgainBtn) {
    playAgainBtn.addEventListener('click', () => {
        // Reset all state variables
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
        // Return to game selection
        showScreen(gameSelectionScreen);
        fetchActiveGames(); // Reload games for a new session
    });
} else {
    console.warn('Botón de Jugar Otra Aventura (#play-again-btn) no encontrado.');
}

if (viewFinalRankingsBtn) {
    viewFinalRankingsBtn.addEventListener('click', () => {
        showScreen(globalRankingsScreen);
        populateRankingGameSelect(); // Populate the dropdown
        fetchGlobalRankings(); // Show all rankings initially
    });
} else {
    console.warn('Botón de Ver Rankings Globales (#view-final-rankings-btn) no encontrado.');
}

if (globalRankingsGameSelect) {
    globalRankingsGameSelect.addEventListener('change', (e) => {
        const selectedGameId = e.target.value === '' ? null : e.target.value;
        fetchGlobalRankings(selectedGameId);
    });
} else {
    console.warn('Select de Rankings Globales (#global-rankings-game-select) no encontrado.');
}

if (backToMenuFromRankingsBtn) {
    backToMenuFromRankingsBtn.addEventListener('click', () => {
        showScreen(gameSelectionScreen);
        fetchActiveGames(); // Re-fetch games just in case state changed
    });
} else {
    console.warn('Botón de Volver al Menú desde Rankings (#back-to-menu-from-rankings-btn) no encontrado.');
}