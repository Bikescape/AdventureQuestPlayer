// player/script.js

document.addEventListener('DOMContentLoaded', async () => {
    // Attempt to load game state from IndexedDB
    const loaded = await loadGameState();

    if (loaded && gameState.isGameActive && gameState.teamId && gameState.gameId) {
        // If a game was active, try to resume it
        await resumeGame();
    } else {
        // Otherwise, show the welcome screen and load active games
        showScreen('loading-screen');
        setTimeout(async () => {
            console.log('Intentando cargar juegos activos...');
            const activeGames = await loadActiveGames(); // Ahora solo obtiene los datos
            console.log('Juegos activos recibidos:', activeGames);

            if (activeGames && activeGames.length > 0) {
                // Llama a la función de ui-manager para display
                displayActiveGames(activeGames);
                console.log('Juegos activos mostrados en la UI.');
            } else {
                console.log('No se encontraron juegos activos o hubo un problema al mostrarlos.');
                // Muestra un mensaje si no hay juegos
                document.getElementById('active-games-list').innerHTML = '<p class="info-message">No hay aventuras activas en este momento. ¡Crea una desde el panel de administración!</p>';
            }
            showScreen('welcome-screen'); // Cambia a la pantalla de bienvenida
        }, 500);
    }

    setupPlayerEventListeners();
    updateGameUI(); // Initial UI update for score/hints
});

function setupPlayerEventListeners() {
    // Welcome Screen
    document.getElementById('create-team-btn').addEventListener('click', handleCreateTeam);
    // Ya no se añade el listener directamente aquí, se hace por delegación en ui-manager.js
    // document.getElementById('active-games-list').addEventListener('click', handleGameSelection);

    // Game Description Screen
    document.getElementById('game-desc-back-btn').addEventListener('click', async () => {
        if (confirm('¿Estás seguro de que quieres volver? Se perderá el juego si no lo has iniciado.')) {
            await clearGameState(); // Clear state if not started
            await loadActiveGames(); // Reload games as fresh start
            showScreen('welcome-screen');
        }
    });
    document.getElementById('start-game-btn').addEventListener('click', startGame);

    // Game Play Screen
    document.getElementById('submit-answer-btn').addEventListener('click', handleSubmitAnswer);
    document.getElementById('request-hint-btn').addEventListener('click', handleRequestHint);
    document.getElementById('abandon-game-btn').addEventListener('click', abandonGame);

    // QR Scanner Screen
    document.getElementById('start-qr-scan-btn').addEventListener('click', startQrScan);
    document.getElementById('stop-qr-scan-btn').addEventListener('click', stopQrScanner); // Se usará para detener el scanner si hay problemas

    // Interlude Screen
    document.getElementById('continue-interlude-btn').addEventListener('click', handleContinueInterlude);

    // Game End Screen
    document.getElementById('back-to-welcome-btn').addEventListener('click', async () => {
        await clearGameState();
        await loadActiveGames();
        showScreen('welcome-screen');
    });

    // Event listener para el botón "Crear Equipo" en el modal
    document.getElementById('team-name-confirm-btn').addEventListener('click', async () => {
        const teamNameInput = document.getElementById('team-name-input');
        const teamName = teamNameInput.value.trim();
        const selectedGameId = teamNameInput.dataset.selectedGameId; // Obtener el gameId del dataset
        if (teamName && selectedGameId) {
            await createTeamAndStartGame(teamName, selectedGameId);
            hideModal('team-name-modal');
        } else {
            showAlert('Por favor, ingresa un nombre de equipo.', 'warning');
        }
    });

    // Event listener para el botón "Cancelar" del modal de equipo
    document.getElementById('team-name-cancel-btn').addEventListener('click', () => {
        hideModal('team-name-modal');
        // Opcional: Volver a la pantalla de bienvenida si se cancela el equipo
        showScreen('welcome-screen');
    });
}

// Global function to handle game selection from ui-manager.js
window.handleGameSelection = async (event) => {
    const gameId = event.target.dataset.gameId;
    if (gameId) {
        console.log(`Juego seleccionado: ${gameId}`);
        const gameDetails = await getGameDetails(gameId);
        if (gameDetails) {
            gameState.currentGame = gameDetails;
            displayGameDescription(gameDetails);
            // Almacenar el gameId en el input del nombre de equipo para usarlo después
            document.getElementById('team-name-input').dataset.selectedGameId = gameId;
            showScreen('game-desc-screen');
        }
    }
};


async function loadActiveGames() {
    // Esta función ahora solo es responsable de obtener los datos.
    // La renderización se delega a displayActiveGames en ui-manager.js
    console.log('Cargando juegos activos desde Supabase...');
    const games = await getActiveGames();
    return games;
}

// Función para mostrar la descripción del juego y preparar el inicio
function displayGameDescription(game) {
    document.getElementById('game-desc-title').textContent = game.title;
    document.getElementById('game-desc-description').textContent = game.description;
    document.getElementById('game-desc-mechanics').textContent = game.mechanics;
    document.getElementById('game-desc-narrative').textContent = game.initial_narrative;

    const gameDescMediaContainer = document.getElementById('game-desc-media');
    renderMedia(game.image_url, game.audio_url, gameDescMediaContainer);
}


async function handleCreateTeam() {
    // Mostrar el modal para ingresar el nombre del equipo
    showModal('team-name-modal');
    document.getElementById('team-name-input').value = ''; // Limpiar campo
    // Asegurarse de que el gameId esté seteado si ya se seleccionó un juego antes
    // o el usuario simplemente quiere crear un equipo sin seleccionar un juego (menos común para este flujo)
}


async function createTeamAndStartGame(teamName, gameId) {
    try {
        const newTeam = await createTeam(teamName, gameId);
        if (newTeam) {
            gameState.currentTeam = newTeam;
            gameState.teamId = newTeam.id;
            gameState.gameId = gameId;
            gameState.isGameActive = true;
            gameState.gameStartTime = Date.now(); // Record game start time

            await saveGameState(); // Save initial game state

            showAlert(`Equipo "${teamName}" creado. ¡Aventura iniciada!`, 'success');
            await loadGameAndStartFirstLocation(gameId, newTeam.id);
        }
    } catch (error) {
        console.error('Error creating team and starting game:', error);
        showAlert('Error al crear equipo o iniciar el juego.', 'error');
    }
}


async function loadGameAndStartFirstLocation(gameId, teamId) {
    try {
        const gameDetails = await getGameDetails(gameId);
        if (!gameDetails) {
            showAlert('No se pudieron cargar los detalles del juego.', 'error');
            return;
        }
        gameState.currentGame = gameDetails;
        gameState.locations = gameDetails.locations || [];

        if (gameState.locations.length === 0) {
            showAlert('Este juego no tiene localizaciones definidas.', 'warning');
            showScreen('welcome-screen');
            return;
        }

        // Determine which location to load (first one or specific from team state)
        let locationToLoad = null;
        let trialToLoad = null;

        // Fetch team's last known state
        const teamState = await getTeamState(teamId);
        if (teamState && teamState.current_location_id) {
            locationToLoad = gameState.locations.find(loc => loc.id === teamState.current_location_id);
            if (locationToLoad && teamState.current_trial_id) {
                trialToLoad = locationToLoad.trials.find(trial => trial.id === teamState.current_trial_id);
            }
        }

        if (locationToLoad) {
            // Resume existing game
            gameState.currentLocation = locationToLoad;
            gameState.trials = locationToLoad.trials || [];
            gameState.playerScore = teamState.total_score || 0;
            gameState.totalHintsUsed = teamState.hints_used_global || 0;
            gameState.progressLog = teamState.progress_log || [];
            gameState.gameStartTime = new Date(teamState.last_activity).getTime() - (teamState.total_time * 1000 || 0); // Reconstruct game start time

            showAlert('Juego reanudado desde el último punto guardado.', 'info');
            // If a specific trial needs to be resumed, find its index
            let trialIndexToResume = 0;
            if (trialToLoad) {
                trialIndexToResume = gameState.trials.findIndex(t => t.id === trialToLoad.id);
                if (trialIndexToResume === -1) trialIndexToResume = 0; // Fallback
            }
            displayLocationOrTrial(trialIndexToResume);

        } else {
            // Start new game at first location
            gameState.currentLocation = gameState.locations[0];
            gameState.trials = gameState.currentLocation.trials || [];
            gameState.playerScore = 0;
            gameState.totalHintsUsed = 0;
            gameState.progressLog = [];
            gameState.gameStartTime = Date.now(); // New game start time

            displayLocationOrTrial(0); // Display the first trial/location intro
        }

        await saveGameState(); // Save initial state after loading

    } catch (error) {
        console.error('Error loading game and starting location:', error);
        showAlert('Error al cargar la aventura.', 'error');
        showScreen('welcome-screen');
    }
}

async function resumeGame() {
    console.log('Reanudando juego...');
    showAlert('Reanudando tu aventura...', 'info');

    try {
        const teamState = await getTeamState(gameState.teamId);
        if (!teamState) {
            console.error('No se pudo cargar el estado del equipo para reanudar.');
            showAlert('No se pudo reanudar la aventura. Intenta iniciar una nueva.', 'error');
            await clearGameState();
            await loadActiveGames();
            showScreen('welcome-screen');
            return;
        }

        gameState.currentTeam = teamState;
        gameState.playerScore = teamState.total_score || 0;
        gameState.totalHintsUsed = teamState.hints_used_global || 0;
        gameState.progressLog = teamState.progress_log || [];
        gameState.gameStartTime = Date.now() - (teamState.total_time * 1000 || 0); // Recalculate based on total_time
        gameState.trialStartTime = new Date(teamState.last_trial_start_time).getTime();


        const gameDetails = await getGameDetails(gameState.gameId);
        if (!gameDetails) {
            showAlert('No se pudieron cargar los detalles del juego para reanudar.', 'error');
            await clearGameState();
            await loadActiveGames();
            showScreen('welcome-screen');
            return;
        }
        gameState.currentGame = gameDetails;
        gameState.locations = gameDetails.locations || [];

        const currentLoc = gameState.locations.find(loc => loc.id === teamState.current_location_id);
        if (!currentLoc) {
            showAlert('La localización actual no se encontró. Reiniciando juego.', 'warning');
            await clearGameState(); // Clear invalid state
            await loadActiveGames();
            showScreen('welcome-screen');
            return;
        }
        gameState.currentLocation = currentLoc;
        gameState.trials = currentLoc.trials || [];

        let trialIndexToResume = 0;
        if (teamState.current_trial_id) {
            trialIndexToResume = gameState.trials.findIndex(t => t.id === teamState.current_trial_id);
            if (trialIndexToResume === -1) {
                console.warn('Current trial not found in location, starting from first trial.');
                trialIndexToResume = 0;
            }
        }

        displayLocationOrTrial(trialIndexToResume);
        showAlert('Aventura reanudada con éxito.', 'success');
        updateGameUI();
        await saveGameState(); // Save the reloaded state
    } catch (error) {
        console.error('Error resuming game:', error);
        showAlert('Error al reanudar la aventura. Inicia una nueva.', 'error');
        await clearGameState();
        await loadActiveGames();
        showScreen('welcome-screen');
    }
}


function displayLocationOrTrial(trialIndex) {
    if (!gameState.currentLocation) {
        console.error('No current location set.');
        showAlert('Error: No se encontró la ubicación actual.', 'error');
        showScreen('welcome-screen');
        return;
    }

    // Check if this is the very first trial of the location
    const isFirstTrialOfLocation = (trialIndex === 0 && !gameState.currentTrial);

    if (isFirstTrialOfLocation && gameState.currentLocation.initial_narrative) {
        // Show location intro narrative
        showInterludeScreen(
            gameState.currentLocation.name,
            gameState.currentLocation.initial_narrative,
            gameState.currentLocation.image_url,
            gameState.currentLocation.audio_url,
            () => {
                // After interlude, show the actual first trial
                loadTrial(trialIndex);
            }
        );
    } else {
        // Load the trial directly
        loadTrial(trialIndex);
    }
}


function loadTrial(trialIndex) {
    if (trialIndex >= gameState.trials.length) {
        // All trials in this location completed
        handleLocationCompletion();
        return;
    }

    gameState.currentTrial = gameState.trials[trialIndex];
    gameState.trialStartTime = Date.now(); // Reset trial start time for score calculation
    gameState.hintsUsedInTrial = 0; // Reset hints for this trial

    // Update team state in DB with new current_trial_id
    updateTeamState(gameState.teamId, {
        current_location_id: gameState.currentLocation.id,
        current_trial_id: gameState.currentTrial.id,
        last_trial_start_time: new Date(gameState.trialStartTime).toISOString()
    });

    displayTrial(gameState.currentTrial); // Render the trial UI
    updateGameUI(); // Update score/hints in header
    saveGameState(); // Save current state
    startTrialTimer(); // Start the timer for the trial
}


async function handleLocationCompletion() {
    console.log(`Localización "${gameState.currentLocation.name}" completada.`);
    showAlert(`¡Localización "${gameState.currentLocation.name}" completada!`, 'success');

    // Find the index of the current location
    const currentLocIndex = gameState.locations.findIndex(loc => loc.id === gameState.currentLocation.id);

    // Check if there's a next location
    if (currentLocIndex < gameState.locations.length - 1) {
        const nextLocation = gameState.locations[currentLocIndex + 1];

        // Show interlude before next location, if available
        if (nextLocation.initial_narrative) {
            showInterludeScreen(
                `¡Pasas a la siguiente área: ${nextLocation.name}!`,
                nextLocation.initial_narrative,
                nextLocation.image_url,
                nextLocation.audio_url,
                () => {
                    // After interlude, load the next location
                    gameState.currentLocation = nextLocation;
                    gameState.trials = nextLocation.trials || [];
                    loadTrial(0); // Load the first trial of the new location
                }
            );
        } else {
            // No interlude, just move to the next location
            gameState.currentLocation = nextLocation;
            gameState.trials = nextLocation.trials || [];
            loadTrial(0); // Load the first trial of the new location
        }
    } else {
        // Game completed!
        await endGame();
    }
}


function startTrialTimer() {
    stopTimers(); // Stop any existing trial timer
    let secondsElapsed = 0;

    // Load any previously elapsed time for this trial if resuming
    const trialLog = gameState.progressLog.find(log => log.trialId === gameState.currentTrial.id);
    if (trialLog && trialLog.timeTaken) {
        secondsElapsed = trialLog.timeTaken;
    } else if (gameState.trialStartTime) {
        secondsElapsed = Math.floor((Date.now() - gameState.trialStartTime) / 1000);
    }

    updateTrialTimerDisplay(secondsElapsed);

    gameState.trialTimerInterval = setInterval(() => {
        secondsElapsed++;
        updateTrialTimerDisplay(secondsElapsed);
    }, 1000);
}

function stopTimers() {
    if (gameState.trialTimerInterval) {
        clearInterval(gameState.trialTimerInterval);
        gameState.trialTimerInterval = null;
    }
}

async function handleSubmitAnswer() {
    stopTimers(); // Stop timer immediately on submission
    const answerInput = document.getElementById('answer-input');
    const qrScanResultDiv = document.getElementById('qr-scan-result');
    const gpsCheckResultDiv = document.getElementById('gps-check-result');

    let userAnswer;
    let isCorrect = false;
    let feedbackMessage = '';

    const currentTrial = gameState.currentTrial;

    if (!currentTrial) {
        showAlert('No hay prueba activa.', 'error');
        return;
    }

    switch (currentTrial.type) {
        case 'text':
            userAnswer = answerInput ? answerInput.value.trim() : '';
            if (currentTrial.response_type === 'unique' || currentTrial.response_type === 'numeric') {
                isCorrect = userAnswer.toLowerCase() === currentTrial.correct_answer.toLowerCase();
            } else if (currentTrial.response_type === 'options') {
                isCorrect = gameState.currentSelectedOption === currentTrial.correct_answer_index;
            } else if (currentTrial.response_type === 'ordering') {
                // currentOrderingAttempt stores the reordered array
                isCorrect = JSON.stringify(gameState.currentOrderingAttempt) === JSON.stringify(currentTrial.correct_answer_order);
            }
            break;
        case 'qr':
            userAnswer = gameState.qrScanResult;
            isCorrect = (userAnswer === currentTrial.qr_content);
            if (!userAnswer) {
                showAlert('Por favor, escanea un código QR primero.', 'warning');
                return;
            }
            break;
        case 'gps':
            const gpsResult = gameState.gpsCheckResult;
            if (!gpsResult || !gpsResult.success) {
                showAlert('No estás en la ubicación correcta. Intenta de nuevo.', 'warning');
                return;
            }
            userAnswer = `Lat: ${gpsResult.latitude.toFixed(5)}, Lon: ${gpsResult.longitude.toFixed(5)}`;
            isCorrect = gpsResult.success;
            break;
        default:
            showAlert('Tipo de prueba no reconocido.', 'error');
            return;
    }

    // Validate answer with backend
    const validationResult = await validateAnswer(
        gameState.teamId,
        gameState.currentTrial.id,
        isCorrect, // Pass true/false for direct validation
        Math.floor((Date.now() - gameState.trialStartTime) / 1000), // Time taken for this trial
        gameState.hintsUsedInTrial // Hints used for this trial
    );

    if (validationResult && validationResult.success) {
        gameState.playerScore = validationResult.newScore;
        gameState.totalHintsUsed = validationResult.totalHintsUsed; // Update global hints
        gameState.currentTeam.total_score = gameState.playerScore;
        gameState.currentTeam.total_time = validationResult.newTotalTime;
        gameState.currentTeam.hints_used_global = gameState.totalHintsUsed;
        gameState.currentTeam.hints_used_per_trial = validationResult.hintsUsedPerTrial; // Update array

        // Add to progress log
        gameState.progressLog.push({
            trialId: gameState.currentTrial.id,
            locationId: gameState.currentLocation.id,
            timeTaken: validationResult.trialTimeTaken,
            scoreEarned: validationResult.scoreEarned,
            hintsUsed: gameState.hintsUsedInTrial,
            completedAt: new Date().toISOString()
        });
        gameState.currentTeam.progress_log = gameState.progressLog;


        showAlert('¡Respuesta Correcta!', 'success');
        playSuccessSound();
        updateGameUI();
        await saveGameState(); // Save updated state

        // Move to next trial/location
        const currentTrialIndex = gameState.trials.findIndex(t => t.id === gameState.currentTrial.id);
        if (currentTrialIndex < gameState.trials.length - 1) {
            loadTrial(currentTrialIndex + 1);
        } else {
            handleLocationCompletion(); // All trials in current location done
        }

    } else {
        feedbackMessage = validationResult ? validationResult.message : 'Respuesta incorrecta. Inténtalo de nuevo.';
        showAlert(feedbackMessage, 'error');
        playFailSound();
        // Allow player to try again. Keep timer running.
        startTrialTimer(); // Restart timer from current elapsed time
    }

    // Clear inputs/results after submission
    if (answerInput) answerInput.value = '';
    if (qrScanResultDiv) qrScanResultDiv.textContent = '';
    if (gpsCheckResultDiv) gpsCheckResultDiv.textContent = '';
    gameState.qrScanResult = null;
    gameState.gpsCheckResult = null;
    gameState.currentSelectedOption = null;
    gameState.currentOrderingAttempt = null;
}

async function handleRequestHint() {
    const currentTrial = gameState.currentTrial;
    if (!currentTrial) return;

    // Check if hints are available for this trial
    const hintsUsedForThisTrial = (gameState.currentTeam.hints_used_per_trial || [])
        .find(h => h.trialId === currentTrial.id)?.count || 0;

    if (hintsUsedForThisTrial >= currentTrial.hints.length) {
        showAlert('No quedan más pistas para esta prueba.', 'warning');
        return;
    }

    const hintCost = currentTrial.hint_cost || 10; // Default cost
    const hintText = currentTrial.hints[hintsUsedForThisTrial]; // Get the next hint

    const confirmHint = confirm(`¿Quieres usar una pista? Te costará ${hintCost} puntos.`);
    if (!confirmHint) {
        return;
    }

    // Log hint usage in DB
    const result = await logHintUsed(gameState.teamId, currentTrial.id, hintCost);

    if (result && result.success) {
        gameState.playerScore = result.newScore;
        gameState.totalHintsUsed = result.totalHintsUsed;
        gameState.currentTeam.total_score = gameState.playerScore;
        gameState.currentTeam.hints_used_global = gameState.totalHintsUsed;
        gameState.currentTeam.hints_used_per_trial = result.hintsUsedPerTrial; // Update the full array

        gameState.hintsUsedInTrial++; // Increment local counter for current trial

        showAlert(`Pista: ${hintText} (Coste: ${hintCost} puntos)`, 'info');
        updateGameUI(); // Update score and hints display
        await saveGameState(); // Save updated state
    } else {
        showAlert(result?.message || 'Error al solicitar pista.', 'error');
    }
}


// --- Helper Functions ---

function playSuccessSound() {
    const audio = new Audio('assets/sounds/success.mp3'); // Asegúrate de tener este archivo
    audio.play();
}

function playFailSound() {
    const audio = new Audio('assets/sounds/fail.mp3'); // Asegúrate de tener este archivo
    audio.play();
}

function updateTrialTimerDisplay(seconds) {
    const timerDisplay = document.getElementById('trial-timer');
    if (timerDisplay) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        timerDisplay.textContent = `Tiempo en prueba: ${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
}

function showGameEndScreen(teamName, gameTitle, finalScore, finalTime, totalHints) {
    document.getElementById('end-team-name').textContent = teamName;
    document.getElementById('end-game-title').textContent = gameTitle;
    document.getElementById('end-final-score').textContent = finalScore;
    document.getElementById('end-total-time').textContent = formatTime(finalTime);
    document.getElementById('end-hints-used').textContent = totalHints;
    showScreen('game-end-screen');
}

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s]
        .map(v => v.toString().padStart(2, '0'))
        .filter((v, i) => v !== '00' || i > 0 || h > 0) // Hide hours if zero, and ensure at least 00:00
        .join(':') || '00:00'; // Default to 00:00 if all are zero
}

// Global utility for alerts (can be moved to a shared utils.js)
function showAlert(message, type = 'info') {
    let alertDiv = document.getElementById('app-alert');
    if (!alertDiv) {
        alertDiv = document.createElement('div');
        alertDiv.id = 'app-alert';
        document.body.appendChild(alertDiv);
    }

    alertDiv.textContent = message;
    alertDiv.className = `app-alert ${type}`; // Clase base y tipo (info, success, warning, error)
    alertDiv.style.display = 'block';

    // Remove after 4 seconds
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.parentNode.removeChild(alertDiv);
        }
    }, 4000);
}


async function startQrScan() {
    // Hide trial screen and show QR scanner screen
    showScreen('qr-scanner-screen');
    await startQrScannerLib(handleQrScanSuccess);
}

function handleQrScanSuccess(decodedText) {
    gameState.qrScanResult = decodedText;
    showAlert(`QR escaneado: ${decodedText}`, 'success');
    showScreen('game-play-screen'); // Go back to game play screen
    // Optional: Auto-fill answer input for QR type trial
    const answerInput = document.getElementById('answer-input');
    if (answerInput && gameState.currentTrial && gameState.currentTrial.type === 'qr') {
        answerInput.value = decodedText;
        // Optionally, auto-submit if QR is the only validation needed
        // handleSubmitAnswer();
    }
}

async function checkGpsLocation() {
    showAlert('Comprobando ubicación GPS...', 'info');
    const targetLat = gameState.currentTrial.gps_latitude;
    const targetLon = gameState.currentTrial.gps_longitude;
    const tolerance = gameState.currentTrial.gps_tolerance || 10; // Default to 10 meters

    const result = await checkGeofence(targetLat, targetLon, tolerance);
    gameState.gpsCheckResult = result;

    if (result.success) {
        showAlert(`¡Ubicación correcta! Distancia: ${result.distance.toFixed(2)}m`, 'success');
        // Optionally, auto-submit if GPS is the only validation needed
        // handleSubmitAnswer();
    } else {
        showAlert(`No estás en la ubicación correcta. Distancia: ${result.distance.toFixed(2)}m. Precisión GPS: ${result.accuracy.toFixed(1)}m.`, 'error');
    }
}


function showInterludeScreen(title, narrative, imageUrl, audioUrl, onContinueCallback) {
    document.getElementById('interlude-title').textContent = title;
    document.getElementById('interlude-narrative').textContent = narrative;

    const interludeMediaContainer = document.getElementById('interlude-media');
    renderMedia(imageUrl, audioUrl, interludeMediaContainer);

    // Set up the continue button
    const continueBtn = document.getElementById('continue-interlude-btn');
    continueBtn.onclick = () => {
        // Clear media when continuing
        renderMedia(null, null, interludeMediaContainer);
        onContinueCallback();
    };
    showScreen('interlude-screen');
}