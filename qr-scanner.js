// player/qr-scanner.js

let html5QrCode = null;
const QR_READER_ID = "qr-reader"; // ID of the div where the QR reader will be rendered

/**
 * Starts the QR scanner.
 * @param {function(string, any): void} onScanSuccess - Callback function for successful scan (decodedText, decodedResult).
 * @param {function(string): void} [onScanError] - Optional callback for scan errors.
 */
async function startQrScanner(onScanSuccess, onScanError = (errorMessage) => {}) {
    if (!document.getElementById(QR_READER_ID)) {
        console.error(`QR reader container #${QR_READER_ID} not found.`);
        showAlert('Error: Contenedor del escáner QR no encontrado.', 'error');
        return;
    }

    if (html5QrCode && html5QrCode.isScanning) {
        console.log("QR scanner already running.");
        return;
    }

    if (!html5QrCode) {
        html5QrCode = new Html5Qrcode(QR_READER_ID);
    }

    // Configuration for the QR scanner
    const qrConfig = {
        fps: 10, // Frames per second for scanning
        qrbox: { width: 250, height: 250 }, // Size of the QR box
        rememberLastUsedCamera: true, // Remember last camera selection (optional)
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
    };

    try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length) {
            // Use the first available camera
            const cameraId = devices[0].id;
            await html5QrCode.start(
                cameraId,
                qrConfig,
                (decodedText, decodedResult) => {
                    stopQrScanner(); // Stop scanning after first successful scan
                    onScanSuccess(decodedText, decodedResult);
                },
                (errorMessage) => {
                    // console.warn(`QR scan error: ${errorMessage}`); // Too frequent, only log on debug or specific errors
                    onScanError(errorMessage); // Pass error to callback
                }
            );
            showAlert('Escáner QR iniciado. Apunta la cámara al código.', 'info');
            document.getElementById(QR_READER_ID).classList.remove('hidden');
        } else {
            showAlert('No se encontraron cámaras en este dispositivo.', 'error');
            document.getElementById(QR_READER_ID).classList.add('hidden');
        }
    } catch (err) {
        console.error('Error starting QR scanner:', err);
        showAlert('No se pudo iniciar el escáner QR. Asegúrate de tener permisos de cámara y que ninguna otra aplicación la esté usando.', 'error');
        document.getElementById(QR_READER_ID).classList.add('hidden');
    }
}

/**
 * Stops the QR scanner.
 */
function stopQrScanner() {
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
            console.log("QR scanner stopped.");
            document.getElementById(QR_READER_ID).classList.add('hidden');
        }).catch((err) => {
            console.error("Error stopping QR scanner:", err);
            showAlert('Error al detener el escáner QR.', 'error');
        });
    } else {
        console.log("QR scanner not active or already stopped.");
    }
}

// Expose functions globally
window.startQrScanner = startQrScanner;
window.stopQrScanner = stopQrScanner;