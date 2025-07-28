// player-script.js

// Supabase ya está inicializado en supabase-config.js
// showAlert y formatTime también están disponibles desde supabase-config.js

// --- Global Game State Variables ---
let currentTeam = null; // Object { id, team_name, game_id, current_location_id, current_trial_id, start_time, last_trial_start_time, hints_used_global, hints_used_per_trial, total_time, total_score, progress_log, last_activity }
let currentGame = null; // Object { id, title, description, mechanics, narrative_initial, order_type, is_active }
let currentLocations = []; // Array of { id, game_id, name, narrative_initial, image_url, audio_url, latitude, longitude }
let currentTrials = []; // Array of trials for the current location
let currentNarrativeIndex = 0; // For multi-part narratives (game/location intros)

let gameTimerInterval = null;
let currentTrialStartTime = null;

let map = null;
let mapMarker = null; // Marker for the player's current position
let destinationMarker = null; // Marker for the GPS trial destination

let html5QrCode = null; // For QR scanner instance

const DB_NAME = 'adventureQuestDB';
const STORE_NAME = 'teams';

// --- DOM Elements ---
const loadingScreen = document.getElementById('loading-screen');
const gameSelectionScreen = document.getElementById('game-selection-screen');
const gamePlayScreen = document.getElementById('game-play-screen');
const gameOverScreen = document.getElementById('game-over-screen');

// Game Selection Screen
const gameListDiv = document.getElementById('game-list');
const teamSetupSection = document.getElementById('team-setup-section');
const teamSetupGameTitle = document.getElementById('team-setup-game-title');
const teamForm = document.getElementById('team-form');
const teamNameInput = document.getElementById('team-name');
const backToGamesFromTeamBtn = document.getElementById('back-to-games-from-team-btn');

// Game Play Screen
const gamePlayTitle = document.getElementById('game-play-title');
const currentScoreSpan = document.getElementById('current-score');
const totalTimeSpan = document.getElementById('total-time');
const gameContentDiv = document.getElementById('game-content');
const nextNarrativeBtn = document.getElementById('next-narrative-btn');
const endGameBtn = document.getElementById('end-game-btn');
const navigationControls = document.querySelector('.navigation-controls');

// Game Over Screen
const finalTeamNameSpan = document.getElementById('final-team-name');
const finalGameTitleSpan = document.getElementById('final-game-title');
const finalScoreDisplay = document.getElementById('final-score-display');
const finalTimeDisplay = document.getElementById('final-time-display');
const finalRankMessage = document.getElementById('final-rank-message');
const backToMenuBtn = document.getElementById('back-to-menu-btn');

// Modal Elements
const modalContainer = document.getElementById('modal-container');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalCloseBtn = document.getElementById('modal-close-btn');

// --- IndexedDB Functions (Offline Persistence) ---
async function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };

        request.onerror = (event) => {
            console.error("IndexedDB error:", event.target.errorCode);
            reject(event.target.error);
        };
    });
}

async function saveTeamState(team) {
    try {
        const db = await openDatabase();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        await store.put(team);
        return new Promise(resolve => { transaction.oncomplete = resolve; });
    } catch (error) {
        console.error("Error saving team state to IndexedDB:", error);
    }
}

async function loadTeamState() {
    try {
        const db = await openDatabase();
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        return new Promise((resolve) => {
            request.onsuccess = () => resolve(request.result[0] || null); // Assuming only one team state is saved
        });
    } catch (error) {
        console.error("Error loading team state from IndexedDB:", error);
        return null;
    }
}

async function clearTeamState() {
    try {
        const db = await openDatabase();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        await store.clear();
        return new Promise(resolve => { transaction.oncomplete = resolve; });
    } catch (error) {
        console.error("Error clearing team state from IndexedDB:", error);
    }
}

// --- Sync with Supabase ---
async function syncTeamStateWithSupabase() {
    if (!currentTeam || !navigator.onLine) return;

    try {
        const { data, error } = await supabase
            .from('teams')
            .upsert(currentTeam, { onConflict: 'id' })
            .select()
            .single();

        if (error) {
            console.error("Error syncing team state to Supabase:", error.message);
            showAlert('No se pudo guardar el progreso en la nube. Revisa tu conexión.', 'warning');
        } else {
            console.log("Team state synced with Supabase:", data);
            currentTeam = data; // Update local state with latest from DB (e.g., updated_at)
        }
    } catch (e) {
        console.error("Network or Supabase error during sync:", e);
        showAlert('Error de conexión al sincronizar el progreso.', 'warning');
    }
}


// --- Screen Management ---
function showScreen(screenElement) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden');
    });
    screenElement.classList.remove('hidden');
    // Ensure Leaflet map invalidates size if it's on the newly shown screen
    if (screenElement === gamePlayScreen && map) {
        setTimeout(() => { map.invalidateSize(); }, 0);
    }
}

function setGameNameDisplay(name) {
    document.querySelectorAll('.game-name-display').forEach(element => {
        element.textContent = name;
    });
}

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', async () => {
    // Register service worker for PWA capabilities
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js')
            .then(reg => console.log('Service Worker Registered', reg))
            .catch(err => console.error('Service Worker Registration Failed', err));
    }

    // Check for ongoing game from IndexedDB
    currentTeam = await loadTeamState();

    if (currentTeam) {
        // Try to load game details for the ongoing game
        const { data: gameData, error: gameError } = await supabase
            .from('games')
            .select('*')
            .eq('id', currentTeam.game_id)
            .single();

        if (gameData && !gameError) {
            currentGame = gameData;
            gamePlayTitle.textContent = currentGame.title;
            // Optionally, try to refresh currentTeam from Supabase to get latest state
            await syncTeamStateWithSupabase();
            showScreen(gamePlayScreen);
            startGameTimer();
            await renderCurrentGameContent();
            showAlert(`¡Bienvenido de nuevo, ${currentTeam.team_name}!`, 'info');
        } else {
            console.warn("No se pudo cargar el juego para el equipo guardado, iniciando desde cero.", gameError);
            await clearTeamState(); // Clear corrupted state
            loadGames();
            showScreen(gameSelectionScreen);
        }
    } else {
        loadGames();
        showScreen(gameSelectionScreen);
    }

    // Hide loading screen after initial checks
    setTimeout(() => {
        loadingScreen.classList.add('hidden');
    }, 500); // Small delay for visual effect
});


// --- Game Selection ---
async function loadGames() {
    gameListDiv.innerHTML = '<p>Cargando juegos disponibles...</p>';
    const { data: games, error } = await supabase
        .from('games')
        .select('*')
        .eq('is_active', true) // Only active games
        .order('title', { ascending: true });

    if (error) {
        showAlert('Error cargando juegos: ' + error.message, 'error');
        console.error('Error loading games:', error);
        gameListDiv.innerHTML = '<p>No se pudieron cargar los juegos. Intenta recargar la página.</p>';
        return;
    }

    if (games.length === 0) {
        gameListDiv.innerHTML = '<p>No hay juegos activos disponibles en este momento.</p>';
        return;
    }

    gameListDiv.innerHTML = '';
    games.forEach(game => {
        const gameCard = document.createElement('div');
        gameCard.className = 'card game-card';
        gameCard.innerHTML = `
            <h3>${game.title}</h3>
            <p>${game.description}</p>
            <p>Mecánica: ${game.mechanics}</p>
            <button class="btn btn-primary select-game-btn" data-id="${game.id}" data-title="${game.title}">Seleccionar Juego</button>
        `;
        gameListDiv.appendChild(gameCard);
    });

    document.querySelectorAll('.game-card .select-game-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const gameId = e.target.dataset.id;
            const gameTitle = e.target.dataset.title;
            selectGame(gameId, gameTitle);
        });
    });
}

async function selectGame(gameId, gameTitle) {
    const { data: game, error } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

    if (error || !game) {
        showAlert('Error al cargar detalles del juego: ' + (error ? error.message : 'Juego no encontrado'), 'error');
        console.error('Error fetching game details:', error);
        return;
    }
    currentGame = game;
    setGameNameDisplay(game.title);
    teamSetupGameTitle.textContent = `Unirse a ${game.title}`;
    showScreen(teamSetupSection);
}

// --- Team Management ---
teamForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const teamName = teamNameInput.value.trim();
    if (!teamName || !currentGame) {
        showAlert('Por favor, introduce un nombre de equipo y selecciona un juego.', 'warning');
        return;
    }

    // Check if team name already exists for this game (simple check, not robust collision handling)
    const { data: existingTeams, error: existingTeamError } = await supabase
        .from('teams')
        .select('id')
        .eq('game_id', currentGame.id)
        .eq('team_name', teamName);

    if (existingTeamError) {
        showAlert('Error al verificar equipos existentes: ' + existingTeamError.message, 'error');
        return;
    }

    if (existingTeams && existingTeams.length > 0) {
        showAlert('Ya existe un equipo con ese nombre para este juego. Por favor, elige otro.', 'warning');
        return;
    }

    await createNewTeam(teamName);
});

backToGamesFromTeamBtn.addEventListener('click', () => {
    showScreen(gameSelectionScreen);
    teamNameInput.value = ''; // Clear input
});

async function createNewTeam(teamName) {
    const newTeamData = {
        team_name: teamName,
        game_id: currentGame.id,
        current_location_id: null, // Will be set after first narrative
        current_trial_id: null,
        start_time: new Date().toISOString(),
        last_trial_start_time: null,
        hints_used_global: 0,
        hints_used_per_trial: [],
        total_time: 0,
        total_score: 0,
        progress_log: [],
        last_activity: new Date().toISOString()
    };

    const { data, error } = await supabase
        .from('teams')
        .insert(newTeamData)
        .select()
        .single();

    if (error) {
        showAlert('Error al crear el equipo: ' + error.message, 'error');
        console.error('Error creating team:', error);
        return;
    }

    currentTeam = data;
    await saveTeamState(currentTeam); // Save to IndexedDB
    showAlert(`¡Equipo ${teamName} creado! ¡A jugar!`, 'success');

    gamePlayTitle.textContent = currentGame.title;
    showScreen(gamePlayScreen);
    startGameTimer();
    await fetchGameContent();
    await renderCurrentGameContent();
}

// --- Game Timer ---
function startGameTimer() {
    if (gameTimerInterval) clearInterval(gameTimerInterval); // Clear any existing timer
    gameTimerInterval = setInterval(() => {
        if (currentTeam && currentTeam.start_time) {
            const elapsedTime = Math.floor((new Date().getTime() - new Date(currentTeam.start_time).getTime()) / 1000);
            totalTimeSpan.textContent = `Tiempo: ${formatTime(elapsedTime)}`;
            currentTeam.total_time = elapsedTime; // Update total time for persistence
            updateScoreDisplay(); // Update score based on accumulated time
        }
    }, 1000);
}

function stopGameTimer() {
    clearInterval(gameTimerInterval);
    gameTimerInterval = null;
}

function updateScoreDisplay() {
    // Current score calculation: initial score per trial - (time spent * 1) - (hints used * cost)
    // This is a simplified calculation, a more robust one would iterate through progress_log
    let calculatedScore = 0;
    if (currentTeam) {
        calculatedScore = (currentTeam.progress_log.length * currentGame.initial_score_per_trial) - currentTeam.total_time - (currentTeam.hints_used_global * 10); // Assuming 10 points per hint as default if not specified
        currentScoreSpan.textContent = `Puntos: ${currentTeam.total_score}`; // Display actual total_score from DB
    }
}

// --- Fetch Game Content (Locations & Trials) ---
async function fetchGameContent() {
    if (!currentGame) return;

    // Fetch all locations for the current game
    const { data: locations, error: locError } = await supabase
        .from('locations')
        .select('*')
        .eq('game_id', currentGame.id)
        .order('created_at', { ascending: true });

    if (locError) {
        showAlert('Error cargando localizaciones: ' + locError.message, 'error');
        console.error('Error fetching locations:', locError);
        return;
    }
    currentLocations = locations;

    // If starting a new game, set the first location and trial
    if (!currentTeam.current_location_id && currentLocations.length > 0) {
        currentTeam.current_location_id = currentLocations[0].id;
        // Fetch trials for the first location
        await fetchTrialsForLocation(currentLocations[0].id);
        if (currentTrials.length > 0) {
            currentTeam.current_trial_id = currentTrials[0].id;
        }
        await saveTeamState(currentTeam);
        await syncTeamStateWithSupabase();
    } else if (currentTeam.current_location_id) {
        // If resuming, fetch trials for the current location
        await fetchTrialsForLocation(currentTeam.current_location_id);
    }
}

async function fetchTrialsForLocation(locationId) {
    const { data: trials, error: trialError } = await supabase
        .from('trials')
        .select('*')
        .eq('location_id', locationId)
        .order('created_at', { ascending: true });

    if (trialError) {
        showAlert('Error cargando pruebas: ' + trialError.message, 'error');
        console.error('Error fetching trials:', trialError);
        return;
    }
    currentTrials = trials;
}

// --- Render Game Content ---
async function renderCurrentGameContent() {
    gameContentDiv.innerHTML = ''; // Clear previous content
    navigationControls.classList.remove('hidden'); // Show navigation by default

    const currentLoc = currentLocations.find(loc => loc.id === currentTeam.current_location_id);
    if (!currentLoc) {
        // This case should not happen if game flow is correct, but for safety
        showAlert('Error: Localización actual no encontrada.', 'error');
        return;
    }

    const currentTrialIndex = currentTrials.findIndex(trial => trial.id === currentTeam.current_trial_id);

    if (currentTrialIndex === -1 && currentTeam.progress_log.length > 0 && currentTeam.progress_log[currentTeam.progress_log.length - 1].trial_id === currentTeam.current_trial_id) {
        // If current_trial_id is the last completed one, then we need to move to the next trial or location
        await advanceGame();
        return; // Re-render after advancement
    }


    if (currentTrialIndex === -1 || !currentTeam.current_trial_id) {
        // This means we need to show the initial narrative of the current location
        renderNarrativeScreen(currentLoc.name, currentLoc.narrative_initial, currentLoc.image_url, currentLoc.audio_url);
        nextNarrativeBtn.onclick = () => {
            // After location narrative, proceed to first trial of this location
            if (currentTrials.length > 0) {
                currentTeam.current_trial_id = currentTrials[0].id;
                currentTeam.last_trial_start_time = new Date().toISOString(); // Start trial timer
                saveTeamState(currentTeam).then(() => syncTeamStateWithSupabase());
                renderTrial(currentTrials[0]);
            } else {
                showAlert('No hay pruebas para esta localización.', 'warning');
                // Handle case where location has no trials (e.g., skip to next location)
                advanceGame();
            }
        };
        nextNarrativeBtn.classList.remove('hidden');
    } else {
        // Render the current trial
        renderTrial(currentTrials[currentTrialIndex]);
    }
    updateScoreDisplay(); // Refresh score/time display
}


function renderNarrativeScreen(title, narrative, imageUrl, audioUrl) {
    gameContentDiv.innerHTML = `
        <div class="narrative-display">
            <h2>${title}</h2>
            ${imageUrl ? `<img src="${imageUrl}" alt="Imagen de la narrativa">` : ''}
            <p>${narrative}</p>
            ${audioUrl ? `<audio controls class="player-audio" src="${audioUrl}"></audio>` : ''}
        </div>
    `;
    nextNarrativeBtn.classList.remove('hidden');
    endGameBtn.classList.add('hidden'); // Ensure end game button is hidden during narrative
}

function renderTrial(trial) {
    currentTrialStartTime = new Date(); // Reset trial start time for score calculation
    gameContentDiv.innerHTML = `
        <div class="trial-display">
            <h2>Prueba: ${trial.type.toUpperCase()}</h2>
            ${trial.image_url ? `<img src="${trial.image_url}" alt="Imagen de la prueba">` : ''}
            <p>${trial.narrative}</p>
            ${trial.audio_url ? `<audio controls class="player-audio" src="${trial.audio_url}"></audio>` : ''}
            <div class="trial-controls" id="specific-trial-controls">
                </div>
            <div class="hint-info">
                Pistas disponibles: <span id="hints-left">${getHintsLeft(trial.id)}</span> (Coste: <span id="hint-cost">${trial.hint_cost}</span> pts)
            </div>
            <button id="request-hint-btn" class="btn btn-secondary mt-10" ${getHintsLeft(trial.id) === 0 ? 'disabled' : ''}>Pedir Pista</button>
            <div id="hint-display" class="hint-text hidden mt-10"></div>
        </div>
    `;

    const specificControlsDiv = document.getElementById('specific-trial-controls');
    const requestHintBtn = document.getElementById('request-hint-btn');
    const hintDisplayDiv = document.getElementById('hint-display');

    requestHintBtn.onclick = () => requestHint(trial);

    switch (trial.type) {
        case 'qr':
            renderQrTrial(trial, specificControlsDiv);
            break;
        case 'gps':
            renderGpsTrial(trial, specificControlsDiv);
            break;
        case 'text':
            renderTextTrial(trial, specificControlsDiv);
            break;
    }

    nextNarrativeBtn.classList.add('hidden'); // Hide "Siguiente" during active trial
    endGameBtn.classList.add('hidden'); // Hide end game button during active trial
}

// --- QR Trial ---
async function renderQrTrial(trial, container) {
    container.innerHTML = `
        <p>Escanea el código QR para revelar la respuesta.</p>
        <div id="qr-reader" style="width:100%"></div>
        <button id="stop-qr-scanner-btn" class="btn btn-secondary hidden mt-10">Detener Escáner</button>
    `;

    html5QrCode = new Html5Qrcode("qr-reader");
    const stopQrScannerBtn = document.getElementById('stop-qr-scanner-btn');

    const qrCodeSuccessCallback = async (decodedText, decodedResult) => {
        showAlert('QR escaneado: ' + decodedText, 'info');
        // Stop scanning to prevent multiple reads
        if (html5QrCode.is  Scanning) {
            await html5QrCode.stop();
            stopQrScannerBtn.classList.add('hidden');
        }
        validateAnswer(trial, decodedText);
    };

    const qrCodeErrorCallback = (errorMessage) => {
        // console.warn(`QR error = ${errorMessage}`); // Too chatty for user, log to console
    };

    try {
        await html5QrCode.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            qrCodeSuccessCallback,
            qrCodeErrorCallback
        );
        stopQrScannerBtn.classList.remove('hidden');
        stopQrScannerBtn.onclick = async () => {
            if (html5QrCode.isScanning) {
                await html5QrCode.stop();
                stopQrScannerBtn.classList.add('hidden');
                showAlert('Escáner QR detenido.', 'info');
            }
        };
    } catch (err) {
        console.error("Error starting QR scanner:", err);
        showAlert('No se pudo iniciar el escáner QR. Asegúrate de dar permisos a la cámara.', 'error');
        stopQrScannerBtn.classList.add('hidden');
    }
}

// --- GPS Trial ---
async function renderGpsTrial(trial, container) {
    container.innerHTML = `
        <p>Dirígete a la ubicación indicada y pulsa "Comprobar GPS".</p>
        <div id="map"></div>
        <p class="distance-info">Distancia a objetivo: <span id="distance-display">Calculando...</span></p>
        <button id="check-gps-btn" class="btn btn-primary">Comprobar GPS</button>
    `;

    const distanceDisplay = document.getElementById('distance-display');
    const checkGpsBtn = document.getElementById('check-gps-btn');

    // Initialize Map
    if (map) { map.remove(); } // Ensure old map is removed
    map = L.map('map').setView([trial.latitude, trial.longitude], 16); // Center on target
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Destination marker
    destinationMarker = L.marker([trial.latitude, trial.longitude])
        .addTo(map)
        .bindPopup('Tu objetivo')
        .openPopup();

    // Player current location marker (initially hidden)
    mapMarker = L.marker([0, 0]).addTo(map).bindPopup('Tu posición').setOpacity(0);

    // Invalidate size after map div is rendered and visible
    setTimeout(() => { map.invalidateSize(); }, 0);

    const checkLocation = () => {
        if (navigator.geolocation) {
            showAlert('Obteniendo ubicación actual...', 'info');
            checkGpsBtn.disabled = true;

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    checkGpsBtn.disabled = false;
                    const userLat = position.coords.latitude;
                    const userLon = position.coords.longitude;
                    const accuracy = position.coords.accuracy;

                    // Update player marker
                    mapMarker.setLatLng([userLat, userLon]).setOpacity(1);
                    map.setView([userLat, userLon]); // Center map on player

                    const distance = calculateDistance(userLat, userLon, trial.latitude, trial.longitude);
                    distanceDisplay.textContent = `${distance.toFixed(2)} metros (precisión: ${accuracy.toFixed(2)}m)`;

                    if (distance <= trial.tolerance) {
                        showAlert('¡Ubicación correcta!', 'success');
                        validateAnswer(trial, 'GPS_OK'); // A dummy answer for validation
                    } else {
                        showAlert(`Estás a ${distance.toFixed(2)} metros. Sigue buscando.`, 'warning');
                    }
                },
                (error) => {
                    checkGpsBtn.disabled = false;
                    showAlert('Error al obtener la ubicación: ' + error.message, 'error');
                    console.error('Geolocation error:', error);
                    distanceDisplay.textContent = 'Error al obtener ubicación.';
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        } else {
            showAlert('Tu navegador no soporta geolocalización.', 'error');
            distanceDisplay.textContent = 'Geolocalización no soportada.';
        }
    };

    checkGpsBtn.onclick = checkLocation;
}

// Haversine formula to calculate distance between two lat/lon points in meters
function calculateDistance(lat1, lon1, lat2, lon2) {
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

// --- Text Trial ---
function renderTextTrial(trial, container) {
    let htmlContent = `<p>${trial.question}</p>`;
    const options = trial.options || [];

    switch (trial.response_type) {
        case 'unique':
        case 'numeric':
            htmlContent += `
                <input type="text" id="text-answer-input" placeholder="Tu respuesta" required>
                <button id="submit-text-answer-btn" class="btn btn-primary">Enviar Respuesta</button>
            `;
            container.innerHTML = htmlContent;
            document.getElementById('submit-text-answer-btn').onclick = () => {
                const answer = document.getElementById('text-answer-input').value.trim();
                validateAnswer(trial, answer);
            };
            break;
        case 'multiple-choice':
            htmlContent += `<div class="options-list" id="mc-options-list">`;
            options.forEach((option, index) => {
                htmlContent += `
                    <label class="option-item">
                        <input type="radio" name="mc-option" value="${option}">
                        <span>${option}</span>
                    </label>
                `;
            });
            htmlContent += `</div><button id="submit-mc-answer-btn" class="btn btn-primary mt-10">Enviar Respuesta</button>`;
            container.innerHTML = htmlContent;
            document.getElementById('submit-mc-answer-btn').onclick = () => {
                const selectedOption = document.querySelector('input[name="mc-option"]:checked');
                if (selectedOption) {
                    validateAnswer(trial, selectedOption.value);
                } else {
                    showAlert('Por favor, selecciona una opción.', 'warning');
                }
            };
            break;
        case 'ordering':
            htmlContent += `<div class="ordering-options-list" id="ordering-list">`;
            // Shuffle options for ordering
            const shuffledOptions = [...options].sort(() => Math.random() - 0.5);
            shuffledOptions.forEach((option, index) => {
                htmlContent += `
                    <div class="draggable-item" draggable="true" data-value="${option}">
                        <span class="draggable-handle">☰</span>
                        <span>${option}</span>
                    </div>
                `;
            });
            htmlContent += `</div><button id="submit-ordering-answer-btn" class="btn btn-primary mt-10">Enviar Orden</button>`;
            container.innerHTML = htmlContent;
            setupDragAndDrop('ordering-list');
            document.getElementById('submit-ordering-answer-btn').onclick = () => {
                const orderedItems = Array.from(document.querySelectorAll('#ordering-list .draggable-item'));
                const playerAnswer = orderedItems.map(item => item.dataset.value).join(';');
                validateAnswer(trial, playerAnswer);
            };
            break;
    }
}

function setupDragAndDrop(containerId) {
    const list = document.getElementById(containerId);
    let draggedItem = null;

    list.addEventListener('dragstart', (e) => {
        draggedItem = e.target.closest('.draggable-item');
        if (draggedItem) {
            draggedItem.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', draggedItem.dataset.value); // Data for fallback
        }
    });

    list.addEventListener('dragover', (e) => {
        e.preventDefault();
        const target = e.target.closest('.draggable-item');
        if (target && draggedItem && target !== draggedItem) {
            const boundingBox = target.getBoundingClientRect();
            const offset = boundingBox.y + (boundingBox.height / 2);
            if (e.clientY < offset) {
                list.insertBefore(draggedItem, target);
            } else {
                list.insertBefore(draggedItem, target.nextSibling);
            }
        }
    });

    list.addEventListener('dragend', () => {
        if (draggedItem) {
            draggedItem.classList.remove('dragging');
            draggedItem = null;
        }
    });
}


// --- Answer Validation & Scoring ---
async function validateAnswer(trial, playerAnswer) {
    let isCorrect = false;
    const correctAnswers = String(trial.correct_answer).toLowerCase().split(';').map(s => s.trim());
    const playerAnswerFormatted = String(playerAnswer).toLowerCase().trim();

    switch (trial.type) {
        case 'qr':
            isCorrect = correctAnswers.includes(playerAnswerFormatted);
            break;
        case 'gps':
            // GPS validation is done in renderGpsTrial, this is just to log completion
            isCorrect = (playerAnswerFormatted === 'gps_ok');
            break;
        case 'text':
            switch (trial.response_type) {
                case 'unique':
                    isCorrect = correctAnswers.includes(playerAnswerFormatted);
                    break;
                case 'numeric':
                    isCorrect = (parseFloat(playerAnswerFormatted) === parseFloat(correctAnswers[0]));
                    break;
                case 'multiple-choice':
                    isCorrect = correctAnswers.includes(playerAnswerFormatted);
                    break;
                case 'ordering':
                    // playerAnswer is 'Option1;Option2;Option3'
                    // correct_answer is 'Correct1;Correct2;Correct3'
                    isCorrect = (playerAnswerFormatted === correctAnswers[0]); // assuming correct_answer is stored as a single string "Opt1;Opt2;Opt3"
                    break;
            }
            break;
    }

    if (isCorrect) {
        const timeTaken = Math.floor((new Date().getTime() - currentTrialStartTime.getTime()) / 1000);
        const hintsUsedInTrial = currentTeam.hints_used_per_trial.find(h => h.trialId === trial.id)?.count || 0;

        const scoreForTrial = Math.max(0, currentGame.initial_score_per_trial - timeTaken - (hintsUsedInTrial * trial.hint_cost));

        currentTeam.total_score += scoreForTrial;
        currentTeam.progress_log.push({
            trial_id: trial.id,
            time_taken: timeTaken,
            score_earned: scoreForTrial,
            hints_used: hintsUsedInTrial,
            completion_time: new Date().toISOString()
        });
        currentTeam.last_activity = new Date().toISOString();

        showAlert('¡Respuesta Correcta! Puntos obtenidos: ' + scoreForTrial, 'success');
        await saveTeamState(currentTeam);
        await syncTeamStateWithSupabase();
        updateScoreDisplay(); // Refresh UI score
        await advanceGame(); // Move to next trial/location/end game
    } else {
        showAlert('Respuesta Incorrecta. ¡Sigue intentándolo!', 'error');
    }
}

async function advanceGame() {
    const currentLocIndex = currentLocations.findIndex(loc => loc.id === currentTeam.current_location_id);
    const currentTrialIndex = currentTrials.findIndex(trial => trial.id === currentTeam.current_trial_id);

    // If there's a next trial in the current location
    if (currentTrialIndex !== -1 && currentTrialIndex < currentTrials.length - 1) {
        currentTeam.current_trial_id = currentTrials[currentTrialIndex + 1].id;
        currentTeam.last_trial_start_time = new Date().toISOString();
        await saveTeamState(currentTeam);
        await syncTeamStateWithSupabase();
        renderTrial(currentTrials[currentTrialIndex + 1]);
    }
    // If no more trials in current location, move to next location
    else if (currentLocIndex < currentLocations.length - 1) {
        currentTeam.current_location_id = currentLocations[currentLocIndex + 1].id;
        currentTeam.current_trial_id = null; // Reset trial ID to trigger location narrative
        await fetchTrialsForLocation(currentTeam.current_location_id);
        currentTeam.last_activity = new Date().toISOString();
        await saveTeamState(currentTeam);
        await syncTeamStateWithSupabase();
        await renderCurrentGameContent(); // Will render location narrative
    }
    // If no more locations, game is over
    else {
        await endGame();
    }
}

// --- Hint System ---
function getHintsLeft(trialId) {
    const trial = currentTrials.find(t => t.id === trialId);
    if (!trial) return 0;
    const hintsUsed = currentTeam.hints_used_per_trial.find(h => h.trialId === trialId)?.count || 0;
    return trial.hints_available - hintsUsed;
}

function requestHint(trial) {
    const hintsLeft = getHintsLeft(trial.id);
    const hintDisplayDiv = document.getElementById('hint-display');
    const hintsLeftSpan = document.getElementById('hints-left');
    const requestHintBtn = document.getElementById('request-hint-btn');

    if (hintsLeft > 0) {
        // Increment hint count for this trial
        let hintsUsedEntry = currentTeam.hints_used_per_trial.find(h => h.trialId === trial.id);
        if (hintsUsedEntry) {
            hintsUsedEntry.count++;
        } else {
            currentTeam.hints_used_per_trial.push({ trialId: trial.id, count: 1 });
        }
        currentTeam.hints_used_global++;
        currentTeam.total_score = Math.max(0, currentTeam.total_score - trial.hint_cost); // Deduct points immediately
        currentTeam.last_activity = new Date().toISOString();

        showAlert(`¡Pista utilizada! Coste: ${trial.hint_cost} puntos.`, 'info');
        hintDisplayDiv.textContent = `Pista: ${getHintContent(trial, hintsUsedEntry ? hintsUsedEntry.count : 1)}`; // Display actual hint content
        hintDisplayDiv.classList.remove('hidden');

        hintsLeftSpan.textContent = getHintsLeft(trial.id); // Update UI
        updateScoreDisplay(); // Update score display

        if (getHintsLeft(trial.id) === 0) {
            requestHintBtn.disabled = true;
        }

        saveTeamState(currentTeam).then(() => syncTeamStateWithSupabase());

    } else {
        showAlert('No quedan más pistas para esta prueba.', 'warning');
        requestHintBtn.disabled = true;
    }
}

// Dummy hint content - in a real app, this would come from the trial object
function getHintContent(trial, hintNumber) {
    // This part should be improved: hints should be stored in the trial object in Supabase
    // For now, returning a generic message + trial type
    // If trial object had hint1, hint2, hint3 properties:
    // if (hintNumber === 1 && trial.hint1) return trial.hint1;
    // if (hintNumber === 2 && trial.hint2) return trial.hint2;
    // if (hintNumber === 3 && trial.hint3) return trial.hint3;

    return `Pista ${hintNumber} para la prueba de ${trial.type}. Piensa en la narrativa y los elementos visuales.`;
}

// --- Game End ---
async function endGame() {
    stopGameTimer(); // Stop the global timer

    // Final update of total_time and total_score in currentTeam
    if (currentTeam && currentTeam.start_time) {
        currentTeam.total_time = Math.floor((new Date().getTime() - new Date(currentTeam.start_time).getTime()) / 1000);
        // Ensure final score reflects any last penalties (e.g. time)
        // If scoring is per-trial, total_score should already be accurate.
        // If there's a final penalty not tied to trials, apply here.
    }

    // Save final state and sync
    if (currentTeam) {
        currentTeam.current_location_id = null; // Mark game as finished
        currentTeam.current_trial_id = null;
        currentTeam.last_activity = new Date().toISOString();

        // Insert into rankings table
        const { data: rankingEntry, error: rankingError } = await supabase
            .from('rankings')
            .insert({
                team_id: currentTeam.id,
                game_id: currentTeam.game_id,
                final_score: currentTeam.total_score,
                completion_time: currentTeam.total_time,
                completion_date: new Date().toISOString()
            })
            .select()
            .single();

        if (rankingError) {
            console.error("Error saving ranking:", rankingError.message);
            showAlert('Error al guardar tu ranking. Inténtalo de nuevo más tarde.', 'error');
        } else {
            console.log("Ranking saved:", rankingEntry);
            showAlert('¡Tu aventura ha terminado y tu puntuación ha sido registrada!', 'success');
        }

        await saveTeamState(currentTeam); // Save final state locally
        await syncTeamStateWithSupabase(); // Final sync

        // Display final summary
        finalTeamNameSpan.textContent = currentTeam.team_name;
        finalGameTitleSpan.textContent = currentGame.title;
        finalScoreDisplay.textContent = currentTeam.total_score;
        finalTimeDisplay.textContent = formatTime(currentTeam.total_time);

        // Optional: Fetch global ranking for this game and show player's rank
        await showPlayerRank(currentTeam.game_id, currentTeam.id, currentTeam.total_score, currentTeam.total_time);
    } else {
        showAlert('No se encontraron datos del equipo para finalizar el juego.', 'warning');
    }

    await clearTeamState(); // Clear local state after game completion
    showScreen(gameOverScreen);
}

async function showPlayerRank(gameId, teamId, playerScore, playerTime) {
    const { data: rankings, error } = await supabase
        .from('rankings')
        .select(`
            id,
            final_score,
            completion_time,
            teams (id, team_name)
        `)
        .eq('game_id', gameId)
        .order('final_score', { ascending: false }) // Higher score first
        .order('completion_time', { ascending: true }); // Then faster time

    if (error) {
        console.error("Error fetching rankings for player rank:", error);
        finalRankMessage.textContent = 'No se pudo obtener el ranking.';
        return;
    }

    const playerRankIndex = rankings.findIndex(r => r.teams && r.teams.id === teamId);
    if (playerRankIndex !== -1) {
        finalRankMessage.textContent = `Estás en la posición #${playerRankIndex + 1} de ${rankings.length} equipos.`;
    } else {
        finalRankMessage.textContent = 'Tu ranking no pudo ser determinado. ¡Pero lo lograste!';
    }
}


backToMenuBtn.addEventListener('click', () => {
    location.reload(); // Simple way to reset app to game selection
});

// --- Modals ---
modalCloseBtn.addEventListener('click', () => {
    modalContainer.classList.add('hidden');
});

function showModal(title, message) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modalContainer.classList.remove('hidden');
}

// --- Global event listeners ---
// Add the event listener for the End Game button, which might appear dynamically
endGameBtn.addEventListener('click', async () => {
    if (confirm('¿Estás seguro de que quieres finalizar el juego? Perderás el progreso actual si no has completado la última prueba.')) {
        await endGame();
    }
});