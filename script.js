// SCRIPT.JS FINAL SIN ERRORES - REGEX FIX
// Compatible 100% con HLS, YouTube, Twitch
const ADMIN_PASSWORD = "admin123";
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwI2NnqPt-u-h8UBDB_NHF1RlJnGfexuA9IeB6g4iyYkZ0nxoD2ped_vLWDkYS66rFSjA/exec";

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
    let embedUrl = "";

    const youtubeId = getYouTubeId(url);
    if (youtubeId) {
        embedUrl = `https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=0&controls=0&modestbranding=1&rel=0`;
        console.log("✅ YouTube");
        return embedUrl;
    }

    const twitchChannel = getTwitchChannel(url);
    if (twitchChannel) {
        const parent = window.location.hostname.includes("github.io") ? window.location.hostname : (window.location.hostname === "localhost" ? "localhost" : window.location.hostname);
        embedUrl = `https://player.twitch.tv/?channel=${twitchChannel}&parent=${parent}&muted=false`;
        console.log("✅ Twitch");
        return embedUrl;
    }

    const vimeoId = getVimeoId(url);
    if (vimeoId) {
        embedUrl = `https://player.vimeo.com/video/${vimeoId}?autoplay=1&title=0&byline=0&portrait=0`;
        console.log("✅ Vimeo");
        return embedUrl;
    }

    const facebookId = getFacebookVideoId(url);
    if (facebookId) {
        embedUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&autoplay=true`;
        console.log("✅ Facebook");
        return embedUrl;
    }

    if (url.includes("/embed") || url.includes("iframe") || url.includes("player") || url.includes(".m3u8")) {
        console.log("✅ Direct stream");
        return url;
    }

    console.log("⚠️ Direct URL");
    return url;
    }

    async function getStreamUrl() {
    try {
        const response = await fetch(APPS_SCRIPT_URL);
        const text = await response.text();
        let data;
        try {
        data = JSON.parse(text);
        } catch {
        const clean = text.replace(/^[^({]*\((.*)\)(;)?$/, '$1').replace(/^[^{]*({.*}).*$/, '$1');
        data = JSON.parse(clean);
        }
        console.log("📦 URL:", data.url);
        return data.url || "";
    } catch (e) {
        console.error("❌ Fetch error:", e);
        return "";
    }
    }

    async function saveStreamUrl(url) {
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

    // INDEX.HTML
    if (document.getElementById("videoFrame") && !document.getElementById("adminPanel")) {
    function waitVideoJS() {
        return new Promise(resolve => {
        let t = 0;
        const i = setInterval(() => {
            if (typeof videojs !== "undefined") {
            clearInterval(i);
            resolve();
            }
            if (t++ > 50) {
            clearInterval(i);
            resolve();
            }
        }, 100);
        });
    }

    window.addEventListener("load", async () => {
        await waitVideoJS();
        const url = await getStreamUrl();
        const ws = document.getElementById("waitingScreen");
        const sc = document.getElementById("streamContainer");
        const iframe = document.getElementById("videoFrame");
        const hls = document.getElementById("hlsPlayer");

        if (!url) return;

        if (url.includes(".m3u8")) {
            const player = videojs(hls, {
                fluid: true,
                html5: { vhs: { overrideNative: true, enableLowInitialPlaylist: true } }
            });
            player.src({ src: url, type: "application/x-mpegURL" });
            player.ready(() => {
                player.play().catch(() => {});
                ws.style.display = "none";
                sc.style.display = "block";
                iframe.style.display = "none";
                hls.style.display = "block";
            });
            } else {
            iframe.src = convertToEmbedUrl(url);
            iframe.style.display = "block";
            hls.style.display = "none";
            ws.style.display = "none";
            sc.style.display = "block";
            }
        });

        setInterval(async () => {
            const currentSrc = document.getElementById("videoFrame").src;
            const savedUrl = await getStreamUrl();
            const newEmbedUrl = savedUrl ? convertToEmbedUrl(savedUrl) : "";

            // Solo recargar si cambia URL real (evita loop infinito con m3u8)
            if (savedUrl && !savedUrl.includes(".m3u8") && currentSrc !== newEmbedUrl) {
                location.reload();
            }
        }, 30000);
        }

        // ADMIN PANEL
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
    const url = document.getElementById("videoUrlInput").value.trim();
    if (!url) return alert("URL requerida");
    const ok = await saveStreamUrl(url);
    if (ok) {
        document.getElementById("currentUrl").textContent = url;
        document.getElementById("previewFrame").src = convertToEmbedUrl(url);
        alert("✅ Guardado");
    }
    }

    async function clearStream() {
    if (confirm("Limpiar?")) {
        await clearStreamUrl();
        document.getElementById("videoUrlInput").value = "";
        document.getElementById("currentUrl").textContent = "Ninguna";
        document.getElementById("previewFrame").src = "";
    }
    }

    // KEYBOARD
    document.addEventListener("DOMContentLoaded", () => {
    const pw = document.getElementById("passwordInput");
    const url = document.getElementById("videoUrlInput");
    if (pw) pw.onkeypress = e => e.key === "Enter" && checkPassword();
    if (url) url.onkeypress = e => e.key === "Enter" && updateStream();
    });
