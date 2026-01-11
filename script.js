// CONFIGURACIÓN
const ADMIN_PASSWORD = "admin123";
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwI2NnqPt-u-h8UBDB_NHF1RlJnGfexuA9IeB6g4iyYkZ0nxoD2ped_vLWDkYS66rFSjA/exec";

// FUNCIONES PARA DETECTAR PLATAFORMAS
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

    const youtubeId = getYouTubeId(url);
    if (youtubeId) {
        embedUrl = `https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=0&controls=0&modestbranding=1&rel=0&showinfo=0&fs=1&iv_load_policy=3&disablekb=1`;
        console.log('✅ Detectado: YouTube');
        return embedUrl;
    }

    const twitchChannel = getTwitchChannel(url);
    if (twitchChannel) {
        const isGitHubPages = window.location.hostname.includes('github.io');
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

        if (isGitHubPages) {
            embedUrl = `https://player.twitch.tv/?channel=${twitchChannel}&parent=${window.location.hostname}&muted=false`;
        } else if (isLocalhost) {
            embedUrl = `https://player.twitch.tv/?channel=${twitchChannel}&parent=localhost&muted=false`;
        } else {
            embedUrl = `https://player.twitch.tv/?channel=${twitchChannel}&parent=${window.location.hostname}&muted=false`;
        }
        console.log('✅ Detectado: Twitch');
        return embedUrl;
    }

    const vimeoId = getVimeoId(url);
    if (vimeoId) {
        embedUrl = `https://player.vimeo.com/video/${vimeoId}?autoplay=1&title=0&byline=0&portrait=0`;
        console.log('✅ Detectado: Vimeo');
        return embedUrl;
    }

    const facebookId = getFacebookVideoId(url);
    if (facebookId) {
        embedUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&autoplay=true`;
        console.log('✅ Detectado: Facebook');
        return embedUrl;
    }

    if (url.includes('/embed') || url.includes('iframe') || url.includes('player')) {
        console.log('✅ URL de embed detectada - Usando directamente');
        return url;
    }

    console.log('⚠️ Plataforma desconocida - Intentando usar URL directamente');
    return url;
}

async function getStreamUrl() {
    try {
        console.log('🔍 Obteniendo URL desde:', APPS_SCRIPT_URL);
        const response = await fetch(APPS_SCRIPT_URL);
        console.log('📡 Response status:', response.status);
        const data = await response.json();
        console.log('📦 Data recibida:', data);
        return data.url || '';
    } catch (error) {
        console.error('❌ Error al obtener URL:', error);
        console.error('❌ Error completo:', error.message);
        return '';
    }
}

async function saveStreamUrl(url) {
    try {
        console.log('💾 Guardando URL:', url);
        console.log('🌐 Endpoint:', APPS_SCRIPT_URL);

        const payload = { 
            action: 'update', 
            url: url 
        };
        console.log('📤 Payload:', JSON.stringify(payload));

        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        console.log('✅ Petición enviada (no-cors)');
        return true;

    } catch (error) {
        console.error('❌ Error al guardar URL:', error);
        console.error('❌ Error completo:', error.message);
        return false;
    }
}

async function clearStreamUrl() {
    try {
        console.log('🧹 Limpiando stream');

        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                action: 'clear' 
            })
        });

        console.log('✅ Petición de limpieza enviada');
        return true;

    } catch (error) {
        console.error('❌ Error al limpiar URL:', error);
        return false;
    }
}

if (document.getElementById('videoFrame') && !document.getElementById('adminPanel')) {
    window.addEventListener('load', async function() {
        console.log('🔍 Cargando transmisión...');
        const savedUrl = await getStreamUrl();
        const waitingScreen = document.getElementById('waitingScreen');
        const streamContainer = document.getElementById('streamContainer');

        console.log('📡 URL guardada:', savedUrl);

        if (savedUrl) {
            const embedUrl = convertToEmbedUrl(savedUrl);
            console.log('🎬 URL de embed:', embedUrl);

            if (embedUrl) {
                document.getElementById('videoFrame').src = embedUrl;
                waitingScreen.style.display = 'none';
                streamContainer.style.display = 'block';
                console.log('✅ Video cargado correctamente');
            } else {
                console.error('❌ No se pudo procesar la URL');
            }
        } else {
            console.log('⏳ No hay transmisión configurada');
        }
    });

    setInterval(async function() {
        const currentSrc = document.getElementById('videoFrame').src;
        const savedUrl = await getStreamUrl();
        const newEmbedUrl = savedUrl ? convertToEmbedUrl(savedUrl) : '';

        if (currentSrc !== newEmbedUrl) {
            console.log('🔄 Detectado cambio de transmisión, recargando...');
            location.reload();
        }
    }, 30000);
}

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

function logout() {
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('passwordInput').value = '';
    document.getElementById('errorMsg').textContent = '';
}

async function loadCurrentStream() {
    const savedUrl = await getStreamUrl();

    if (savedUrl) {
        document.getElementById('videoUrlInput').value = savedUrl;
        document.getElementById('currentUrl').textContent = savedUrl;
        const embedUrl = convertToEmbedUrl(savedUrl);
        if (embedUrl) {
            document.getElementById('previewFrame').src = embedUrl;
        }
    } else {
        document.getElementById('currentUrl').textContent = 'Ninguna configurada';
    }
}

async function updateStream() {
    const url = document.getElementById('videoUrlInput').value.trim();

    if (!url) {
        alert('⚠️ Por favor ingresa una URL válida');
        return;
    }

    const embedUrl = convertToEmbedUrl(url);

    if (embedUrl) {
        console.log('🚀 Iniciando actualización de stream...');
        const success = await saveStreamUrl(url);

        if (success) {
            document.getElementById('currentUrl').textContent = url;
            document.getElementById('previewFrame').src = embedUrl;
            console.log('✅ Transmisión guardada:', url);

            setTimeout(async () => {
                const verificar = await getStreamUrl();
                if (verificar === url) {
                    alert('✅ ¡Transmisión actualizada y VERIFICADA!\n\n🌍 Todos los visitantes la verán en 30 segundos.\n\n📋 URL para compartir:\n' + window.location.origin + window.location.pathname.replace('admin.html', ''));
                } else {
                    alert('✅ Transmisión enviada\n\n⏳ Verificando en Google Sheets...\nRecarga la página en unos segundos para confirmar.');
                }
            }, 3000);
        } else {
            alert('❌ Error al guardar.\n\nAbre la consola (F12) y revisa los mensajes de error.');
        }
    } else {
        alert('⚠️ No se pudo procesar la URL\n\nAsegúrate de que sea una URL válida de streaming o embed.');
    }
}

async function clearStream() {
    if (confirm('⚠️ ¿Detener transmisión?\n\nTodos los visitantes verán la pantalla de espera.')) {
        const success = await clearStreamUrl();

        if (success) {
            document.getElementById('videoUrlInput').value = '';
            document.getElementById('currentUrl').textContent = 'Ninguna configurada';
            document.getElementById('previewFrame').src = '';
            alert('✅ Transmisión detenida\n\nRecarga la página en unos segundos para verificar.');
        } else {
            alert('❌ Error al limpiar. Abre la consola (F12) para ver detalles.');
        }
    }
}

if (document.getElementById('passwordInput')) {
    document.getElementById('passwordInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            checkPassword();
        }
    });
}

if (document.getElementById('videoUrlInput')) {
    document.getElementById('videoUrlInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            updateStream();
        }
    });
}
