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

    // YouTube - Sin controles visibles
    const youtubeId = getYouTubeId(url);
    if (youtubeId) {
        embedUrl = `https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=0&controls=0&modestbranding=1&rel=0&showinfo=0&fs=1&iv_load_policy=3&disablekb=1`;
    }

    // Twitch - ARREGLADO PARA GITHUB PAGES
    const twitchChannel = getTwitchChannel(url);
    if (twitchChannel && !embedUrl) {
        // Detectar si estamos en GitHub Pages o localhost
        const isGitHubPages = window.location.hostname.includes('github.io');
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

        if (isGitHubPages) {
            // Para GitHub Pages usar el dominio completo
            const domain = window.location.hostname;
            embedUrl = `https://player.twitch.tv/?channel=${twitchChannel}&parent=${domain}&muted=false`;
        } else if (isLocalhost) {
            // Para localhost
            embedUrl = `https://player.twitch.tv/?channel=${twitchChannel}&parent=localhost&muted=false`;
        } else {
            // Para otros dominios
            embedUrl = `https://player.twitch.tv/?channel=${twitchChannel}&parent=${window.location.hostname}&muted=false`;
        }
    }

    // Vimeo
    const vimeoId = getVimeoId(url);
    if (vimeoId && !embedUrl) {
        embedUrl = `https://player.vimeo.com/video/${vimeoId}?autoplay=1&title=0&byline=0&portrait=0`;
    }

    // Facebook
    const facebookId = getFacebookVideoId(url);
    if (facebookId && !embedUrl) {
        embedUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&autoplay=true`;
    }

    return embedUrl;
}

// ==========================================
// PÁGINA PÚBLICA (index.html)
// ==========================================

if (document.getElementById('videoFrame') && !document.getElementById('adminPanel')) {
    window.addEventListener('load', function() {
        console.log('🔍 Cargando transmisión...');

        const savedUrl = localStorage.getItem('currentStreamUrl');
        const waitingScreen = document.getElementById('waitingScreen');
        const streamContainer = document.getElementById('streamContainer');

        console.log('📡 URL guardada:', savedUrl);

        if (savedUrl) {
            const embedUrl = convertToEmbedUrl(savedUrl);
            console.log('🎬 URL de embed:', embedUrl);

            if (embedUrl) {
                // Mostrar video, ocultar pantalla de espera
                document.getElementById('videoFrame').src = embedUrl;
                waitingScreen.style.display = 'none';
                streamContainer.style.display = 'block';
                console.log('✅ Video cargado correctamente');
            } else {
                console.error('❌ No se pudo convertir la URL a formato embed');
            }
        } else {
            console.log('⏳ No hay transmisión configurada, mostrando pantalla de espera');
        }
    });

    // Recargar cuando el localStorage cambie (en otra pestaña)
    window.addEventListener('storage', function(e) {
        if (e.key === 'currentStreamUrl') {
            location.reload();
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
        // Guardar en localStorage
        localStorage.setItem('currentStreamUrl', url);

        // Actualizar interfaz
        document.getElementById('currentUrl').textContent = url;
        document.getElementById('previewFrame').src = embedUrl;

        console.log('✅ Transmisión guardada:', url);
        console.log('🔗 Embed URL:', embedUrl);

        alert('✅ Transmisión actualizada correctamente\n\nAhora abre la página principal (sin /admin.html)\ny presiona Ctrl+Shift+R para limpiar el caché.\n\nURL para compartir:\n' + window.location.origin + window.location.pathname.replace('admin.html', ''));
    } else {
        alert('❌ URL no reconocida\n\nAsegúrate de usar una URL válida de:\n• YouTube\n• Twitch\n• Vimeo\n• Facebook');
    }
}

// Limpiar transmisión
function clearStream() {
    if (confirm('¿Estás seguro?\n\nLa audiencia volverá a ver la pantalla de espera.')) {
        localStorage.removeItem('currentStreamUrl');
        document.getElementById('videoUrlInput').value = '';
        document.getElementById('currentUrl').textContent = 'Ninguna configurada';
        document.getElementById('previewFrame').src = '';
        alert('✅ Transmisión limpiada\n\nLos usuarios verán la pantalla de espera.');
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
