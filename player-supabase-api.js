// player/supabase-api.js

/**
 * Fetches all active games from Supabase.
 * @returns {Promise<Array>} Array of active game objects.
 */
async function getActiveGames() {
    console.log('Intentando obtener juegos activos de Supabase...'); // Añade esto para ver si se llama
    const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('is_active', true) // Verifica que la columna 'is_active' existe en tu tabla 'games'
        .order('title', { ascending: true });

    if (error) {
        console.error('Error fetching active games:', error); // Esto ya lo tienes
        showAlert('Error cargando juegos activos: ' + error.message, 'error'); // Muestra el mensaje de error de Supabase
        return [];
    }
    console.log('Juegos activos obtenidos:', data); // Añade esto para ver los datos
    return data;
}
/**
 * Fetches full details for a specific game, including its locations and trials.
 * @param {string} gameId - The ID of the game to fetch.
 * @returns {Promise<Object|null>} The game object with nested locations and trials, or null if an error occurs.
 */
async function getGameDetails(gameId) {
    const { data: game, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

    if (gameError) {
        console.error('Error fetching game details:', gameError);
        showAlert('Error cargando detalles del juego. Por favor, intenta de nuevo.', 'error');
        return null;
    }

    const { data: locations, error: locError } = await supabase
        .from('locations')
        .select(`
            *,
            trials (*)
        `)
        .eq('game_id', gameId)
        .order('order_in_game', { ascending: true });

    if (locError) {
        console.error('Error fetching game locations and trials:', locError);
        showAlert('Error cargando localizaciones y pruebas del juego. Intenta de nuevo.', 'error');
        return null;
    }

    // Sort trials within each location by their 'order_in_location'
    locations.forEach(location => {
        if (location.trials) {
            location.trials.sort((a, b) => (a.order_in_location || 0) - (b.order_in_location || 0));
        }
    });

    game.locations = locations;
    return game;
}

/**
 * Creates a new team in Supabase and initializes its state for a game.
 * @param {string} teamName - The name of the new team.
 * @param {string} gameId - The ID of the game the team is joining.
 * @returns {Promise<Object|null>} The created team object, or null if an error occurs.
 */
async function createTeam(teamName, gameId) {
    const { data, error } = await supabase
        .from('teams')
        .insert({
            team_name: teamName,
            game_id: gameId,
            current_location_id: null, // Will be set after first location is loaded
            current_trial_id: null, // Will be set after first trial is loaded
            start_time: new Date().toISOString(),
            last_trial_start_time: new Date().toISOString(),
            hints_used_global: 0,
            hints_used_per_trial: [],
            total_score: 0,
            total_time: 0,
            progress_log: [],
            last_activity: new Date().toISOString()
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating team:', error);
        if (error.code === '23505') { // Unique violation
            showAlert('Ya existe un equipo con ese nombre para este juego. Por favor, elige otro.', 'error');
        } else {
            showAlert('Error al crear equipo. Intenta de nuevo.', 'error');
        }
        return null;
    }
    showAlert(`¡Equipo "${teamName}" creado!`, 'success');
    return data;
}

/**
 * Updates the state of a team in Supabase.
 * @param {string} teamId - The ID of the team to update.
 * @param {Object} updates - An object containing the fields to update (e.g., { current_location_id: 'abc', total_score: 100 }).
 * @param {boolean} optimisticLocking - Whether to use last_activity for optimistic locking.
 * @returns {Promise<Object|null>} The updated team object, or null if an error occurs (especially with locking).
 */
async function updateTeamState(teamId, updates, optimisticLocking = true) {
    let query = supabase.from('teams').update({
        ...updates,
        last_activity: new Date().toISOString() // Always update last activity
    }).eq('id', teamId);

    if (optimisticLocking && gameState.currentTeam && gameState.currentTeam.last_activity) {
        // Only update if the server's last_activity is older than or equal to our last known activity
        // This helps prevent overwriting newer updates from other devices/tabs
        query = query.eq('last_activity', gameState.currentTeam.last_activity);
    }

    query = query.select().single();

    const { data, error } = await query;

    if (error) {
        console.error('Error updating team state:', error);
        if (error.code === '406' || (error.details && error.details.includes('0 rows'))) { // No rows updated, likely optimistic locking failure
            showAlert('Parece que tu progreso fue actualizado en otro lugar. Sincronizando...', 'warning');
            await loadTeamState(teamId); // Reload state to sync
            return null; // Indicate failure to apply current update
        }
        showAlert('Error al guardar progreso del equipo. Revisa tu conexión.', 'error');
        return null;
    }
    // Update local gameState.currentTeam immediately after successful DB update
    gameState.currentTeam = data;
    return data;
}

/**
 * Loads the latest state for a given team from Supabase.
 * @param {string} teamId - The ID of the team to load.
 * @returns {Promise<Object|null>} The team object, or null if not found/error.
 */
async function loadTeamState(teamId) {
    const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single();

    if (error) {
        console.error('Error loading team state:', error);
        showAlert('Error al cargar el estado del equipo.', 'error');
        return null;
    }
    gameState.currentTeam = data; // Update global state
    return data;
}


/**
 * Records a completed trial in the team's progress log and updates score/time.
 * @param {string} teamId - ID of the team.
 * @param {string} trialId - ID of the completed trial.
 * @param {number} scoreGained - Points gained from this trial.
 * @param {number} timeTaken - Time taken for this trial in seconds.
 * @param {number} hintsUsed - Number of hints used for this trial.
 * @returns {Promise<Object|null>} Updated team state.
 */
async function recordTrialCompletion(teamId, trialId, scoreGained, timeTaken, hintsUsed) {
    const currentTeam = gameState.currentTeam;
    if (!currentTeam) {
        console.error("No current team state to record trial completion.");
        return null;
    }

    const newTotalScore = currentTeam.total_score + scoreGained;
    const newTotalTime = currentTeam.total_time + timeTaken;

    const progressEntry = {
        trialId: trialId,
        score: scoreGained,
        timeTaken: timeTaken,
        hintsUsed: hintsUsed,
        completedAt: new Date().toISOString()
    };

    // Ensure progress_log is an array. Supabase stores JSONB as objects by default if not an array.
    const newProgressLog = Array.isArray(currentTeam.progress_log)
        ? [...currentTeam.progress_log, progressEntry]
        : [progressEntry]; // If it's not an array (e.g., null), start a new one

    const updates = {
        total_score: newTotalScore,
        total_time: newTotalTime,
        progress_log: newProgressLog,
        // current_trial_id and current_location_id will be updated by the game logic to the next one
    };

    return await updateTeamState(teamId, updates);
}

/**
 * Logs that a hint was used for a specific trial.
 * @param {string} teamId - ID of the team.
 * @param {string} trialId - ID of the trial for which the hint was used.
 * @param {number} hintCost - Points cost of the hint.
 * @returns {Promise<Object|null>} Updated team state.
 */
async function logHintUsed(teamId, trialId, hintCost) {
    const currentTeam = gameState.currentTeam;
    if (!currentTeam) {
        console.error("No current team state to log hint.");
        return null;
    }

    const newTotalHintsUsed = currentTeam.hints_used_global + 1;
    const newTotalScore = currentTeam.total_score - hintCost; // Deduct hint cost from total score

    // Update hints_used_per_trial (JSON/Array of objects)
    let hintsPerTrial = Array.isArray(currentTeam.hints_used_per_trial)
        ? [...currentTeam.hints_used_per_trial]
        : [];

    let trialHintEntry = hintsPerTrial.find(h => h.trialId === trialId);
    if (trialHintEntry) {
        trialHintEntry.count = (trialHintEntry.count || 0) + 1;
    } else {
        hintsPerTrial.push({ trialId: trialId, count: 1 });
    }

    const updates = {
        hints_used_global: newTotalHintsUsed,
        hints_used_per_trial: hintsPerTrial,
        total_score: newTotalScore // Update score with penalty
    };

    return await updateTeamState(teamId, updates);
}

/**
 * Marks a game as completed for a team and registers the final score/time in rankings.
 * @param {string} teamId - ID of the team.
 * @param {number} finalScore - Final score of the team.
 * @param {number} completionTime - Total time in seconds to complete the game.
 * @returns {Promise<void>}
 */
async function markGameCompleted(teamId, finalScore, completionTime) {
    // Update team status in 'teams' table
    const updates = {
        is_completed: true,
        completion_date: new Date().toISOString(),
        total_score: finalScore, // Ensure final score is accurate
        total_time: completionTime // Ensure final time is accurate
    };

    const { data: teamUpdate, error: updateError } = await supabase
        .from('teams')
        .update(updates)
        .eq('id', teamId)
        .select()
        .single();

    if (updateError) {
        console.error('Error marking game as completed for team:', updateError);
        showAlert('Error finalizando el juego para el equipo.', 'error');
        return null;
    }

    // Insert into rankings
    const { data: rankingEntry, error: rankingError } = await supabase
        .from('rankings')
        .insert({
            game_id: teamUpdate.game_id,
            team_id: teamUpdate.id,
            final_score: finalScore,
            completion_time: completionTime,
            completion_date: new Date().toISOString()
        })
        .select()
        .single();

    if (rankingError && rankingError.code !== '23505') { // 23505 is unique violation, meaning team already ranked
        console.error('Error inserting into rankings:', rankingError);
        showAlert('Error registrando ranking.', 'error');
    } else if (rankingError && rankingError.code === '23505') {
        showAlert('Este equipo ya tiene un ranking registrado para este juego.', 'info');
    } else {
        showAlert('Juego completado y ranking registrado.', 'success');
    }
}

// Expose functions globally
window.getActiveGames = getActiveGames;
window.getGameDetails = getGameDetails;
window.createTeam = createTeam;
window.updateTeamState = updateTeamState;
window.loadTeamState = loadTeamState;
window.recordTrialCompletion = recordTrialCompletion;
window.logHintUsed = logHintUsed;
window.markGameCompleted = markGameCompleted;