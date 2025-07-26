// player/supabase-api.js

// Funciones para interactuar con Supabase
async function getActiveGames() {
    const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('is_active', true)
        .order('title', { ascending: true });

    if (error) {
        console.error('Error fetching active games:', error);
        showAlert('Error cargando juegos activos.', 'error');
        return [];
    }
    return data;
}

async function getGameDetails(gameId) {
    const { data: game, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

    if (gameError) {
        console.error('Error fetching game details:', gameError);
        showAlert('Error cargando detalles del juego.', 'error');
        return null;
    }

    const { data: locations, error: locError } = await supabase
        .from('locations')
        .select(`
            *,
            trials (*)
        `)
        .eq('game_id', gameId)
        .order('order_in_game', { ascending: true })
        .order('order_in_location', { foreignTable: 'trials', ascending: true }); // Order trials within locations

    if (locError) {
        console.error('Error fetching game locations and trials:', locError);
        showAlert('Error cargando localizaciones y pruebas del juego.', 'error');
        return null;
    }

    // Sort trials within each location if they are not already
    locations.forEach(location => {
        if (location.trials) {
            location.trials.sort((a, b) => a.order_in_location - b.order_in_location);
        }
    });

    game.locations = locations;
    return game;
}

async function createTeam(teamName, gameId) {
    const { data, error } = await supabase
        .from('teams')
        .insert({
            team_name: teamName,
            game_id: gameId,
            current_location_id: null, // Set after game starts
            current_trial_id: null,    // Set after game starts
            start_time: null,          // Set after game starts
            last_trial_start_time: null,
            hints_used_global: 0,
            hints_used_per_trial: [],
            total_time: 0,
            total_score: 0,
            progress_log: [],
            last_activity: new Date().toISOString(),
            is_completed: false
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating team:', error);
        showAlert('Error creando equipo: ' + error.message, 'error');
        return null;
    }
    return data;
}

async function getTeamState(teamId) {
    const { data, error } = await supabase
        .from('teams')
        .select(`
            *,
            games (title, description, mechanics, narrative_intro, game_type),
            current_location:locations (id, name, narrative, image_url, audio_url, order_in_game),
            current_trial:trials (id, name, narrative, image_url, audio_url, hint_count, hint_cost, type, config, order_in_location)
        `)
        .eq('id', teamId)
        .single();

    if (error) {
        console.error('Error fetching team state:', error);
        showAlert('Error cargando estado del equipo.', 'error');
        return null;
    }

    if (data) {
        // Also fetch all locations and trials for the game
        const gameDetails = await getGameDetails(data.game_id);
        if (gameDetails) {
            data.locations = gameDetails.locations;
        }
    }
    return data;
}

async function updateTeamState(teamId, updates) {
    // Add optimistic locking mechanism: Update only if last_activity matches
    // This requires the client to send the last_activity timestamp they read.
    // For simplicity, we'll just update directly for now, assuming minimal conflicts
    // in a single-device-per-team scenario. For robust multi-device,
    // Supabase Row Level Security and custom functions might be needed.

    updates.last_activity = new Date().toISOString(); // Always update last activity

    const { data, error } = await supabase
        .from('teams')
        .update(updates)
        .eq('id', teamId)
        .select()
        .single();

    if (error) {
        console.error('Error updating team state:', error);
        showAlert('Error actualizando progreso del equipo: ' + error.message, 'error');
        return null;
    }
    return data;
}

async function markGameCompleted(teamId, finalScore, completionTime) {
    const updates = {
        is_completed: true,
        total_score: finalScore,
        total_time: completionTime, // Ensure final time is accurate
        last_activity: new Date().toISOString()
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

    return teamUpdate;
}