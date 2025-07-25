// player/player-game-state.js

let gameState = {
    currentTeam: null,
    currentGame: null,
    currentLocation: null,
    currentTrial: null,
    locations: [], // All locations for the current game
    trials: [],    // All trials for the current location
    playerScore: 0,
    gameStartTime: 0, // Unix timestamp for when the game started
    trialStartTime: 0, // Unix timestamp for when the current trial started
    totalHintsUsed: 0,
    hintsUsedInTrial: 0,
    isGameActive: false,
    progressLog: [], // Array of completed trials with details
    teamId: null, // ID of the current team
    gameId: null, // ID of the current game
    qrScanResult: null, // Stores the last QR scan result
    gpsCheckResult: null, // Stores the last GPS check result
    currentSelectedOption: null, // For multiple-choice trials
    currentOrderingAttempt: null, // For ordering trials
    playerMap: null, // Leaflet map instance
    playerMapMarker: null, // Player's location marker
    targetMapMarker: null, // Target trial location marker
    html5QrCode: null, // html5-qrcode instance
    gameTimerInterval: null, // Interval ID for the global game timer
    trialTimerInterval: null, // Interval ID for the current trial timer
    lastActivity: Date.now() // For optimistic locking/concurrency control
};

// Keys for IndexedDB
const DB_NAME = 'AdventureQuestDB';
const DB_VERSION = 1;
const STORE_NAME = 'gameState';

let db;

// Function to open the IndexedDB
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };

        request.onerror = (event) => {
            console.error('IndexedDB error:', event.target.error);
            reject(event.target.error);
        };
    });
}

// Save current game state to IndexedDB
async function saveGameState() {
    try {
        if (!db) await openDB();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        // Prepare a savable version of gameState (remove non-serializable objects like map/qr instances)
        const savableGameState = { ...gameState };
        delete savableGameState.playerMap;
        delete savableGameState.playerMapMarker;
        delete savableGameState.targetMapMarker;
        delete savableGameState.html5QrCode;
        // Do not save timer intervals directly, they will be recreated on resume
        delete savableGameState.gameTimerInterval;
        delete savableGameState.trialTimerInterval;

        savableGameState.id = 'current_game_state'; // Use a fixed ID for single state object
        savableGameState.lastActivity = Date.now(); // Update last activity timestamp

        const request = store.put(savableGameState);

        request.onsuccess = () => {
            console.log('Game state saved to IndexedDB.');
        };

        request.onerror = (event) => {
            console.error('Error saving game state:', event.target.error);
        };
    } catch (e) {
        console.error('IndexedDB save failed:', e);
    }
}

// Load game state from IndexedDB
async function loadGameState() {
    try {
        if (!db) await openDB();
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get('current_game_state');

        return new Promise((resolve) => {
            request.onsuccess = (event) => {
                const loadedState = event.target.result;
                if (loadedState) {
                    // Restore only serializable parts, non-serializable ones will be re-initialized
                    Object.assign(gameState, loadedState);
                    console.log('Game state loaded from IndexedDB.', gameState);
                    resolve(true);
                } else {
                    console.log('No game state found in IndexedDB.');
                    resolve(false);
                }
            };
            request.onerror = (event) => {
                console.error('Error loading game state:', event.target.error);
                resolve(false);
            };
        });
    } catch (e) {
        console.error('IndexedDB load failed:', e);
        return false;
    }
}

// Clear game state from IndexedDB
async function clearGameState() {
    try {
        if (!db) await openDB();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => {
            console.log('Game state cleared from IndexedDB.');
            // Reset in-memory state
            gameState = {
                currentTeam: null,
                currentGame: null,
                currentLocation: null,
                currentTrial: null,
                locations: [],
                trials: [],
                playerScore: 0,
                gameStartTime: 0,
                trialStartTime: 0,
                totalHintsUsed: 0,
                hintsUsedInTrial: 0,
                isGameActive: false,
                progressLog: [],
                teamId: null,
                gameId: null,
                qrScanResult: null,
                gpsCheckResult: null,
                currentSelectedOption: null,
                currentOrderingAttempt: null,
                playerMap: null,
                playerMapMarker: null,
                targetMapMarker: null,
                html5QrCode: null,
                gameTimerInterval: null,
                trialTimerInterval: null,
                lastActivity: Date.now()
            };
        };

        request.onerror = (event) => {
            console.error('Error clearing game state:', event.target.error);
        };
    } catch (e) {
        console.error('IndexedDB initialization failed:', e);
    }
}

// Initial DB open
openDB();