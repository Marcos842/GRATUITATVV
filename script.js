// SCRIPT.JS - VERSIÓN V50 (FINAL: ANTI-FANTASMA + ANTI-ZOMBIE + TIEMPO EXTRA)
const ADMIN_PASSWORD = "admin123";
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwI2NnqPt-u-h8UBDB_NHF1RlJnGfexuA9IeB6g4iyYkZ0nxoD2ped_vLWDkYS66rFSjA/exec";

// ================= VARIABLES GLOBALES IA =================
let recognition;
let isAiActive = false;
let subtitleClearTimer; 
let lastAiUpdate = 0; // Variable para controlar si la IA sigue viva

// ================= 1. FUNCIONES UTILITARIAS =================
function sanitizeUrl(url) {
    if (!url) return "";
    url = url.trim();
    const secondHttp = url.indexOf("http", 4); 
    if (secondHttp > -1) url = url.substring(0, secondHttp).trim();
    return url;
}

// DETECTOR DE DISPOSITIVO
function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// === FUNCIÓN GUARDIÁN VIDEO (ANTI-PAUSA MÓVIL) ===
function forceVideoResume() {
    // Solo actuamos si es celular y la IA está prendida
    if (!isMobile() || !isAiActive) return;

    const player = videojs.getPlayers()['mainPlayer'];
    
    // Si el video se pausó involuntariamente, le damos play
    if (player && player.paused()) {
        console.log("📱 Mobile Guard: Reactivando video...");
        player.play().catch(e => {});
    }
}

// ================= 2. GUÍA INTELIGENTE =================
function toggleGuide() {
    const guide = document.getElementById('audioGuide');
    const pcContent = document.getElementById('guide-pc');
    const mobileContent = document.getElementById('guide-mobile');

    if (!guide) return;

    if (guide.style.display === 'none' || guide.style.display === '') {
        if (isMobile()) {
            if (mobileContent) mobileContent.style.display = 'block';
            if (pcContent) pcContent.style.display = 'none';
        } else {
            if (mobileContent) mobileContent.style.display = 'none';
            if (pcContent) pcContent.style.display = 'block';
        }
        guide.style.display = 'flex';
    } else {
        guide.style.display = 'none';
    }
}

// ================= 3. CONVERTIDOR DE ENLACES =================
function getEmbedUrl(url) {
    url = sanitizeUrl(url);
    const tiktok = url.match(/tiktok\.com\/@.*\/video\/(\d+)/);
    if (tiktok) return `https://www.tiktok.com/embed/v2/${tiktok[1]}`;
    
    const twitch = url.match(/twitch\.tv\/([a-zA-Z0-9_]+)/);
    if (twitch) {
        const parent = window.location.hostname ? window.location.hostname : "localhost";
        return `https://player.twitch.tv/?channel=${twitch[1]}&parent=${parent}&muted=false`;
    }

    if (url.includes("facebook.com")) return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&autoplay=true`;

    if (url.includes("youtu")) {
        const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
        const ytId = (match && match[2].length === 11) ? match[2] : null;
        if (ytId) return `https://www.youtube.com/embed/${ytId}?autoplay=0`;
    }
    return url; 
}

// ================= 4. LÓGICA IA (ANTI-MURO + ANTI-FANTASMA) =================
function updateSubtitleDisplay(text, isFinal) {
    const box = document.getElementById('aiCaptions');
    if (!text || text.length === 0) return;

    // Marcamos que la IA está escuchando (reset del watchdog)
    lastAiUpdate = Date.now();

    // 1. Lógica Anti-Muro (Máximo 14 palabras)
    let words = text.trim().split(/\s+/);
    const MAX_WORDS = 14; 
    if (words.length > MAX_WORDS) {
        text = words.slice(-MAX_WORDS).join(" ");
    }

    clearTimeout(subtitleClearTimer);
    box.innerHTML = text;
    box.style.display = 'block';

    if (isFinal) {
        // TIEMPO EXTENDIDO: 5000ms (5 segundos) para facilitar lectura
        subtitleClearTimer = setTimeout(() => {
            box.style.display = 'none';
            box.innerHTML = '';
        }, 5000); 
    }
}

function initAI() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = true;  
        recognition.interimResults = true; 
        recognition.lang = 'es-ES'; 

        recognition.onstart = () => {
            console.log("🎤 IA Activa...");
            lastAiUpdate = Date.now();
            setTimeout(forceVideoResume, 500); 
        };

        recognition.onresult = (event) => {
            lastAiUpdate = Date.now();

            // --- CORRECCIÓN CLAVE: ANTI-FANTASMA ---
            // Si la memoria de Chrome tiene más de 2 frases acumuladas, 
            // reiniciamos el motor para borrar el historial viejo y evitar el "muro masivo".
            if (event.results.length > 2) {
                recognition.abort(); // Esto borra la memoria y reinicia solo
                return; 
            }

            const lastIndex = event.results.length - 1;
            const transcript = event.results[lastIndex][0].transcript;
            const isFinal = event.results[lastIndex].isFinal;
            
            if (transcript.trim().length > 0) {
                updateSubtitleDisplay(transcript, isFinal);
            }
        };

        recognition.onend = () => { 
            if (isAiActive) {
                recognition.start();
                setTimeout(forceVideoResume, 500);
            }
        };

        recognition.onerror = (event) => {
            console.warn("⚠️ IA Error:", event.error);
            if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                toggleAI(true); 
                alert("❌ ERROR: Revisa permisos de micrófono.");
            }
            forceVideoResume();
        };

        // --- WATCHDOG (ANTI-ZOMBIE PARA CELULAR) ---
        // Si el celular bloquea el micro por el video, esto lo revive a los 8 segundos.
        setInterval(() => {
            if (isAiActive && isMobile()) {
                const tiempoSinAudio = Date.now() - lastAiUpdate;
                if (tiempoSinAudio > 8000) {
                    console.log("💀 IA ZOMBIE - REINICIANDO FORZOSAMENTE...");
                    recognition.abort(); 
                    lastAiUpdate = Date.now();
                }
            }
        }, 2000);

    } else {
        const btn = document.getElementById('btnAI');
        if(btn) btn.style.display = 'none';
    }
}

function toggleAI(forceOff = false) {
    const btn = document.getElementById('btnAI');
    const box = document.getElementById('aiCaptions');

    if (forceOff || isAiActive) {
        if (recognition) recognition.stop();
        isAiActive = false;
        btn.innerHTML = "<span>🎙️</span> Subtítulos IA (OFF)";
        btn.classList.remove("ai-active");
        box.style.display = 'none';
        clearTimeout(subtitleClearTimer);
    } else {
        try {
            recognition.start();
            isAiActive = true;
            btn.innerHTML = "<span>🔴</span> Subtítulos IA (ON)";
            btn.classList.add("ai-active");
            updateSubtitleDisplay("Escuchando...", true);
            
            lastAiUpdate = Date.now();
            forceVideoResume();

            if (!sessionStorage.getItem('guideShown')) {
                toggleGuide();
                sessionStorage.setItem('guideShown', 'true');
            }
        } catch (e) { console.error(e); }
    }
}

// ================= 5. BACKEND & CARGA =================
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

// ================= 6. ADMIN =================
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
    if (await saveStreamUrl(url)) { alert("✅ Guardado"); loadCurrentStream(); } else { alert("❌ Error de conexión"); }
}
async function clearStream() {
    if(confirm("¿Detener transmisión?")) { await clearStreamUrl(); alert("🛑 Transmisión detenida"); location.reload(); }
}
document.addEventListener("DOMContentLoaded", () => {
    const pw = document.getElementById("passwordInput");
    const urlIn = document.getElementById("videoUrlInput");
    if (pw) pw.addEventListener("keypress", (e) => { if (e.key === "Enter") checkPassword(); });
    if (urlIn) urlIn.addEventListener("keypress", (e) => { if (e.key === "Enter") updateStream(); });
});
