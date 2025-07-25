// player/media-display.js

/**
 * Renders media (image/audio) from URLs into a given container element.
 * @param {string|null} imageUrl - URL of the image to display.
 * @param {string|null} audioUrl - URL of the audio to play.
 * @param {HTMLElement} containerElement - The DOM element where media will be rendered.
 */
function renderMedia(imageUrl, audioUrl, containerElement) {
    if (!containerElement) {
        console.error('Media container element is null.');
        return;
    }

    containerElement.innerHTML = ''; // Clear previous media content

    let hasMedia = false;

    if (imageUrl) {
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = 'Contenido visual de la prueba';
        img.classList.add('trial-image'); // Add a class for specific styling
        containerElement.appendChild(img);
        hasMedia = true;
    }

    if (audioUrl) {
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.src = audioUrl;
        audio.classList.add('trial-audio'); // Add a class for specific styling
        containerElement.appendChild(audio);
        hasMedia = true;
    }

    if (!hasMedia) {
        containerElement.classList.add('hidden');
    } else {
        containerElement.classList.remove('hidden');
    }
}