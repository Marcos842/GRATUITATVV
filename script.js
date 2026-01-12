// SCRIPT.JS - VERSIÓN V6 MASTER (COMPLETO Y DEFINITIVO)
// INCLUYE: Player Pro (YouTube/HLS), Fix Teclado, Soporte Admin y Limpieza de URLs
const ADMIN_PASSWORD = "admin123";
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwI2NnqPt-u-h8UBDB_NHF1RlJnGfexuA9IeB6g4iyYkZ0nxoD2ped_vLWDkYS66rFSjA/exec";

// ==========================================
// 1. FUNCIONES DE LIMPIEZA Y UTILIDADES
// ==========================================
function sanitizeUrl(url) {
    if (!url) return "";
    url = url.trim();
    // Corrección para errores de copiado doble (ej: m3u8https://...)
    const secondHttp = url.indexOf("http", 4); 
    if (secondHttp > -1) {
        console.warn("⚠️ URL sucia detectada, cortando:", url);
        url = url.substring(0, secondHttp).trim();
    }
    return url;
}

// ==========================================
// 2. DETECTORES DE PLATAFORMA (COMPLETOS)
// ==========================================
// Necesarios para que el Panel de Admin reconozca cualquier link
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

// Convierte cualquier link a formato Embed (Usado principalmente por el Admin Panel)
function convertToEmbedUrl(url) {
    url = sanitizeUrl(url);
    
    const youtubeId = getYouTubeId(url);
    if (youtubeId) {
        // Enlace especial para admin (con controles para verificar que funciona)
        return `https://www.youtube.com/embed/${youtubeId}?autoplay=0&controls=1`;
    }

    const twitchChannel = getTwitchChannel(url);
    if (twitchChannel) {
        const parent = window.location.hostname.includes("github.io") ? window.location.hostname : "localhost";
        return `https://player.twitch.tv/?channel=${twitchChannel}&parent=${parent}&muted=false`;
    }

    const vimeoId = getVimeoId(url);
    if (vimeoId) {
        return `https://player.vimeo.com/video/${vimeoId}?autoplay=0`;
    }

    const facebookId = getFacebookVideoId(url);
    if (facebookId) {
        return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&autoplay=false`;
    }

    return url; // Retorno directo para archivos directos o iframes genéricos
}

// ==========================================
// 3. COMUNICACIÓN CON GOOGLE SHEETS (BACKEND)
// ==========================================
async function getStreamUrl() {
    try {
        const response = await fetch(APPS_SCRIPT_URL);
        const text = await response.text();
        let data;
        try {
            // Limpieza robusta de JSONP para evitar errores de sintaxis
            const clean = text.replace(/^\s*[\w\.]+\s*\((.*)\)\s*;?\s*$/, '$1');
            data = JSON.parse(clean);
        } catch (e) {
            console.error("Error parseando datos:", e);
            return "";
        }
        const finalUrl = sanitizeUrl(data.url || "");
        console.log("📦 URL Recibida del servidor:", finalUrl);
        return finalUrl;
    } catch (e) {
        console.error("❌ Error de red:", e);
        return "";
    }
}

async function saveStreamUrl(url) {
    url = sanitizeUrl(url);
    try {
        await fetch(APPS_SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({action: "update", url: url})
        });
        return true;
    } catch { return false; }
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
    } catch { return false; }
}

// ==========================================
// 4. PLAYER PRINCIPAL "PRO" (index.html)
// ==========================================
// Detecta si estamos en la página principal (buscando el player) y no en el admin
if (document.getElementById("mainPlayer") && !document.getElementById("adminPanel")) {

    window.addEventListener("load", async () => {
        const url = await getStreamUrl();
        const ws = document.getElementById("waitingScreen");
        const sc = document.getElementById("streamContainer");
        
        // Configuración Avanzada de Video.js (YouTube + HLS)
        const player = videojs('mainPlayer', {
            controls: true,       // Mostrar barra de control propia
            autoplay: false,      // Autoplay false para evitar bloqueos de navegador
            preload: 'auto',
            fluid: true,          // Responsivo
            techOrder: ['youtube', 'html5'], // Prioridad: 1. YouTube, 2. Archivos directos
            youtube: {
                ytControls: 0,    // 🔥 OCULTA LOS BOTONES ROJOS DE YOUTUBE
                modestbranding: 1,
                rel: 0,
                showinfo: 0,
                iv_load_policy: 3
            },
            html5: {
                hls: {
                    overrideNative: true,
                    enableLowInitialPlaylist: true
                }
            }
        });

        if (!url) {
            console.log("⏳ Esperando transmisión...");
            return;
        }

        console.log("🎬 Iniciando Player Pro con:", url);

        // Determinamos el tipo de contenido para Video.js
        let type = "";
        if (url.includes("youtube.com") || url.includes("youtu.be")) {
            type = "video/youtube";
        } else if (url.includes(".m3u8")) {
            type = "application/x-mpegURL";
        } else {
            type = "video/mp4"; // Intento genérico
        }

        // Cargamos la fuente
        player.src({ type: type, src: url });

        // Evento: Cuando el video está listo para mostrarse
        player.ready(() => {
            ws.style.display = "none";    // Ocultar pantalla de espera
            sc.style.display = "block";   // Mostrar pantalla de video
            
            // Intento de Autoplay Silenciado (Mejor compatibilidad móvil)
            player.muted(true);
            var promise = player.play();
            if (promise !== undefined) {
                promise.catch(error => {
                    console.log("Autoplay bloqueado por el navegador. El usuario debe dar Play.");
                    player.muted(false); // Regresamos el sonido por si acaso
                });
            }
        });
    });

    // Auto-Reload Inteligente: Verifica cambios cada 30 seg
    setInterval(async () => {
        const incomingUrl = await getStreamUrl();
        const player = videojs('mainPlayer');
        const currentSrc = player.src();
        
        // Solo recargar si hay una URL nueva y es diferente a la actual
        if (incomingUrl && incomingUrl !== currentSrc && !currentSrc.includes(incomingUrl)) {
            console.log("🔄 Cambio de transmisión detectado. Actualizando...");
            location.reload();
        }
    }, 30000);
}

// ==========================================
// 5. LÓGICA DEL PANEL DE ADMIN (admin.html)
// ==========================================
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
    
    // Aquí usamos la función convertToEmbedUrl para que el admin vea CUALQUIER tipo de video
    if (url) {
        document.getElementById("previewFrame").src = convertToEmbedUrl(url);
    }
}

async function updateStream() {
    let url = document.getElementById("videoUrlInput").value.trim();
    url = sanitizeUrl(url);

    if (!url) return alert("⚠️ Ingresa una URL válida");

    document.getElementById("videoUrlInput").value = url;
    const ok = await saveStreamUrl(url);

    if (ok) {
        document.getElementById("currentUrl").textContent = url;
        document.getElementById("previewFrame").src = convertToEmbedUrl(url);
        alert("✅ Transmisión actualizada correctamente");
    } else {
        alert("❌ Error al guardar en la base de datos");
    }
}

async function clearStream() {
    if (confirm("¿Estás seguro de detener la transmisión? La audiencia verá la pantalla de espera.")) {
        await clearStreamUrl();
        document.getElementById("videoUrlInput").value = "";
        document.getElementById("currentUrl").textContent = "Ninguna";
        document.getElementById("previewFrame").src = "";
        alert("🛑 Transmisión detenida.");
    }
}

// ==========================================
// 6. EVENTOS DE TECLADO (CORREGIDO)
// ==========================================
// Esto soluciona el problema de no poder escribir en la caja de texto
document.addEventListener("DOMContentLoaded", () => {
    const pw = document.getElementById("passwordInput");
    const urlIn = document.getElementById("videoUrlInput");

    // Usamos addEventListener para no bloquear la escritura
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
