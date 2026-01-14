// SCRIPT.JS - VERSIÓN V60 (ESTABILIDAD MÓVIL TOTAL + RECONEXIÓN SUAVE)
const ADMIN_PASSWORD = "admin123";
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwI2NnqPt-u-h8UBDB_NHF1RlJnGfexuA9IeB6g4iyYkZ0nxoD2ped_vLWDkYS66rFSjA/exec";

// ================= VARIABLES GLOBALES =================
let recognition;
let isAiActive = false;
let subtitleClearTimer; 
let lastAiUpdate = 0; 
let myPeer = null;
let screenStream = null;
let isWatchingLive = false; // Nueva variable para proteger la visualización

// ================= 1. FUNCIONES UTILITARIAS =================
function sanitizeUrl(url) {
    if (!url) return "";
    url = url.trim();
    if (url.startsWith("live_screen:")) return url;
    const secondHttp = url.indexOf("http", 4); 
    if (secondHttp > -1) url = url.substring(0, secondHttp).trim();
    return url;
}

function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function forceVideoResume() {
    if (!isMobile() || !isAiActive) return;
    const player = videojs.getPlayers()['mainPlayer'];
    if (player && player.paused()) {
        player.play().catch(e => {});
    }
}

// === GENERADOR DE SEÑAL FANTASMA (NEUTRA) ===
function createSilentStream() {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const dst = oscillator.connect(ctx.createMediaStreamDestination());
    oscillator.start();
    const canvas = document.createElement("canvas");
    canvas.width = 1; canvas.height = 1;
    const canvasStream = canvas.captureStream(10);
    const trackAudio = dst.stream.getAudioTracks()[0];
    const trackVideo = canvasStream.getVideoTracks()[0];
    return new MediaStream([trackAudio, trackVideo]);
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
    if (url.startsWith("live_screen:")) return "";

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

// ================= 4. LÓGICA IA =================
function updateSubtitleDisplay(text, isFinal) {
    const box = document.getElementById('aiCaptions');
    if (!text || text.length === 0) return;
    lastAiUpdate = Date.now(); 
    let words = text.trim().split(/\s+/);
    const MAX_WORDS = 14; 
    if (words.length > MAX_WORDS) text = words.slice(-MAX_WORDS).join(" ");

    clearTimeout(subtitleClearTimer);
    box.innerHTML = text;
    box.style.display = 'block';

    if (isFinal) {
        subtitleClearTimer = setTimeout(() => {
            box.style.display = 'none';
            box.innerHTML = '';
        }, 8000); 
    }
}

function initAI() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = true; recognition.interimResults = true; recognition.lang = 'es-ES'; 

        recognition.onstart = () => { lastAiUpdate = Date.now(); forceVideoResume(); };
        recognition.onresult = (event) => {
            lastAiUpdate = Date.now();
            if (event.results.length > 2) { recognition.abort(); return; }
            const lastIndex = event.results.length - 1;
            const transcript = event.results[lastIndex][0].transcript;
            const isFinal = event.results[lastIndex].isFinal;
            if (transcript.trim().length > 0) updateSubtitleDisplay(transcript, isFinal);
        };
        recognition.onend = () => { if (isAiActive) { try { recognition.start(); } catch(e) {} forceVideoResume(); } };
        recognition.onerror = (event) => {
            if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                toggleAI(true); alert("❌ Revisa micrófono.");
            } else { recognition.abort(); }
            forceVideoResume();
        };
        setInterval(() => {
            if (isAiActive && isMobile()) {
                const ts = Date.now() - lastAiUpdate;
                if (ts > 5000) { recognition.abort(); lastAiUpdate = Date.now(); }
            }
        }, 1000);
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
    } else {
        try {
            recognition.start();
            isAiActive = true;
            btn.innerHTML = "<span>🔴</span> Subtítulos IA (ON)";
            btn.classList.add("ai-active");
            updateSubtitleDisplay("Escuchando...", true);
            lastAiUpdate = Date.now();
            if (!sessionStorage.getItem('guideShown')) { toggleGuide(); sessionStorage.setItem('guideShown', 'true'); }
        } catch (e) { console.error(e); }
    }
}

// ================= 5. BACKEND =================
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

// ================= 6. LÓGICA DE VISOR (INDEX.HTML) =================
if (document.getElementById("mainPlayer") && !document.getElementById("adminPanel")) {
    initAI(); 
    
    // Función de inicialización centralizada
    const loadContent = async () => {
        const url = await getStreamUrl();
        const ws = document.getElementById("waitingScreen");
        const sc = document.getElementById("streamContainer");
        const vjsEl = document.getElementById("mainPlayer");
        const iframeEl = document.getElementById("genericFrame");
        const screenEl = document.getElementById("screenSharePlayer");

        if (!url || url.length < 5) return; 

        // Si ya estamos viendo esta URL, no hacemos nada (Evita recargas tontas)
        if (sessionStorage.getItem('currentActiveUrl') === url && isWatchingLive) return;
        sessionStorage.setItem('currentActiveUrl', url);

        // === MODO PANTALLA COMPARTIDA ===
        if (url.startsWith("live_screen:")) {
            console.log("Modo Pantalla detectado. Iniciando...");
            ws.style.display = "none";
            sc.style.display = "block";
            isWatchingLive = true; // Protegemos la sesión
            
            if(videojs.getPlayers()['mainPlayer']) videojs('mainPlayer').hide();
            vjsEl.style.display = "none";
            iframeEl.style.display = "none";
            screenEl.style.display = "block";
            
            const peerId = url.split(":")[1];
            const peer = new Peer();
            
            peer.on('open', (id) => {
                console.log("PeerJS Conectado. Llamando al Admin...");
                const dummyStream = createSilentStream(); 
                const call = peer.call(peerId, dummyStream);
                
                call.on('stream', (remoteStream) => {
                    console.log("¡STREAM RECIBIDO!");
                    screenEl.srcObject = remoteStream;
                    screenEl.muted = true; // Vital para autoplay móvil
                    
                    const playPromise = screenEl.play();
                    if (playPromise !== undefined) {
                        playPromise.catch(error => {
                            console.log("Autoplay móvil requiere toque.");
                            // No hacemos nada, el usuario tocará play
                        });
                    }
                });
                
                // Si se cierra, intentamos reconectar suavemente en vez de recargar
                call.on('close', () => {
                    console.log("Conexión perdida. Reintentando...");
                    setTimeout(() => location.reload(), 2000); 
                });
                
                call.on('error', (e) => {
                    console.error("Error Peer:", e);
                    // Solo recargamos si es crítico
                    setTimeout(() => location.reload(), 3000);
                });
            });
            return;
        }

        // === MODO URL NORMAL ===
        isWatchingLive = true;
        screenEl.style.display = "none";
        
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
    };

    window.addEventListener("load", loadContent);

    // === SISTEMA DE ACTUALIZACIÓN PROTEGIDO (NUEVO) ===
    // Revisamos cada 60 seg (no 30) para cuidar la cuota de Google
    setInterval(async () => {
        // Si estamos viendo pantalla compartida, NO recargamos por timer
        // Dejamos que PeerJS maneje la conexión.
        if (document.getElementById("screenSharePlayer").style.display === "block") return;

        try {
            const inc = await getStreamUrl();
            const sav = sessionStorage.getItem('lastStreamUrl');
            
            // Solo recargamos si hay URL nueva y es DIFERENTE a la guardada
            // Y aseguramos que 'inc' no esté vacía (error de red)
            if (inc && inc.length > 5 && sav && inc !== sav) {
                console.log("Nueva transmisión detectada. Actualizando...");
                sessionStorage.setItem('lastStreamUrl', inc);
                location.reload();
            } else if (inc && inc.length > 5) {
                sessionStorage.setItem('lastStreamUrl', inc);
            }
        } catch (e) {
            console.log("Error verificando actualización (Ignorado para estabilidad)");
        }
    }, 60000); // 60 segundos
}

// ================= 7. ADMIN =================
function checkPassword() {
    if (document.getElementById("passwordInput").value === ADMIN_PASSWORD) {
        document.getElementById("loginScreen").style.display = "none";
        document.getElementById("adminPanel").style.display = "block";
        loadCurrentStream();
    } else document.getElementById("errorMsg").textContent = "❌ Contraseña incorrecta";
}

async function startScreenShare() {
    try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: "always" },
            audio: true 
        });

        myPeer = new Peer();

        myPeer.on('open', (id) => {
            console.log('Admin ID:', id);
            saveStreamUrl("live_screen:" + id);
            alert("📡 Transmitiendo Pantalla. NO CIERRES esta pestaña.");
            document.getElementById('previewFrame').src = ""; 
        });

        myPeer.on('call', (call) => {
            console.log("Usuario conectado.");
            call.answer(screenStream);
        });

        screenStream.getVideoTracks()[0].onended = () => {
            clearStream();
            if(myPeer) myPeer.destroy();
            alert("Transmisión finalizada.");
        };

    } catch (err) {
        alert("❌ Error: " + err.message);
    }
}

async function loadCurrentStream() {
    const url = await getStreamUrl();
    document.getElementById("videoUrlInput").value = url;
    document.getElementById("currentUrl").textContent = url || "Ninguna";
    if (url && !url.startsWith("live_screen:")) {
        document.getElementById("previewFrame").src = getEmbedUrl(url);
    }
}

async function updateStream() {
    const url = document.getElementById("videoUrlInput").value.trim();
    if (await saveStreamUrl(url)) { alert("✅ Guardado"); loadCurrentStream(); } else { alert("❌ Error de conexión"); }
}

async function clearStream() {
    if(confirm("¿Detener transmisión?")) { await clearStreamUrl(); alert("🛑 Detenida"); location.reload(); }
}

document.addEventListener("DOMContentLoaded", () => {
    const pw = document.getElementById("passwordInput");
    const urlIn = document.getElementById("videoUrlInput");
    if (pw) pw.addEventListener("keypress", (e) => { if (e.key === "Enter") checkPassword(); });
    if (urlIn) urlIn.addEventListener("keypress", (e) => { if (e.key === "Enter") updateStream(); });
});
