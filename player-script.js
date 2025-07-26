// player/script.js

// Global state is managed by player-game-state.js and exposed via `gameState` object

document.addEventListener('DOMContentLoaded', async () => {
    const loaded = await loadGameState();

    if (loaded && gameState.isGameActive && gameState.teamId && gameState.gameId) {
        await resumeGame();
    } else {
        showScreen('loading-screen'); // Esta es la pantalla donde te quedas
        setTimeout(async () => {
            console.log('Intentando cargar juegos activos...'); // <-- Añade esto
            const activeGames = await loadActiveGames(); // Esta es la función clave
            console.log('Juegos activos recibidos:', activeGames); // <-- Añade esto para ver qué devuelve

            if (activeGames && activeGames.length > 0) {
                displayActiveGames(activeGames); // <-- Asegúrate de que esta función se llama y existe
                console.log('Juegos activos mostrados en la UI.'); // <-- Añade esto
            } else {
                console.log('No se encontraron juegos activos o hubo un problema al mostrarlos.'); // <-- Añade esto
                // Puedes añadir un mensaje en la UI si no hay juegos
                document.getElementById('active-games-list').innerHTML = '<p>No hay aventuras activas en este momento. Intenta más tarde.</p>';
            }
            showScreen('welcome-screen'); // Esto debería cambiar a la pantalla de bienvenida
        }, 500);
    }
    setupPlayerEventListeners();
    updateGameUI();
});

/**
 * Sets up all event listeners for the player application.
 */
function setupPlayerEventListeners() {
    // Welcome Screen
    document.getElementById('active-games-list').addEventListener('click', handleGameSelection);

    // Game Description Screen
    document.getElementById('game-desc-back-btn').addEventListener('click', async () => {
        if (confirm('¿Estás seguro de que quieres volver? Si ya iniciaste un juego, tu progreso se guardará, pero no se registrará como completado.')) {
            if (gameState.isGameActive) {
                await abandonGame(true); // Abandon silently if game was active
            } else {
                await clearGameState(); // Clear state if not started
            }
            await loadActiveGames(); // Reload games as fresh start
            showScreen('welcome-screen');
        }
    });
    document.getElementById('start-game-btn').addEventListener('click', startGame);

    // Game Play Screen
    document.getElementById('submit-answer-btn').addEventListener('click', handleSubmitAnswer);
    document.getElementById('request-hint-btn').addEventListener('click', handleRequestHint);
    document.getElementById('scan-qr-btn').addEventListener('click', () => {
        document.getElementById('qr-reader').classList.remove('hidden');
        startQrScanner(handleQrScanSuccess);
    });
    document.getElementById('check-gps-btn').addEventListener('click', handleGPSCheck);
    document.getElementById('end-game-early-btn').addEventListener('click', () => abandonGame(false));

    // Interlude Screen
    document.getElementById('continue-interlude-btn').addEventListener('click', handleContinueAdventure);

    // Game End Screen
    document.getElementById('return-to-welcome-btn').addEventListener('click', async () => {
        await clearGameState();
        await loadActiveGames();
        showScreen('welcome-screen');
    });
}

/**
 * Loads and displays active games on the welcome screen.
 */
async function loadActiveGames() {
    const gamesListContainer = document.getElementById('active-games-list');
    gamesListContainer.innerHTML = '<p>Cargando juegos...</p>';
    const games = await getActiveGames(); // From player-supabase-api.js

    if (games.length === 0) {
        gamesListContainer.innerHTML = '<p>No hay juegos activos disponibles en este momento.</p>';
        return;
    }

    gamesListContainer.innerHTML = ''; // Clear loading message
    games.forEach(game => {
        const gameCard = document.createElement('div');
        gameCard.className = 'game-card';
        gameCard.dataset.gameId = game.id;
        gameCard.innerHTML = `
            <h3>${game.title}</h3>
            <p>${game.description}</p>
        `;
        gameCardsContainer.appendChild(gameCard);
    });
}

/**
 * Handles the selection of a game from the welcome screen.
 * @param {Event} event - The click event.
 */
async function handleGameSelection(event) {
    const gameCard = event.target.closest('.game-card');
    if (!gameCard) return;

    const gameId = gameCard.dataset.gameId;
    showScreen('loading-screen'); // Show loading while fetching details

    const gameDetails = await getGameDetails(gameId); // From player-supabase-api.js
    if (gameDetails) {
        gameState.currentGame = gameDetails;
        document.getElementById('selected-game-title').textContent = gameDetails.title;
        document.getElementById('selected-game-description').textContent = gameDetails.description;
        document.getElementById('selected-game-mechanics').textContent = gameDetails.mechanics;
        document.getElementById('selected-game-narrative').textContent = gameDetails.initial_narrative;
        document.getElementById('team-name-input').value = ''; // Clear previous team name
        showScreen('game-description-screen');
    } else {
        showAlert('No se pudieron cargar los detalles del juego.', 'error');
        showScreen('welcome-screen'); // Go back if error
    }
}

/**
 * Starts the game, creating a team and initializing game state.
 */
async function startGame() {
    const teamNameInput = document.getElementById('team-name-input');
    const teamName = teamNameInput.value.trim();

    if (!teamName) {
        showAlert('Por favor, ingresa un nombre para tu equipo.', 'warning');
        return;
    }

    if (!gameState.currentGame) {
        showAlert('Error: No hay juego seleccionado.', 'error');
        return;
    }

    showScreen('loading-screen');

    const newTeam = await createTeam(teamName, gameState.currentGame.id); // From player-supabase-api.js

    if (newTeam) {
        gameState.currentTeam = newTeam;
        gameState.teamId = newTeam.id;
        gameState.gameId = newTeam.game_id;
        gameState.isGameActive = true;
        gameState.playerScore = newTeam.total_score;
        gameState.gameStartTime = Date.parse(newTeam.start_time);
        gameState.totalHintsUsed = newTeam.hints_used_global;

        await saveGameState(); // Save initial state

        // Determine the starting location and trial
        if (gameState.currentGame.locations && gameState.currentGame.locations.length > 0) {
            gameState.currentLocation = gameState.currentGame.locations[0];
            if (gameState.currentLocation.trials && gameState.currentLocation.trials.length > 0) {
                gameState.currentTrial = gameState.currentLocation.trials[0];
            } else {
                showAlert('La primera localización no tiene pruebas configuradas.', 'error');
                showScreen('welcome-screen');
                return;
            }
        } else {
            showAlert('El juego no tiene localizaciones configuradas.', 'error');
            showScreen('welcome-screen');
            return;
        }

        gameState.trialStartTime = Date.now(); // Start trial timer
        startGlobalGameTimer(); // Start global timer

        // Update team with initial location/trial IDs
        await updateTeamState(gameState.teamId, {
            current_location_id: gameState.currentLocation.id,
            current_trial_id: gameState.currentTrial.id
        });

        loadCurrentTrial();
        showScreen('game-screen');
        showAlert('¡Aventura iniciada!', 'success');
    } else {
        // Error creating team handled by createTeam function
        showScreen('game-description-screen'); // Go back to team creation
    }
}

/**
 * Resumes a previously active game from local state.
 */
async function resumeGame() {
    showScreen('loading-screen');
    showAlert('Reanudando juego...', 'info');

    // Reload team state from DB to ensure it's up-to-date
    const team = await loadTeamState(gameState.teamId);
    if (!team) {
        showAlert('Error al reanudar: no se encontró el estado del equipo en la base de datos. Iniciando un juego nuevo.', 'error');
        await clearGameState();
        await loadActiveGames();
        showScreen('welcome-screen');
        return;
    }
    gameState.currentTeam = team;
    gameState.playerScore = team.total_score;
    gameState.gameStartTime = Date.parse(team.start_time);
    gameState.totalHintsUsed = team.hints_used_global;

    // Load full game details again
    const gameDetails = await getGameDetails(gameState.gameId);
    if (!gameDetails) {
        showAlert('Error al reanudar: no se encontraron los detalles del juego. Iniciando un juego nuevo.', 'error');
        await clearGameState();
        await loadActiveGames();
        showScreen('welcome-screen');
        return;
    }
    gameState.currentGame = gameDetails;

    // Find current location and trial based on loaded team state
    gameState.currentLocation = gameState.currentGame.locations.find(loc => loc.id === team.current_location_id);
    if (gameState.currentLocation) {
        gameState.currentTrial = gameState.currentLocation.trials.find(trial => trial.id === team.current_trial_id);
    }

    if (!gameState.currentLocation || !gameState.currentTrial) {
        showAlert('Error al reanudar: No se pudo encontrar la ubicación o prueba actual. Volviendo al inicio.', 'error');
        await clearGameState();
        await loadActiveGames();
        showScreen('welcome-screen');
        return;
    }

    gameState.trialStartTime = Date.now(); // Reset trial timer start
    startGlobalGameTimer(); // Restart global timer

    loadCurrentTrial();
    showScreen('game-screen');
    showAlert('¡Juego reanudado con éxito!', 'success');
}


/**
 * Loads and displays the current trial's content and controls.
 */
function loadCurrentTrial() {
    const trial = gameState.currentTrial;
    if (!trial) {
        showAlert('Error: No hay prueba actual para cargar.', 'error');
        endGame(); // Attempt to end game if no trials left
        return;
    }

    document.getElementById('team-name-display').textContent = gameState.currentTeam.team_name;
    document.getElementById('trial-title').textContent = trial.title;
    document.getElementById('trial-narrative').textContent = trial.narrative;
    renderMedia(trial.image_url, trial.audio_url, document.getElementById('trial-media-container'));

    // Reset controls visibility
    document.getElementById('qr-input-group').classList.add('hidden');
    document.getElementById('gps-input-group').classList.add('hidden');
    document.getElementById('text-input-group').classList.add('hidden');
    document.getElementById('options-container').innerHTML = '';
    document.getElementById('options-container').classList.add('hidden');
    document.getElementById('text-answer-input').value = '';
    document.getElementById('qr-code-input').value = '';
    document.getElementById('feedback-message').classList.add('hidden');
    document.getElementById('hint-message').classList.add('hidden');

    // Stop any active QR scanner if switching trials/screens
    stopQrScanner();
    // Destroy map if it's not a GPS trial
    if (trial.type !== 'gps' && gameState.playerMap) {
        destroyPlayerMap();
    }

    // Configure specific trial type controls
    switch (trial.type) {
        case 'qr':
            document.getElementById('qr-input-group').classList.remove('hidden');
            break;
        case 'gps':
            document.getElementById('gps-input-group').classList.remove('hidden');
            initPlayerMap('map-container', trial.gps_latitude, trial.gps_longitude);
            updatePlayerMapTargetMarker(trial.gps_latitude, trial.gps_longitude);
            break;
        case 'text':
            document.getElementById('text-input-group').classList.remove('hidden');
            document.getElementById('text-question-label').textContent = trial.question;

            if (trial.response_type === 'multiple_choice' && trial.options) {
                document.getElementById('options-container').classList.remove('hidden');
                trial.options.forEach((option, index) => {
                    const optionDiv = document.createElement('div');
                    optionDiv.className = 'option-item';
                    optionDiv.textContent = option;
                    optionDiv.dataset.index = index;
                    optionDiv.addEventListener('click', () => selectOption(optionDiv, index));
                    document.getElementById('options-container').appendChild(optionDiv);
                });
            } else if (trial.response_type === 'ordering' && trial.options) {
                document.getElementById('options-container').classList.remove('hidden');
                const shuffledOptions = shuffleArray([...trial.options]); // Shuffle for ordering
                gameState.currentOrderingAttempt = [...shuffledOptions]; // Store initial shuffled order
                renderOrderingList(shuffledOptions, document.getElementById('options-container'));
            } else if (trial.response_type === 'numerical' || trial.response_type === 'text_answer') {
                // Input field is already visible
                document.getElementById('text-answer-input').type = (trial.response_type === 'numerical') ? 'number' : 'text';
                document.getElementById('text-answer-input').placeholder = (trial.response_type === 'numerical') ? 'Introduce un número' : 'Escribe tu respuesta';
            }
            break;
    }

    // Update hints UI for the current trial
    updateGameUI();
    gameState.trialStartTime = Date.now(); // Reset trial timer for this new trial
    startTrialTimer(); // Start the timer for the current trial
}

/**
 * Handles the submission of an answer for the current trial.
 */
async function handleSubmitAnswer() {
    const trial = gameState.currentTrial;
    if (!trial) return;

    let userAnswer;
    let isCorrect = false;

    switch (trial.type) {
        case 'qr':
            userAnswer = document.getElementById('qr-code-input').value.trim();
            isCorrect = (userAnswer.toLowerCase() === trial.qr_code_content.toLowerCase());
            break;
        case 'gps':
            if (!gameState.gpsCheckResult || !gameState.gpsCheckResult.success) {
                showAlert('Por favor, verifica tu ubicación GPS primero.', 'warning');
                return;
            }
            isCorrect = gameState.gpsCheckResult.success;
            break;
        case 'text':
            if (trial.response_type === 'multiple_choice') {
                if (gameState.currentSelectedOption === null) {
                    showAlert('Por favor, selecciona una opción.', 'warning');
                    return;
                }
                userAnswer = trial.options[gameState.currentSelectedOption];
                isCorrect = (gameState.currentSelectedOption === trial.correct_answer_index);
            } else if (trial.response_type === 'ordering') {
                userAnswer = gameState.currentOrderingAttempt; // This holds the current order in the UI
                const correctOrder = trial.options; // Assuming trial.options is the correct order
                isCorrect = JSON.stringify(userAnswer) === JSON.stringify(correctOrder);
            } else { // text_answer or numerical
                userAnswer = document.getElementById('text-answer-input').value.trim();
                const correctAnswer = String(trial.correct_answer).trim();
                isCorrect = (userAnswer.toLowerCase() === correctAnswer.toLowerCase());
            }
            break;
    }

    if (isCorrect) {
        await handleCorrectAnswer();
    } else {
        showAlert('Respuesta incorrecta. Inténtalo de nuevo.', 'error');
        displayFeedback('Incorrecto. Inténtalo de nuevo.', 'error');
    }
    await saveGameState(); // Save state after answer attempt
}

/**
 * Handles a correct answer submission.
 */
async function handleCorrectAnswer() {
    stopTrialTimer(); // Stop the current trial's timer
    const timeTaken = Math.floor((Date.now() - gameState.trialStartTime) / 1000);
    const trial = gameState.currentTrial;

    // Calculate score for this trial
    let scoreGained = trial.points_value || 100; // Default 100 points
    scoreGained -= timeTaken; // Penalty for time
    scoreGained -= (gameState.hintsUsedInTrial * (trial.hint_cost || 10)); // Penalty for hints

    if (scoreGained < 0) scoreGained = 0; // Score cannot be negative for a single trial

    showAlert(`¡Correcto! Has ganado ${scoreGained} puntos.`, 'success');
    displayFeedback(`¡Correcto! Has ganado ${scoreGained} puntos.`, 'success');

    // Update global score and log progress
    gameState.playerScore += scoreGained;
    gameState.totalHintsUsed += gameState.hintsUsedInTrial; // Add hints used in this trial to global count

    // Record completion in Supabase and update local state
    const updatedTeam = await recordTrialCompletion(
        gameState.teamId,
        trial.id,
        scoreGained,
        timeTaken,
        gameState.hintsUsedInTrial
    );

    if (updatedTeam) {
        gameState.currentTeam = updatedTeam; // Update local team state from DB
        updateGameUI(); // Update UI with new score
        // Reset hints for next trial
        gameState.hintsUsedInTrial = 0;
        await saveGameState();

        setTimeout(async () => {
            await advanceToNextTrial();
        }, 2000); // Small delay to show feedback
    } else {
        showAlert('Error al registrar la finalización de la prueba. Intenta de nuevo.', 'error');
        // If Supabase update fails, don't advance, let user retry or check connection.
    }
}

/**
 * Advances the player to the next trial or location, or ends the game.
 */
async function advanceToNextTrial() {
    const game = gameState.currentGame;
    const currentLocIndex = game.locations.findIndex(loc => loc.id === gameState.currentLocation.id);
    const currentTrialIndex = gameState.currentLocation.trials.findIndex(t => t.id === gameState.currentTrial.id);

    // Determine if there's a next trial in the current location
    if (currentTrialIndex < gameState.currentLocation.trials.length - 1) {
        gameState.currentTrial = gameState.currentLocation.trials[currentTrialIndex + 1];
        await updateTeamState(gameState.teamId, { current_trial_id: gameState.currentTrial.id });
        loadCurrentTrial();
    } else {
        // No more trials in current location, check for next location
        if (currentLocIndex < game.locations.length - 1) {
            gameState.currentLocation = game.locations[currentLocIndex + 1];
            gameState.currentTrial = gameState.currentLocation.trials[0]; // First trial of new location
            await updateTeamState(gameState.teamId, {
                current_location_id: gameState.currentLocation.id,
                current_trial_id: gameState.currentTrial.id
            });
            // Show interlude screen before loading new location's first trial
            showInterludeScreen(
                gameState.currentLocation.title,
                gameState.currentLocation.narrative,
                gameState.currentLocation.image_url,
                gameState.currentLocation.audio_url
            );
        } else {
            // No more locations, game completed
            endGame();
        }
    }
    await saveGameState(); // Save state after advancing
}

/**
 * Handles a request for a hint.
 */
async function handleRequestHint() {
    const trial = gameState.currentTrial;
    if (!trial || !trial.hints || trial.hints.length === 0) {
        showAlert('No hay pistas disponibles para esta prueba.', 'info');
        return;
    }

    const hintsUsed = (gameState.currentTeam.hints_used_per_trial || []).find(h => h.trialId === trial.id);
    const hintsCount = hintsUsed ? hintsUsed.count : 0;

    if (hintsCount >= (trial.max_hints || 1)) { // Default max_hints to 1 if not set
        showAlert('Ya has usado todas las pistas disponibles para esta prueba.', 'warning');
        return;
    }

    const hintIndex = hintsCount; // Use hintsCount as index for the next hint
    const hint = trial.hints[hintIndex];

    if (hint) {
        showAlert(`Pista: ${hint.text} (Costo: ${hint.cost} puntos)`, 'info');
        document.getElementById('hint-message').textContent = `Pista: ${hint.text}`;
        document.getElementById('hint-message').classList.remove('hidden');

        // Deduct hint cost and update hints used
        const updatedTeam = await logHintUsed(gameState.teamId, trial.id, hint.cost); // From player-supabase-api.js
        if (updatedTeam) {
            gameState.currentTeam = updatedTeam; // Update local team state
            gameState.hintsUsedInTrial++; // Increment local counter for current trial
            updateGameUI(); // Update score and hints display
        } else {
            showAlert('Error al registrar la pista. Intenta de nuevo.', 'error');
        }
    } else {
        showAlert('No hay más pistas disponibles para esta prueba.', 'warning');
    }
    await saveGameState();
}


/**
 * Handles GPS check for GPS type trials.
 */
async function handleGPSCheck() {
    const trial = gameState.currentTrial;
    if (!trial || trial.type !== 'gps') {
        showAlert('Esta no es una prueba GPS.', 'warning');
        return;
    }

    if (!trial.gps_latitude || !trial.gps_longitude) {
        showAlert('Ubicación GPS no configurada para esta prueba.', 'error');
        return;
    }

    showScreen('loading-screen'); // Show loading while checking GPS

    try {
        const tolerance = trial.gps_tolerance || 10; // Default tolerance 10 meters
        const checkResult = checkGeofence(trial.gps_latitude, trial.gps_longitude, tolerance); // From player-gps-handler.js
        gameState.gpsCheckResult = checkResult;

        if (checkResult.success) {
            await handleCorrectAnswer();
        } else {
            showAlert(`No estás lo suficientemente cerca. Distancia: ${checkResult.distance.toFixed(1)}m, Precisión: ${checkResult.accuracy ? checkResult.accuracy.toFixed(1) + 'm' : 'N/A'}.`, 'warning');
            showScreen('game-screen'); // Return to game screen
        }
    } catch (error) {
        console.error('Error during GPS check:', error);
        showAlert('Error al verificar GPS. Asegúrate de tener el GPS activado.', 'error');
        showScreen('game-screen'); // Return to game screen
    }
}

/**
 * Handles QR code scan success.
 * @param {string} decodedText - The text decoded from the QR code.
 */
async function handleQrScanSuccess(decodedText) {
    const trial = gameState.currentTrial;
    document.getElementById('qr-code-input').value = decodedText;
    gameState.qrScanResult = decodedText; // Store result

    if (trial.type === 'qr' && decodedText.toLowerCase() === trial.qr_code_content.toLowerCase()) {
        await handleCorrectAnswer();
    } else {
        showAlert('Código QR incorrecto o no válido para esta prueba.', 'error');
        displayFeedback('Código QR incorrecto.', 'error');
        // Optionally, re-enable scanner or show button to rescan
        document.getElementById('qr-reader').classList.add('hidden'); // Hide reader after scan
    }
}

/**
 * Manages the global game timer.
 */
function startGlobalGameTimer() {
    if (gameState.gameTimerInterval) {
        clearInterval(gameState.gameTimerInterval);
    }
    gameState.gameTimerInterval = setInterval(() => {
        const elapsedSeconds = Math.floor((Date.now() - gameState.gameStartTime) / 1000);
        document.getElementById('game-timer-display').textContent = formatTime(elapsedSeconds);
    }, 1000);
}

/**
 * Manages the current trial timer.
 */
function startTrialTimer() {
    if (gameState.trialTimerInterval) {
        clearInterval(gameState.trialTimerInterval);
    }
    gameState.trialTimerInterval = setInterval(() => {
        const elapsedSeconds = Math.floor((Date.now() - gameState.trialStartTime) / 1000);
        document.getElementById('trial-timer-display').textContent = formatTime(elapsedSeconds);
    }, 1000);
}

/**
 * Stops all active timers.
 */
function stopTimers() {
    if (gameState.gameTimerInterval) {
        clearInterval(gameState.gameTimerInterval);
        gameState.gameTimerInterval = null;
    }
    if (gameState.trialTimerInterval) {
        clearInterval(gameState.trialTimerInterval);
        gameState.trialTimerInterval = null;
    }
}

/**
 * Formats seconds into HH:MM:SS or MM:SS format.
 * @param {number} totalSeconds - Total seconds to format.
 * @returns {string} Formatted time string.
 */
function formatTime(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (num) => num.toString().padStart(2, '0');

    if (hours > 0) {
        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    } else {
        return `${pad(minutes)}:${pad(seconds)}`;
    }
}

/**
 * Ends the current game session, updates rankings, and displays final screen.
 */
async function endGame() {
    if (!gameState.isGameActive) return; // Prevent multiple calls

    stopTimers();
    gameState.isGameActive = false;

    const finalTime = Math.floor((Date.now() - gameState.gameStartTime) / 1000);

    // Ensure final score and time are pushed to DB and rankings
    await markGameCompleted(gameState.teamId, gameState.playerScore, finalTime); // From player-supabase-api.js

    // Show end screen
    showGameEndScreen(gameState.currentTeam.team_name, gameState.currentGame.title, gameState.playerScore, finalTime, gameState.totalHintsUsed);
    await clearGameState(); // Clear local storage after game completion
}

/**
 * Allows a player to abandon the game without marking it as completed.
 * Progress is saved.
 * @param {boolean} silent - If true, no confirmation or alert messages are shown.
 */
async function abandonGame(silent = false) {
    if (!silent && !confirm('¿Estás seguro de que quieres abandonar el juego? Tu progreso se guardará, pero no se registrará como completado.')) {
        return;
    }
    stopTimers();
    gameState.isGameActive = false;

    // Update team state in DB (set current_trial_id and current_location_id to null)
    await updateTeamState(gameState.teamId, {
        current_location_id: gameState.currentLocation ? gameState.currentLocation.id : null,
        current_trial_id: gameState.currentTrial ? gameState.currentTrial.id : null,
        last_trial_start_time: new Date(gameState.trialStartTime).toISOString(),
        total_score: gameState.playerScore, // Save current score
        total_time: Math.floor((Date.now() - gameState.gameStartTime) / 1000) // Save current time
    });

    if (!silent) {
        showAlert('Juego abandonado. Progreso guardado. Puedes reanudarlo más tarde.', 'info');
        await clearGameState(); // Clear state to allow fresh start, but game is still in DB
        await loadActiveGames();
        showScreen('welcome-screen');
    }
}

/**
 * Shows the interlude screen with narrative content.
 * @param {string} title - Title for the interlude.
 * @param {string} narrative - Narrative text.
 * @param {string} imageUrl - URL for an image.
 * @param {string} audioUrl - URL for an audio.
 */
function showInterludeScreen(title, narrative, imageUrl, audioUrl) {
    document.getElementById('interlude-title').textContent = title;
    document.getElementById('interlude-narrative').textContent = narrative;
    renderMedia(imageUrl, audioUrl, document.getElementById('interlude-media-container'));
    showScreen('interlude-screen');
}

/**
 * Continues adventure after an interlude.
 */
function handleContinueAdventure() {
    loadCurrentTrial();
    showScreen('game-screen');
}

/**
 * Displays feedback message to the user.
 * @param {string} message - Message to display.
 * @param {'success'|'error'} type - Type of feedback.
 */
function displayFeedback(message, type) {
    const feedbackMessageElement = document.getElementById('feedback-message');
    feedbackMessageElement.textContent = message;
    feedbackMessageElement.className = `feedback-text ${type}`;
    feedbackMessageElement.classList.remove('hidden');
    setTimeout(() => {
        feedbackMessageElement.classList.add('hidden');
    }, 3000);
}

/**
 * Shows the final game end screen.
 * @param {string} teamName - The name of the team.
 * @param {string} gameTitle - The title of the completed game.
 * @param {number} finalScore - The final score.
 * @param {number} finalTimeInSeconds - The total time taken in seconds.
 * @param {number} totalHintsUsed - Total hints used by the team.
 */
function showGameEndScreen(teamName, gameTitle, finalScore, finalTimeInSeconds, totalHintsUsed) {
    document.getElementById('final-team-name').textContent = teamName;
    document.getElementById('final-game-title').textContent = gameTitle;
    document.getElementById('final-score-display').textContent = finalScore;
    document.getElementById('final-time-display').textContent = formatTime(finalTimeInSeconds);
    document.getElementById('final-hints-display').textContent = totalHintsUsed;
    showScreen('game-end-screen');
}

// Expose relevant functions globally if needed by UI manager or other modules
window.loadCurrentTrial = loadCurrentTrial;
window.startGlobalGameTimer = startGlobalGameTimer;
window.startTrialTimer = startTrialTimer;
window.stopTimers = stopTimers;
window.formatTime = formatTime;
window.handleCorrectAnswer = handleCorrectAnswer; // For external calls
window.abandonGame = abandonGame; // For external calls