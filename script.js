// SCRIPT.JS - VERSIÓN V16 (FINAL GITHUB PAGES: LIMITADOR + AYUDA)
const ADMIN_PASSWORD = "admin123";
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwI2NnqPt-u-h8UBDB_NHF1RlJnGfexuA9IeB6g4iyYkZ0nxoD2ped_vLWDkYS66rFSjA/exec";

// ================= VARIABLES GLOBALES IA =================
let recognition;
let isAiActive = false;
let captionTimeout;

// ================= 1. FUNCIONES UTILITARIAS Y AYUDA =================
function sanitizeUrl(url) {
    if (!url) return "";
    url = url.trim();
    const secondHttp = url.indexOf("http", 4); 
    if (secondHttp > -1) url = url.substring(0, secondHttp).trim();
    return url;
}

// NUEVO: Función para abrir/cerrar la guía de configuración
function toggleGuide() {
    const guide = document.getElementById('audioGuide');
    if (guide) {
        // Si está oculto (none) o vacío, lo ponemos flexible. Si no, lo ocultamos.
        guide.style.display = (guide.style.display === 'none' || guide.style.display === '') ? 'flex' : 'none';
    }
}

// ================= 2. CONVERTIDOR DE ENLACES =================
function getEmbedUrl(url) {
    url = sanitizeUrl(url);
    
    // TikTok
    const tiktok = url.match(/tiktok\.com\/@.*\/video\/(\d+)/);
    if (tiktok) return `https://www.tiktok.com/embed/v2/${tiktok[1]}`;
    
    // Twitch (Adaptado para GitHub Pages)
    const twitch = url.match(/twitch\.tv\/([a-zA-Z0-9_]+)/);
    if (twitch) {
        // Detecta si estamos en localhost o en una web real (github.io)
        const parent = window.location.hostname ? window.location.hostname : "localhost";
        return `https://player.twitch.tv/?channel=${twitch[1]}&parent=${parent}&muted=false`;
    }

    // Facebook
    if (url.includes("facebook.com")) return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&autoplay=true`;

    // YouTube
    if (url.includes("youtu")) {
        const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
        const ytId = (match && match[2].length === 11) ? match[2] : null;
        if (ytId) return `https://www.youtube.com/embed/${ytId}?autoplay=0`;
    }

    return url; 
}

// ================= 3. LÓGICA DE IA (RECONOCIMIENTO DE VOZ) =================
function initAI() {
    // Verificamos compatibilidad (Chrome/Edge)
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = true;  
        recognition.interimResults = true; 
        recognition.lang = 'es-ES'; 

        const box = document.getElementById('aiCaptions');

        recognition.onstart = () => console.log("🎤 Micrófono activado...");

        recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            
            // --- NUEVO: LIMITADOR DE TEXTO (SOLUCIÓN A LA ACUMULACIÓN) ---
            let textToShow = finalTranscript || interimTranscript;
            
            // Si el texto supera los 130 caracteres (aprox 3 líneas), cortamos lo antiguo
            if (textToShow.length > 130) {
                textToShow = "..." + textToShow.slice(-130); 
            }
            // ------------------------------------------------------------
            
            if (textToShow.length > 0) {
                box.innerHTML = `<div class="ai-indicator">👂 ESCUCHANDO...</div>${textToShow}`;
                box.style.display = 'block';

                clearTimeout(captionTimeout);
                captionTimeout = setTimeout(() => {
                    box.style.display = 'none';
                }, 4000);
            }
        };

        recognition.onend = () => { if (isAiActive) recognition.start(); };

        recognition.onerror = (event) => {
            console.warn("⚠️ IA Error:", event.error);
            if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                toggleAI(true); 
                alert("❌ ERROR: Acceso denegado al micrófono.\nVerifica el candadito 🔒 (HTTPS) y tu configuración.");
            }
        };
    } else {
        const btn = document.getElementById('btnAI');
        if(btn) btn.style.display = 'none';
    }
}

// Función del botón ON/OFF
function toggleAI(forceOff = false) {
    const btn = document.getElementById('btnAI');
    const box = document.getElementById('aiCaptions');

    if (forceOff || isAiActive) {
        // --- APAGAR ---
        if (recognition) recognition.stop();
        isAiActive = false;
        btn.innerHTML = "<span>🎙️</span> Subtitulo IA prueba 80% (OFF)";
        btn.classList.remove("ai-active");
        box.style.display = 'none';
    } else {
        // --- ENCENDER ---
        try {
            recognition.start();
            isAiActive = true;
            btn.innerHTML = "<span>🔴</span> Subtitulo IA prueba 80% (ON)";
            btn.classList.add("ai-active");
            
            box.innerHTML = `<div class="ai-indicator">👂 INICIANDO...</div>Sube el volumen...`;
            box.style.display = 'block';

            // NUEVO: Si es la primera vez que lo enciende, mostrar la guía automáticamente
            if (!sessionStorage.getItem('guideShown')) {
                toggleGuide(); // Abre el modal
                sessionStorage.setItem('guideShown', 'true'); // Marca como visto
            }

        } catch (e) {
            console.error(e);
        }
    }
}

// ================= 4. CONEXIÓN CON BACKEND =================
async function getStreamUrl() {
    try {
        const r = await fetch(APPS_SCRIPT_URL);
        const t = await r.text();
        const d = JSON.parse(t.replace(/^\s*[\w\.]+\s*\((.*)\)\s*;?\s*$/, '$1'));
        return sanitizeUrl(d.url || "");
    } catch { return ""; }
}
async function saveStreamUrl(url) {
    try { await fetch(APPS_SCRIPT_URL, {method: "POST", mode: "no-cors", headers: {"Content-Type":"application/json"}, body: JSON.stringify({action:"update", url:sanitizeUrl(url)})}); return true; } catch { return false; }
}
async function clearStreamUrl() {
    try { await fetch(APPS_SCRIPT_URL, {method: "POST", mode: "no-cors", headers: {"Content-Type":"application/json"}, body: JSON.stringify({action:"clear"})}); return true; } catch { return false; }
}

// ================= 5. LÓGICA PRINCIPAL DEL REPRODUCTOR =================
if (document.getElementById("mainPlayer") && !document.getElementById("adminPanel")) {
    
    initAI(); 

    window.addEventListener("load", async () => {
        const url = await getStreamUrl();
        const ws = document.getElementById("waitingScreen");
        const sc = document.getElementById("streamContainer");
        const vjsEl = document.getElementById("mainPlayer");
        const iframeEl = document.getElementById("genericFrame");

        if (!url || url.length < 5) return; 

        const isPro = url.includes("youtu") || url.includes(".m3u8") || url.includes(".mp4");

        if (isPro) {
            iframeEl.style.display = "none";
            vjsEl.style.display = "block";
            
            let type = "video/mp4";
            if (url.includes("youtu")) type = "video/youtube";
            else if (url.includes(".m3u8")) type = "application/x-mpegURL";

            const player = videojs('mainPlayer', {
                controls: true, autoplay: false, preload: 'auto', fluid: true,
                techOrder: ['youtube', 'html5'],
                sources: [{ type: type, src: url }],
                html5: { hls: { overrideNative: true }, nativeTextTracks: false },
                youtube: { ytControls: 0, modestbranding: 1, rel: 0, showinfo: 0, iv_load_policy: 3 }
            });
            
            player.ready(() => { ws.style.display = "none"; sc.style.display = "block"; player.muted(true); });

        } else {
            if (videojs.getPlayers()['mainPlayer']) videojs('mainPlayer').dispose();
            else vjsEl.style.display = "none";

            iframeEl.src = getEmbedUrl(url);
            iframeEl.style.display = "block";
            
            ws.style.display = "none";
            sc.style.display = "block";
        }
    });

    setInterval(async () => {
        const inc = await getStreamUrl();
        const sav = sessionStorage.getItem('lastStreamUrl');
        if (inc && sav && inc !== sav) location.reload();
        else if (inc) sessionStorage.setItem('lastStreamUrl', inc);
    }, 30000);
}

// ================= 6. FUNCIONES DEL PANEL DE ADMIN =================
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
    if (url) document.getElementById("previewFrame").src = getEmbedUrl(url);
}

async function updateStream() {
    const url = document.getElementById("videoUrlInput").value.trim();
    if (await saveStreamUrl(url)) { 
        alert("✅ Guardado"); 
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

document.addEventListener("DOMContentLoaded", () => {
    const pw = document.getElementById("passwordInput");
    const urlIn = document.getElementById("videoUrlInput");
    if (pw) pw.addEventListener("keypress", (e) => { if (e.key === "Enter") checkPassword(); });
    if (urlIn) urlIn.addEventListener("keypress", (e) => { if (e.key === "Enter") updateStream(); });
});
