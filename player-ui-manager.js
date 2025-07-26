// player/ui-manager.js

// Funciones para mostrar/ocultar pantallas
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden');
    });
    document.getElementById(screenId).classList.remove('hidden');
    // Ensure body doesn't scroll if screen content is smaller than viewport,
    // but allow scrolling for specific content areas.
    document.body.style.overflow = 'hidden'; // Hide global scrollbar
    document.getElementById(screenId).style.overflowY = 'auto'; // Allow screen content to scroll
}

function hideScreen(screenId) {
    document.getElementById(screenId).classList.add('hidden');
}

// Funciones para actualizar la UI del juego
function updateGameUI() {
    if (gameState.currentTeam) {
        document.getElementById('current-score').textContent = gameState.currentTeam.total_score || 0;
        document.getElementById('total-hints-used').textContent = gameState.currentTeam.hints_used_global || 0;
        updateRemainingHintsDisplay(); // Update hints for current trial
    }
}

function updateRemainingHintsDisplay() {
    const requestHintBtn = document.getElementById('request-hint-btn');
    if (!gameState.currentTrial) {
        requestHintBtn.classList.add('hidden');
        return;
    }

    const hintsUsedInThisTrial = (gameState.currentTeam.hints_used_per_trial || [])
        .find(h => h.trialId === gameState.currentTrial.id);
    
    const count = hintsUsedInThisTrial ? hintsUsedInThisTrial.count : 0;
    const remaining = gameState.currentTrial.hint_count - count;

    document.getElementById('remaining-hints-count').textContent = remaining;
    document.getElementById('hint-cost-display').textContent = gameState.currentTrial.hint_cost || 10;

    if (remaining <= 0) {
        requestHintBtn.disabled = true;
        requestHintBtn.textContent = 'Sin Pistas';
    } else {
        requestHintBtn.disabled = false;
        requestHintBtn.textContent = `Pedir Pista (-${gameState.currentTrial.hint_cost || 10} pts)`;
    }
    requestHintBtn.classList.remove('hidden');
}


// Cargar detalles de la prueba en la UI
function renderTrial(trial) {
    document.getElementById('current-trial-title').textContent = trial.name;
    document.getElementById('trial-narrative-display').textContent = trial.narrative;
    renderMedia(trial.image_url, trial.audio_url, document.getElementById('trial-media-display'));

    const trialContentArea = document.getElementById('trial-specific-content');
    trialContentArea.innerHTML = ''; // Clear previous content

    // Hide/show action buttons
    document.getElementById('validate-answer-btn').classList.add('hidden');
    document.getElementById('scan-qr-btn').classList.add('hidden');
    document.getElementById('check-gps-btn').classList.add('hidden');
    document.getElementById('next-trial-btn').classList.add('hidden');
    document.getElementById('next-location-btn').classList.add('hidden');
    
    // Stop any active QR or GPS processes
    stopQrScanner();
    stopPlayerGPSWatch();
    if (gameState.playerMap) {
        gameState.playerMap.remove();
        gameState.playerMap = null;
    }

    switch (trial.type) {
        case 'text':
            trialContentArea.innerHTML = `
                <div class="form-group">
                    <label for="text-answer">${trial.config.question}</label>
                    <input type="text" id="text-answer" placeholder="Tu respuesta">
                </div>
            `;
            document.getElementById('validate-answer-btn').classList.remove('hidden');
            break;
        case 'qr':
            trialContentArea.innerHTML = `
                <p>Escanea el código QR para revelar la siguiente pista.</p>
                <div id="qr-reader" style="width:100%; max-width: 400px; margin: 0 auto;"></div>
            `;
            document.getElementById('scan-qr-btn').classList.remove('hidden');
            // QR scanner is started via button click in script.js
            break;
        case 'gps':
            trialContentArea.innerHTML = `
                <p>Acércate a la ubicación marcada en el mapa para completar esta prueba.</p>
                <div id="map-container" style="height: 300px; width: 100%;"></div>
            `;
            document.getElementById('check-gps-btn').classList.remove('hidden');
            // Map is initialized when entering the trial
            initPlayerMap(trial.config.gps_latitude, trial.config.gps_longitude);
            break;
        case 'multiple_choice':
            const optionsHtml = trial.config.options.map((option, index) => `
                <li class="options-list-item" data-index="${index}">${option}</li>
            `).join('');
            trialContentArea.innerHTML = `
                <p>${trial.config.question}</p>
                <ul id="mc-options-list" class="options-list">${optionsHtml}</ul>
            `;
            document.getElementById('mc-options-list').addEventListener('click', (e) => {
                if (e.target.classList.contains('options-list-item')) {
                    document.querySelectorAll('.options-list-item').forEach(item => item.classList.remove('selected'));
                    e.target.classList.add('selected');
                    gameState.currentSelectedOption = parseInt(e.target.dataset.index);
                }
            });
            document.getElementById('validate-answer-btn').classList.remove('hidden');
            break;
        case 'ordering':
            const shuffledOptions = shuffleArray([...trial.config.correct_order]); // Shuffle for display
            const orderingHtml = shuffledOptions.map(item => `
                <li class="ordering-list-item" draggable="true">${item}</li>
            `).join('');
            trialContentArea.innerHTML = `
                <p>Arrastra y suelta los elementos para ordenarlos correctamente:</p>
                <ul id="ordering-list" class="ordering-list">${orderingHtml}</ul>
            `;
            setupOrderingList(document.getElementById('ordering-list'));
            gameState.currentOrderingAttempt = shuffledOptions; // Initialize current attempt
            document.getElementById('validate-answer-btn').classList.remove('hidden');
            break;
    }
    updateGameUI(); // Update hint display for the new trial
}

// Function to set up drag and drop for ordering trials
function setupOrderingList(listElement) {
    let draggedItem = null;

    listElement.addEventListener('dragstart', (e) => {
        draggedItem = e.target;
        e.dataTransfer.effectAllowed = 'move';
        draggedItem.classList.add('dragging');
    });

    listElement.addEventListener('dragend', (e) => {
        e.target.classList.remove('dragging');
        draggedItem = null;
        // Update currentOrderingAttempt based on new order
        gameState.currentOrderingAttempt = Array.from(listElement.children).map(item => item.textContent.trim());
    });

    listElement.addEventListener('dragover', (e) => {
        e.preventDefault(); // Allow drop
        const afterElement = getDragAfterElement(listElement, e.clientY);
        const draggable = document.querySelector('.dragging');
        if (afterElement == null) {
            listElement.appendChild(draggable);
        } else {
            listElement.insertBefore(draggable, afterElement);
        }
    });

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.ordering-list-item:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: -Infinity }).element;
    }
}

// Utility to shuffle an array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Render interlude screen
function renderInterlude(title, narrative, imageUrl, audioUrl) {
    document.getElementById('interlude-title').textContent = title;
    document.getElementById('interlude-narrative').textContent = narrative;
    renderMedia(imageUrl, audioUrl, document.getElementById('interlude-media'));
}

// Render game end screen
function showGameEndScreen(teamName, gameTitle, finalScore, totalTimeSeconds, totalHintsUsed) {
    document.getElementById('final-team-name').textContent = teamName;
    document.getElementById('final-game-title').textContent = gameTitle;
    document.getElementById('final-score-display').textContent = finalScore;
    document.getElementById('final-time-display').textContent = formatTime(totalTimeSeconds);
    document.getElementById('final-hints-used-display').textContent = totalHintsUsed;
    showScreen('game-end-screen');
}

// Utility function (can be moved to utils.js)
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const pad = (num) => num < 10 ? '0' + num : num;
    return `${pad(minutes)}:${pad(remainingSeconds)}`;
}