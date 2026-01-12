// SCRIPT.JS DEFINITIVO - V5 (CORREGIDO ERROR TECLADO)
const ADMIN_PASSWORD = "admin123";
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwI2NnqPt-u-h8UBDB_NHF1RlJnGfexuA9IeB6g4iyYkZ0nxoD2ped_vLWDkYS66rFSjA/exec";

// --- FUNCIONES DE LIMPIEZA ---
function sanitizeUrl(url) {
    if (!url) return "";
    url = url.trim();
    // Si hay dos URLs pegadas (ej: m3u8https://youtube...), cortamos en el segundo http
    const secondHttp = url.indexOf("http", 4); 
    if (secondHttp > -1) {
        console.warn("⚠️ URL sucia detectada, cortando:", url);
        url = url.substring(0, secondHttp).trim();
    }
    return url;
}

// --- DETECTORES DE PLATAFORMA ---
function getYouTubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

function getTwitchChannel(url) {
    const match = url.match(/twitch\.tv\/([a-zA-Z0-9_]+)/);
    return match ? match[1] : null;
}

function getVimeoId(url) {
    const match = url.match(/vimeo\.com\/(\d+)/);
    return match ? match[1] : null;
}

function getFacebookVideoId(url) {
    const match = url.match(/facebook\.com.*\/videos\/(\d+)/);
    return match ? match[1] : null;
}

function convertToEmbedUrl(url) {
    url = sanitizeUrl(url); // Limpiamos antes de procesar
    let embedUrl = "";

    const youtubeId = getYouTubeId(url);
    if (youtubeId) {
        return `https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=0&controls=1&modestbranding=1&rel=0`;
    }

    const twitchChannel = getTwitchChannel(url);
    if (twitchChannel) {
        const parent = window.location.hostname.includes("github.io") ? window.location.hostname : "localhost";
        return `https://player.twitch.tv/?channel=${twitchChannel}&parent=${parent}&muted=false`;
    }

    const vimeoId = getVimeoId(url);
    if (vimeoId) {
        return `https://player.vimeo.com/video/${vimeoId}?autoplay=1`;
    }

    const facebookId = getFacebookVideoId(url);
    if (facebookId) {
        return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&autoplay=true`;
    }

    return url; // Retorno directo para HLS o iframes genéricos
}

// --- COMUNICACIÓN CON GOOGLE SHEETS ---
async function getStreamUrl() {
    try {
        const response = await fetch(APPS_SCRIPT_URL);
        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            // Limpieza agresiva de JSONP
            const clean = text.replace(/^\s*[\w\.]+\s*\((.*)\)\s*;?\s*$/, '$1');
            try {
                data = JSON.parse(clean);
            } catch (e) {
                console.error("Error parseando JSON limpio:", clean);
                return "";
            }
        }

        const finalUrl = sanitizeUrl(data.url || "");
        console.log("📦 URL Recibida (Limpia):", finalUrl);
        return finalUrl;

    } catch (e) {
        console.error("❌ Error de red:", e);
        return "";
    }
}

async function saveStreamUrl(url) {
    url = sanitizeUrl(url); // Limpiar antes de enviar
    try {
        await fetch(APPS_SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({action: "update", url: url})
        });
        return true;
    } catch {
        return false;
    }
}

async function clearStreamUrl() {
    try {
        await fetch(APPS_SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({action: "clear"})
        });
        return true;
    } catch {
        return false;
    }
}

// --- PLAYER PRINCIPAL (index.html) ---
if (document.getElementById("videoFrame") && !document.getElementById("adminPanel")) {

    function waitForVideoJS() {
        return new Promise(resolve => {
            if (typeof videojs !== 'undefined') return resolve();
            let checks = 0;
            const interval = setInterval(() => {
                if (typeof videojs !== 'undefined' || checks > 50) { // 5 segundos max
                    clearInterval(interval);
                    resolve();
                }
                checks++;
            }, 100);
        });
    }

    window.addEventListener("load", async () => {
        await waitForVideoJS();

        const url = await getStreamUrl();
        const ws = document.getElementById("waitingScreen");
        const sc = document.getElementById("streamContainer");
        const iframe = document.getElementById("videoFrame");
        const hls = document.getElementById("hlsPlayer");

        if (!url) {
            console.log("⏳ Sin transmisión activa");
            return;
        }

        if (url.includes(".m3u8")) {
            console.log("🔄 Modo HLS activado");

            if (videojs.getPlayer('hlsPlayer')) {
                videojs.getPlayer('hlsPlayer').dispose();
            }

            const player = videojs(hls, {
                fluid: true,
                controls: true,
                autoplay: true,
                preload: 'auto',
                html5: {
                    hls: {
                        overrideNative: true,
                        enableLowInitialPlaylist: true
                    }
                }
            });

            player.src({ src: url, type: "application/x-mpegURL" });

            player.ready(() => {
                var promise = player.play();
                if (promise !== undefined) {
                    promise.catch(error => {
                        console.log("Autoplay bloqueado, esperando interacción usuario");
                        player.muted(true);
                        player.play();
                    });
                }
                ws.style.display = "none";
                sc.style.display = "block";
                iframe.style.display = "none";
                hls.style.display = "block";
            });

            player.on('error', function() {
                console.warn("⚠️ Error en HLS, intentando fallback a iframe");
                iframe.src = url;
                hls.style.display = "none";
                iframe.style.display = "block";
            });

        } else {
            console.log("🔄 Modo Iframe activado");
            iframe.src = convertToEmbedUrl(url);
            iframe.style.display = "block";
            hls.style.display = "none";
            ws.style.display = "none";
            sc.style.display = "block";
        }
    });

    setInterval(async () => {
        const currentSrc = document.getElementById("videoFrame").src;
        const incomingUrl = await getStreamUrl();

        if (incomingUrl && !document.body.innerHTML.includes(incomingUrl)) {
            console.log("Cambio detectado, recargando...");
            location.reload();
        }
    }, 30000);
}

// --- PANEL ADMIN (admin.html) ---
function checkPassword() {
    const pw = document.getElementById("passwordInput").value;
    if (pw === ADMIN_PASSWORD) {
        document.getElementById("loginScreen").style.display = "none";
        document.getElementById("adminPanel").style.display = "block";
        loadCurrentStream();
    } else {
        document.getElementById("errorMsg").textContent = "❌ Contraseña incorrecta";
    }
}

async function loadCurrentStream() {
    const url = await getStreamUrl();
    document.getElementById("videoUrlInput").value = url;
    document.getElementById("currentUrl").textContent = url || "Ninguna";
    if (url) document.getElementById("previewFrame").src = convertToEmbedUrl(url);
}

async function updateStream() {
    let url = document.getElementById("videoUrlInput").value.trim();
    url = sanitizeUrl(url);

    if (!url) return alert("URL requerida");

    document.getElementById("videoUrlInput").value = url;
    const ok = await saveStreamUrl(url);

    if (ok) {
        document.getElementById("currentUrl").textContent = url;
        document.getElementById("previewFrame").src = convertToEmbedUrl(url);
        alert("✅ Guardado correctamente");
    } else {
        alert("❌ Error al guardar");
    }
}

async function clearStream() {
    if (confirm("¿Detener transmisión?")) {
        await clearStreamUrl();
        document.getElementById("videoUrlInput").value = "";
        document.getElementById("currentUrl").textContent = "Ninguna";
        document.getElementById("previewFrame").src = "";
    }
}

// --- EVENTOS DE TECLADO (CORREGIDO) ---
document.addEventListener("DOMContentLoaded", () => {
    const pw = document.getElementById("passwordInput");
    const urlIn = document.getElementById("videoUrlInput");

    // Usamos addEventListener para evitar conflictos de retorno
    if (pw) {
        pw.addEventListener("keypress", (e) => {
            if (e.key === "Enter") checkPassword();
        });
    }
    
    if (urlIn) {
        urlIn.addEventListener("keypress", (e) => {
            if (e.key === "Enter") updateStream();
        });
    }
});
