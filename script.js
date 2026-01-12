// SCRIPT.JS - VERSIÓN V10 (SOPORTE TOTAL: TIKTOK, FB, WEB, YT)
const ADMIN_PASSWORD = "admin123";
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwI2NnqPt-u-h8UBDB_NHF1RlJnGfexuA9IeB6g4iyYkZ0nxoD2ped_vLWDkYS66rFSjA/exec";

// ==========================================
// 1. LIMPIEZA
// ==========================================
function sanitizeUrl(url) {
    if (!url) return "";
    url = url.trim();
    const secondHttp = url.indexOf("http", 4); 
    if (secondHttp > -1) {
        url = url.substring(0, secondHttp).trim();
    }
    return url;
}

// ==========================================
// 2. CONVERTIDOR INTELIGENTE (EL CEREBRO)
// ==========================================
function getEmbedUrl(url) {
    url = sanitizeUrl(url);
    
    // 1. TikTok (Convertir link normal a embed)
    // Detecta: tiktok.com/@usuario/video/123456...
    const tiktokMatch = url.match(/tiktok\.com\/@.*\/video\/(\d+)/);
    if (tiktokMatch) {
        return `https://www.tiktok.com/embed/v2/${tiktokMatch[1]}`;
    }

    // 2. Twitch
    const twitchMatch = url.match(/twitch\.tv\/([a-zA-Z0-9_]+)/);
    if (twitchMatch) {
        const parent = window.location.hostname.includes("github.io") ? window.location.hostname : "localhost";
        return `https://player.twitch.tv/?channel=${twitchMatch[1]}&parent=${parent}&muted=false`;
    }
    
    // 3. Facebook
    if (url.includes("facebook.com")) {
        // Facebook necesita encoding especial
        return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&autoplay=true`;
    }

    // 4. YouTube (Solo para vista previa admin)
    if (url.includes("youtu")) {
        const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
        const ytId = (match && match[2].length === 11) ? match[2] : null;
        if (ytId) return `https://www.youtube.com/embed/${ytId}?autoplay=0`;
    }

    // 5. CUALQUIER OTRO SITIO (Webs de noticias, películas, etc.)
    return url; 
}

// ==========================================
// 3. CONEXIÓN BACKEND
// ==========================================
async function getStreamUrl() {
    try {
        const response = await fetch(APPS_SCRIPT_URL);
        const text = await response.text();
        const clean = text.replace(/^\s*[\w\.]+\s*\((.*)\)\s*;?\s*$/, '$1');
        const data = JSON.parse(clean);
        return sanitizeUrl(data.url || "");
    } catch (e) { return ""; }
}

async function saveStreamUrl(url) {
    try {
        await fetch(APPS_SCRIPT_URL, {
            method: "POST", mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({action: "update", url: sanitizeUrl(url)})
        });
        return true;
    } catch { return false; }
}

async function clearStreamUrl() {
    try {
        await fetch(APPS_SCRIPT_URL, {
            method: "POST", mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({action: "clear"})
        });
        return true;
    } catch { return false; }
}

// ==========================================
// 4. LÓGICA DEL REPRODUCTOR (HÍBRIDO)
// ==========================================
if (document.getElementById("mainPlayer") && !document.getElementById("adminPanel")) {

    window.addEventListener("load", async () => {
        const url = await getStreamUrl();
        const ws = document.getElementById("waitingScreen");
        const sc = document.getElementById("streamContainer");
        const vjsElement = document.getElementById("mainPlayer");
        const iframeElement = document.getElementById("genericFrame");

        // SI NO HAY URL, PARAR AQUÍ
        if (!url || url.length < 5) {
            console.log("⛔ Sin transmisión activa.");
            return; 
        }

        console.log("🎬 URL recibida:", url);

        // DETECCIÓN: ¿Es compatible con el Player Pro (Video.js)?
        // Solo YouTube, M3U8 y archivos directos MP4 van al Player Pro.
        const isProCompatible = url.includes("youtu") || url.includes(".m3u8") || url.includes(".mp4");

        if (isProCompatible) {
            console.log("✅ Modo: Player PRO (Video.js)");
            iframeElement.style.display = "none";
            vjsElement.style.display = "block";

            let type = "video/mp4";
            if (url.includes("youtu")) type = "video/youtube";
            else if (url.includes(".m3u8")) type = "application/x-mpegURL";

            const player = videojs('mainPlayer', {
                controls: true,
                autoplay: false,
                preload: 'auto',
                fluid: true,
                techOrder: ['youtube', 'html5'],
                sources: [{ type: type, src: url }],
                youtube: { ytControls: 0, modestbranding: 1, rel: 0, showinfo: 0, iv_load_policy: 3 }
            });

            player.ready(() => {
                ws.style.display = "none";
                sc.style.display = "block";
                player.muted(true);
            });

        } else {
            // MODO UNIVERSAL (Para TikTok, FB, Webs raras, etc.)
            console.log("🌍 Modo: Iframe Universal");
            
            // Apagamos Video.js
            if (videojs.getPlayers()['mainPlayer']) videojs('mainPlayer').dispose();
            else vjsElement.style.display = "none";

            // Encendemos Iframe
            iframeElement.src = getEmbedUrl(url);
            iframeElement.style.display = "block";

            ws.style.display = "none";
            sc.style.display = "block";
        }
    });

    // Auto-Reload inteligente
    setInterval(async () => {
        const incomingUrl = await getStreamUrl();
        const savedUrl = sessionStorage.getItem('lastStreamUrl');

        if (incomingUrl && savedUrl && incomingUrl !== savedUrl) {
            location.reload();
        } else if (incomingUrl) {
            sessionStorage.setItem('lastStreamUrl', incomingUrl);
        }
    }, 30000);
}

// ==========================================
// 5. ADMIN PANEL
// ==========================================
function checkPassword() {
    if (document.getElementById("passwordInput").value === ADMIN_PASSWORD) {
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
    if (url) {
        document.getElementById("previewFrame").src = getEmbedUrl(url);
    }
}

async function updateStream() {
    const url = document.getElementById("videoUrlInput").value.trim();
    if (await saveStreamUrl(url)) {
        alert("✅ Transmisión actualizada");
        loadCurrentStream();
    } else {
        alert("❌ Error de conexión");
    }
}

async function clearStream() {
    if(confirm("¿Detener transmisión?")) {
        await clearStreamUrl();
        alert("🛑 Transmisión detenida");
        location.reload();
    }
}

// ==========================================
// 6. TECLADO
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const pw = document.getElementById("passwordInput");
    const urlIn = document.getElementById("videoUrlInput");
    if (pw) pw.addEventListener("keypress", (e) => { if (e.key === "Enter") checkPassword(); });
    if (urlIn) urlIn.addEventListener("keypress", (e) => { if (e.key === "Enter") updateStream(); });
});
