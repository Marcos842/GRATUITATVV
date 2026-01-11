// ==========================================
// CONFIGURACIÓN DE SEGURIDAD
// ==========================================

const ADMIN_PASSWORD = "admin123";  // <-- CAMBIA ESTA CONTRASEÑA

// ==========================================
// FUNCIONES PARA DETECTAR PLATAFORMAS
// ==========================================

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
    let embedUrl = '';

    // YouTube
    const youtubeId = getYouTubeId(url);
    if (youtubeId) {
        embedUrl = `https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1`;
    }

    // Twitch
    const twitchChannel = getTwitchChannel(url);
    if (twitchChannel && !embedUrl) {
        const hostname = window.location.hostname || 'localhost';
        embedUrl = `https://player.twitch.tv/?channel=${twitchChannel}&parent=${hostname}`;
    }

    // Vimeo
    const vimeoId = getVimeoId(url);
    if (vimeoId && !embedUrl) {
        embedUrl = `https://player.vimeo.com/video/${vimeoId}?autoplay=1`;
    }

    // Facebook
    const facebookId = getFacebookVideoId(url);
    if (facebookId && !embedUrl) {
        embedUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&autoplay=true`;
    }

    return embedUrl;
}

// ==========================================
// PÁGINA PÚBLICA (index.html)
// ==========================================

if (document.getElementById('videoFrame') && !document.getElementById('adminPanel')) {
    window.addEventListener('load', function() {
        const savedUrl = localStorage.getItem('currentStreamUrl');
        if (savedUrl) {
            const embedUrl = convertToEmbedUrl(savedUrl);
            if (embedUrl) {
                document.getElementById('videoFrame').src = embedUrl;
            }
        }
    });
}

// ==========================================
// PANEL DE ADMINISTRACIÓN (admin.html)
// ==========================================

// Verificar contraseña
function checkPassword() {
    const password = document.getElementById('passwordInput').value;
    const errorMsg = document.getElementById('errorMsg');

    if (password === ADMIN_PASSWORD) {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';
        loadCurrentStream();
    } else {
        errorMsg.textContent = '❌ Contraseña incorrecta';
        document.getElementById('passwordInput').value = '';
    }
}

// Cerrar sesión
function logout() {
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('passwordInput').value = '';
    document.getElementById('errorMsg').textContent = '';
}

// Cargar stream actual
function loadCurrentStream() {
    const savedUrl = localStorage.getItem('currentStreamUrl');
    if (savedUrl) {
        document.getElementById('videoUrlInput').value = savedUrl;
        document.getElementById('currentUrl').textContent = savedUrl;

        const embedUrl = convertToEmbedUrl(savedUrl);
        if (embedUrl) {
            document.getElementById('previewFrame').src = embedUrl;
        }
    }
}

// Actualizar transmisión
function updateStream() {
    const url = document.getElementById('videoUrlInput').value.trim();

    if (!url) {
        alert('⚠️ Por favor ingresa una URL válida');
        return;
    }

    const embedUrl = convertToEmbedUrl(url);

    if (embedUrl) {
        localStorage.setItem('currentStreamUrl', url);
        document.getElementById('currentUrl').textContent = url;
        document.getElementById('previewFrame').src = embedUrl;
        alert('✅ Transmisión actualizada correctamente\n\nTu audiencia ya puede verla en la página principal');
    } else {
        alert('❌ URL no reconocida\n\nAsegúrate de usar una URL válida de:\n• YouTube\n• Twitch\n• Vimeo\n• Facebook');
    }
}

// Limpiar transmisión
function clearStream() {
    if (confirm('¿Estás seguro de que quieres limpiar la transmisión actual?')) {
        localStorage.removeItem('currentStreamUrl');
        document.getElementById('videoUrlInput').value = '';
        document.getElementById('currentUrl').textContent = 'Ninguna configurada';
        document.getElementById('previewFrame').src = '';
        alert('✅ Transmisión limpiada');
    }
}

// Permitir Enter en login
if (document.getElementById('passwordInput')) {
    document.getElementById('passwordInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            checkPassword();
        }
    });
}

// Permitir Enter en URL input
if (document.getElementById('videoUrlInput')) {
    document.getElementById('videoUrlInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            updateStream();
        }
    });
}