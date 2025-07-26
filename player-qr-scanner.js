// player/qr-scanner.js

let html5QrCode = null;
const QR_READER_ID = "qr-reader"; // ID of the div where the QR reader will be rendered

async function startQrScanner(onScanSuccess) {
    if (html5QrCode && html5QrCode.isScanning) {
        console.log("QR scanner already running.");
        return;
    }

    if (!html5QrCode) {
        html5QrCode = new Html5Qrcode(QR_READER_ID);
    }

    const qrConfig = { fps: 10, qrbox: { width: 250, height: 250 } };

    // Request camera permissions if not granted
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
                    // console.warn(`QR scan error: ${errorMessage}`);
                    // Too frequent, only log on debug or specific errors
                }
            );
            showAlert('Escáner QR iniciado. Apunta la cámara al código.', 'info');
        } else {
            showAlert('No se encontraron cámaras en este dispositivo.', 'error');
        }
    } catch (err) {
        console.error('Error starting QR scanner:', err);
        showAlert('No se pudo iniciar el escáner QR. Asegúrate de tener permisos de cámara.', 'error');
    }
}

function stopQr