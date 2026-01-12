// SCRIPT.JS - VERSIÓN V7 (FIX DEFINITIVO ERROR YOUTUBE UNDEFINED)
// FECHA: 11/01/2026
// ESTADO: BUG CORREGIDO (Lógica de carga diferida)

const ADMIN_PASSWORD = "admin123";
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwI2NnqPt-u-h8UBDB_NHF1RlJnGfexuA9IeB6g4iyYkZ0nxoD2ped_vLWDkYS66rFSjA/exec";

// ==========================================
// 1. FUNCIONES DE LIMPIEZA Y UTILIDADES
// ==========================================
function sanitizeUrl(url) {
    if (!url) return "";
    url = url.trim();
    // Corrección para errores de copiado doble
    const secondHttp = url.indexOf("http", 4); 
    if (secondHttp > -1) {
        url = url.substring(0, secondHttp).trim();
    }
    return url;
}

// ==========================================
// 2. DETECTORES (PARA EL ADMIN PANEL)
// ==========================================
function getYouTubeId(url) {
    const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
    return (match && match[2].length === 11) ? match[2] : null;
}

function convertToEmbedUrl(url) {
    url = sanitizeUrl(url);
    const youtubeId = getYouTubeId(url);
    // Vista previa admin: mostramos controles para verificar que funciona
    if (youtubeId) return `https://www.youtube.com/embed/${youtubeId}?autoplay=0&controls=1`;
    return url; 
}

// ==========================================
// 3. COMUNICACIÓN BACKEND (GOOGLE SHEETS)
// ==========================================
async function getStreamUrl() {
    try {
        const response = await fetch(APPS_SCRIPT_URL);
        const text = await response.text();
        // Limpieza agresiva de JSONP
        const clean = text.replace(/^\s*[\w\.]+\s*\((.*)\)\s*;?\s*$/, '$1');
        const data = JSON.parse(clean);
        return sanitizeUrl(data.url || "");
    } catch (e) {
        console.error("Error red:", e);
        return "";
    }
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
// 4. PLAYER PRINCIPAL (LÓGICA BLINDADA V7)
// ==========================================
if (document.getElementById("mainPlayer") && !document.getElementById("adminPanel")) {

    window.addEventListener("load", async () => {
        // 1. PRIMERO obtenemos la URL
        const url = await getStreamUrl();
        const ws = document.getElementById("waitingScreen");
        const sc = document.getElementById("streamContainer");
        
        // 2. CHECK DE SEGURIDAD: Si no hay URL, NO tocamos Video.js
        if (!url) {
            console.log("⏳ No hay transmisión activa. Manteniendo pantalla de espera.");
            return; // Aquí se detiene el script y evita el error "undefined src"
        }

        console.log("🎬 URL encontrada:", url);

        // 3. Detectamos el tipo de video
        let type = "video/mp4"; // Default
        if (url.includes("youtube.com") || url.includes("youtu.be")) type = "video/youtube";
        else if (url.includes(".m3u8")) type = "application/x-mpegURL";

        // 4. AHORA SÍ iniciamos el Player (porque ya tenemos datos seguros)
        const player = videojs('mainPlayer', {
            controls: true,
            autoplay: false,
            preload: 'auto',
            fluid: true,
            techOrder: ['youtube', 'html5'],
            // CLAVE: Inyectamos la fuente DIRECTAMENTE al nacer
            sources: [{ type: type, src: url }], 
            youtube: {
                ytControls: 0, // Ocultar interfaz YouTube
                modestbranding: 1,
                rel: 0,
                showinfo: 0,
                iv_load_policy: 3
            }
        });

        // 5. Comportamiento visual
        player.ready(() => {
            ws.style.display = "none";
            sc.style.display = "block";
            
            // Intento de autoplay suave (muteado)
            player.muted(true);
            setTimeout(() => {
                const promise = player.play();
                if (promise !== undefined) {
                    promise.catch(() => {
                        console.log("Autoplay bloqueado. Esperando clic del usuario.");
                        player.muted(true);
                    });
                }
            }, 500);
        });
    });

    // Auto-Reload Inteligente (Protegido)
    setInterval(async () => {
        const incomingUrl = await getStreamUrl();
        
        // Caso A: El player ya existe -> Verificamos si cambió la URL
        if (videojs.getPlayer('mainPlayer')) {
            const player = videojs('mainPlayer');
            const currentSrc = player.src();
            // Si la nueva URL es diferente a la actual
            if (incomingUrl && incomingUrl !== currentSrc && !currentSrc.includes(incomingUrl)) {
                console.log("🔄 Cambio de canal detectado -> Recargando");
                location.reload();
            }
        } 
        // Caso B: Estábamos en pantalla de espera y de repente llega una URL
        else if (incomingUrl) {
            console.log("⚡ Señal nueva detectada -> Recargando para iniciar player");
            location.reload();
        }
    }, 30000); // Revisar cada 30 seg
}

// ==========================================
// 5. PANEL ADMIN
// ==========================================
function checkPassword() {
    if (document.getElementById("passwordInput").value === ADMIN_PASSWORD) {
        document.getElementById("loginScreen").style.display = "none";
        document.getElementById("adminPanel").style.display = "block";
        loadCurrentStream();
    } else document.getElementById("errorMsg").textContent = "❌ Contraseña incorrecta";
}

async function loadCurrentStream() {
    const url = await getStreamUrl();
    document.getElementById("videoUrlInput").value = url;
    document.getElementById("currentUrl").textContent = url || "Ninguna";
    if (url) document.getElementById("previewFrame").src = convertToEmbedUrl(url);
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
// 6. EVENTOS DE TECLADO
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const pw = document.getElementById("passwordInput");
    const urlIn = document.getElementById("videoUrlInput");
    // Usamos addEventListener para permitir escritura normal
    if (pw) pw.addEventListener("keypress", (e) => { if (e.key === "Enter") checkPassword(); });
    if (urlIn) urlIn.addEventListener("keypress", (e) => { if (e.key === "Enter") updateStream(); });
});
