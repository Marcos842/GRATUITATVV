// SCRIPT.JS - VERSIÓN V15 (SUBTÍTULOS VISIBLES + SISTEMA HÍBRIDO)
const ADMIN_PASSWORD = "admin123";
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwI2NnqPt-u-h8UBDB_NHF1RlJnGfexuA9IeB6g4iyYkZ0nxoD2ped_vLWDkYS66rFSjA/exec";

// ================= VARIABLES GLOBALES IA =================
let recognition;
let isAiActive = false;
let captionTimeout;

// ================= 1. LIMPIEZA DE URLS =================
function sanitizeUrl(url) {
    if (!url) return "";
    url = url.trim();
    // Corrige error común de pegar dos veces (http...http...)
    const secondHttp = url.indexOf("http", 4); 
    if (secondHttp > -1) url = url.substring(0, secondHttp).trim();
    return url;
}

// ================= 2. CONVERTIDOR DE ENLACES (EL CEREBRO) =================
function getEmbedUrl(url) {
    url = sanitizeUrl(url);
    
    // TikTok: Convierte link normal a embed
    const tiktok = url.match(/tiktok\.com\/@.*\/video\/(\d+)/);
    if (tiktok) return `https://www.tiktok.com/embed/v2/${tiktok[1]}`;
    
    // Twitch
    const twitch = url.match(/twitch\.tv\/([a-zA-Z0-9_]+)/);
    if (twitch) {
        const parent = window.location.hostname.includes("github.io") ? window.location.hostname : "localhost";
        return `https://player.twitch.tv/?channel=${twitch[1]}&parent=${parent}&muted=false`;
    }

    // Facebook
    if (url.includes("facebook.com")) return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&autoplay=true`;

    // YouTube (Solo para la vista previa del Admin)
    if (url.includes("youtu")) {
        const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
        const ytId = (match && match[2].length === 11) ? match[2] : null;
        if (ytId) return `https://www.youtube.com/embed/${ytId}?autoplay=0`;
    }

    // Si es una web normal (tvGO, páginas de noticias, etc.), devuelve la URL tal cual
    return url; 
}

// ================= 3. LÓGICA DE IA (RECONOCIMIENTO DE VOZ) =================
function initAI() {
    // Verificamos si el navegador es compatible (Chrome/Edge)
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = true;  // No parar cuando el usuario hace pausa
        recognition.interimResults = true; // Mostrar texto mientras se va formando
        recognition.lang = 'es-ES'; // Escuchar en Español

        const box = document.getElementById('aiCaptions');

        // Evento: La IA empieza a escuchar
        recognition.onstart = () => {
            console.log("🎤 Micrófono activado y escuchando...");
        };

        // Evento: La IA detectó sonido/palabras
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
            
            const textToShow = finalTranscript || interimTranscript;
            
            // Solo mostramos la caja si hay texto o sonido detectado
            if (textToShow.length > 0) {
                // Inyectamos el indicador verde + el texto
                box.innerHTML = `<div class="ai-indicator">👂 ESCUCHANDO...</div>${textToShow}`;
                box.style.display = 'block';

                // Temporizador: Si hay silencio por 4 segundos, ocultar la caja
                clearTimeout(captionTimeout);
                captionTimeout = setTimeout(() => {
                    box.style.display = 'none';
                }, 4000);
            }
        };

        // Evento: La IA se apagó sola (pasa a veces en Chrome) -> La reiniciamos
        recognition.onend = () => {
            if (isAiActive) recognition.start(); 
        };

        // Manejo de errores (Permisos denegados, etc)
        recognition.onerror = (event) => {
            console.warn("⚠️ IA Error:", event.error);
            if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                toggleAI(true); // Forzamos apagado visual
                alert("❌ ERROR: No se puede acceder al micrófono. \n\n1. Verifica que tu micrófono esté conectado.\n2. Permite el acceso en el candadito 🔒 de la barra de dirección.");
            }
        };
    } else {
        // Ocultar botón si el navegador es muy viejo
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
            
            // Mostrar mensaje de prueba inmediato
            box.innerHTML = `<div class="ai-indicator">👂 INICIANDO...</div>Sube el volumen de tus parlantes...`;
            box.style.display = 'block';
        } catch (e) {
            console.error(e);
        }
    }
}

// ================= 4. CONEXIÓN CON GOOGLE SHEETS (BACKEND) =================
async function getStreamUrl() {
    try {
        const r = await fetch(APPS_SCRIPT_URL);
        const t = await r.text();
        // Limpieza de JSONP si Google lo envuelve
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
    
    // Cargar motor de IA al inicio (pero apagado)
    initAI(); 

    window.addEventListener("load", async () => {
        const url = await getStreamUrl();
        const ws = document.getElementById("waitingScreen");
        const sc = document.getElementById("streamContainer");
        const vjsEl = document.getElementById("mainPlayer");
        const iframeEl = document.getElementById("genericFrame");

        // SI NO HAY URL, NO HACEMOS NADA (PANTALLA DE ESPERA)
        if (!url || url.length < 5) return; 

        // DETECCIÓN: ¿Es contenido compatible con Video.js (Pro)?
        const isPro = url.includes("youtu") || url.includes(".m3u8") || url.includes(".mp4");

        if (isPro) {
            // MODO PLAYER PRO (AZUL)
            iframeEl.style.display = "none";
            vjsEl.style.display = "block";
            
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
                html5: { hls: { overrideNative: true }, nativeTextTracks: false },
                youtube: { ytControls: 0, modestbranding: 1, rel: 0, showinfo: 0, iv_load_policy: 3, cc_load_policy: 1 }
            });
            
            player.ready(() => { 
                ws.style.display = "none"; 
                sc.style.display = "block"; 
                player.muted(true); 
            });

        } else {
            // MODO IFRAME UNIVERSAL (TV, WEBS, ETC)
            // Limpiamos Video.js para evitar conflictos
            if (videojs.getPlayers()['mainPlayer']) videojs('mainPlayer').dispose();
            else vjsEl.style.display = "none";

            // Cargamos la URL en el marco
            iframeEl.src = getEmbedUrl(url);
            iframeEl.style.display = "block";
            
            ws.style.display = "none";
            sc.style.display = "block";
        }
    });

    // AUTO-RELOAD: Revisa si cambiaste el canal cada 30s
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

// Eventos de teclado (Enter para guardar)
document.addEventListener("DOMContentLoaded", () => {
    const pw = document.getElementById("passwordInput");
    const urlIn = document.getElementById("videoUrlInput");
    if (pw) pw.addEventListener("keypress", (e) => { if (e.key === "Enter") checkPassword(); });
    if (urlIn) urlIn.addEventListener("keypress", (e) => { if (e.key === "Enter") updateStream(); });
});
