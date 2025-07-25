// player/ui-manager.js

/**
 * Shows a specific screen by adding 'hidden' to others and removing it from the target.
 * @param {string} screenId - The ID of the screen to show.
 */
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden');
        screen.style.overflowY = 'hidden'; // Hide overflow for inactive screens
    });
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.remove('hidden');
        // Allow scrolling for specific content areas within the active screen if needed.
        // For general screen overflow, apply directly to the screen div.
        targetScreen.style.overflowY = 'auto';
    }
    // Ensure body doesn't scroll if screen content is smaller than viewport,
    // but allow scrolling for specific content areas.
    document.body.style.overflow = 'hidden'; // Hide global scrollbar
}

/**
 * Hides a specific screen.
 * @param {string} screenId - The ID of the screen to hide.
 */
function hideScreen(screenId) {
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('hidden');
        targetScreen.style.overflowY = 'hidden';
    }
}

/**
 * Displays a global alert message to the user.
 * @param {string} message - The message to display.
 * @param {'info'|'success'|'warning'|'error'} type - The type of alert (influences styling).
 * @param {number} duration - Duration in milliseconds the alert should be visible.
 */
function showAlert(message, type = 'info', duration = 4000) {
    const alertDiv = document.getElementById('app-alert');
    if (!alertDiv) {
        console.warn('Alert container #app-alert not found.');
        return;
    }

    alertDiv.textContent = message;
    alertDiv.className = `app-alert ${type}`;
    alertDiv.classList.remove('hidden'); // Make sure it's visible
    alertDiv.style.opacity = '1'; // Ensure opacity for animation restart

    // Reset animation
    alertDiv.style.animation = 'none';
    void alertDiv.offsetWidth; // Trigger reflow
    alertDiv.style.animation = null;
    alertDiv.style.animationDuration = `${duration / 1000}s`; // Set animation duration dynamically

    setTimeout(() => {
        alertDiv.classList.add('hidden');
    }, duration);
}

/**
 * Updates the game UI elements like score, timers, and hint counts.
 */
function updateGameUI() {
    if (gameState.currentTeam) {
        document.getElementById('current-score').textContent = gameState.currentTeam.total_score || 0;
        document.getElementById('team-name-display').textContent = gameState.currentTeam.team_name;
        updateRemainingHintsDisplay(); // Update hints for current trial
    }

    // Update global game timer (this is also handled by setInterval in player-script.js)
    const elapsedGameTime = Math.floor((Date.now() - gameState.gameStartTime) / 1000);
    document.getElementById('game-timer-display').textContent = formatTime(elapsedGameTime);

    // Update current trial timer (this is also handled by setInterval in player-script.js)
    const elapsedTrialTime = Math.floor((Date.now() - gameState.trialStartTime) / 1000);
    document.getElementById('trial-timer-display').textContent = formatTime(elapsedTrialTime);
}

/**
 * Updates the display for hints remaining and enables/disables the hint button.
 */
function updateRemainingHintsDisplay() {
    const requestHintBtn = document.getElementById('request-hint-btn');
    const hintsCountDisplay = document.getElementById('hints-count-display');
    const hintCostDisplay = document.getElementById('hint-cost-display');

    if (!gameState.currentTrial) {
        requestHintBtn.classList.add('hidden');
        hintsCountDisplay.textContent = 'N/A';
        hintCostDisplay.textContent = '0';
        return;
    }

    const hintsUsedInThisTrial = (gameState.currentTeam.hints_used_per_trial || [])
        .find(h => h.trialId === gameState.currentTrial.id);
    const usedCount = hintsUsedInThisTrial ? hintsUsedInThisTrial.count : 0;
    const maxHints = gameState.currentTrial.max_hints || 1; // Default max_hints to 1

    const remainingHints = maxHints - usedCount;
    hintsCountDisplay.textContent = remainingHints;
    hintCostDisplay.textContent = gameState.currentTrial.hint_cost || 10; // Default hint cost

    if (remainingHints <= 0) {
        requestHintBtn.disabled = true;
        requestHintBtn.textContent = 'No más pistas';
        hintsCountDisplay.textContent = '0';
    } else {
        requestHintBtn.disabled = false;
        requestHintBtn.textContent = `Pedir Pista (${gameState.currentTrial.hint_cost || 10} pts)`;
    }
    requestHintBtn.classList.remove('hidden');
}

/**
 * Handles selection of an option in a multiple-choice trial.
 * @param {HTMLElement} selectedDiv - The div element of the selected option.
 * @param {number} index - The index of the selected option.
 */
function selectOption(selectedDiv, index) {
    document.querySelectorAll('.option-item').forEach(item => {
        item.classList.remove('selected');
    });
    selectedDiv.classList.add('selected');
    gameState.currentSelectedOption = index;
}

/**
 * Renders a draggable list for ordering type trials.
 * Updates gameState.currentOrderingAttempt on drag and drop.
 * @param {Array<string>} options - Array of options to display.
 * @param {HTMLElement} containerElement - The container for the ordering list.
 */
function renderOrderingList(options, containerElement) {
    containerElement.innerHTML = ''; // Clear previous options
    containerElement.classList.remove('hidden');
    containerElement.classList.add('ordering-list');

    options.forEach((option, index) => {
        const item = document.createElement('div');
        item.className = 'ordering-list-item';
        item.textContent = option;
        item.draggable = true;
        item.dataset.index = index; // Store original index if needed, or current order index
        containerElement.appendChild(item);
    });

    // Add drag and drop functionality
    let draggedItem = null;

    containerElement.addEventListener('dragstart', (e) => {
        draggedItem = e.target;
        setTimeout(() => {
            draggedItem.classList.add('dragging');
        }, 0);
    });

    containerElement.addEventListener('dragend', () => {
        draggedItem.classList.remove('dragging');
        draggedItem = null;
        // Update currentOrderingAttempt based on new order in UI
        gameState.currentOrderingAttempt = Array.from(containerElement.children).map(item => item.textContent.trim());
    });

    containerElement.addEventListener('dragover', (e) => {
        e.preventDefault(); // Allow drop
        const afterElement = getDragAfterElement(containerElement, e.clientY);
        const draggable = document.querySelector('.dragging');
        if (afterElement == null) {
            containerElement.appendChild(draggable);
        } else {
            containerElement.insertBefore(draggable, afterElement);
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

// Utility to shuffle an array (Fisher-Yates)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]]; // Swap elements
    }
    return array;
}

// Expose functions globally for script.js to use
window.showScreen = showScreen;
window.hideScreen = hideScreen;
window.showAlert = showAlert;
window.updateGameUI = updateGameUI;
window.updateRemainingHintsDisplay = updateRemainingHintsDisplay;
window.selectOption = selectOption;
window.renderOrderingList = renderOrderingList;
window.shuffleArray = shuffleArray;