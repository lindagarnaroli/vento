// prova-occhiali.js – prova gli occhiali con la fotocamera e scatta una foto (pagina occhiale.html).
// Si carica solo quando si clicca "Provali con la fotocamera" (vedi js/occhiali-galleria.js).
//
// Come funziona:
//  1. la fotocamera (quella frontale sul telefono) riprende il viso;
//  2. MediaPipe Face Landmarker (una libreria di Google) trova 478 punti del viso in ogni fotogramma;
//  3. con alcuni punti (angoli degli occhi, fronte, mento, lati del viso, attaccatura del naso)
//     calcolo dove sta il viso, quanto è grande e come è girato, e ci metto sopra gli occhiali 3D
//     con i colori scelti nel pannello;
//  4. "Scatta la foto" unisce il fotogramma e gli occhiali in un'immagine;
//  5. la foto si può scaricare o mandare su Instagram, WhatsApp o per email.
//     Un sito non può allegare una foto direttamente a queste app: sul telefono i bottoni aprono
//     il menu "Condividi" del sistema con la foto già dentro (lì si tocca l'app scelta);
//     sul computer la foto si scarica e si apre WhatsApp Web o la posta, per allegarla.
// Il video non esce mai dal dispositivo: tutto viene calcolato nel browser.
// La fotocamera funziona solo da https o da un server locale (es. Live Server).

const VISION = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODELLO_VISO = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

// i punti del viso che uso (numeri dei 478 punti di MediaPipe)
const OCCHIO_DESTRO_ESTERNO = 33;     // a sinistra nell'immagine
const OCCHIO_SINISTRO_ESTERNO = 263;  // a destra nell'immagine
const FRONTE = 10;
const MENTO = 152;
const RADICE_NASO = 168;              // tra gli occhi, dove appoggia il ponte degli occhiali
const LATO_DESTRO = 234;
const LATO_SINISTRO = 454;

let riconoscitore = null;   // MediaPipe si prepara una volta sola, poi resta pronto
let aperta = null;          // la prova in corso (fotocamera, 3D, foto)

const finestra = document.getElementById('prova-occhiali');
const scena = document.getElementById('prova-scena');
const video = scena.querySelector('video');
const fotoAnteprima = scena.querySelector('.prova-foto');
const messaggio = scena.querySelector('.prova-messaggio');
const bottoneScatta = document.getElementById('prova-scatta');
const linkScarica = document.getElementById('prova-scarica');
const condivisione = document.getElementById('prova-condividi');
const avviso = document.getElementById('prova-avviso');
const bottoneRifai = document.getElementById('prova-rifai');
const bottoneChiudi = document.getElementById('prova-chiudi');

// ===== GRANDEZZA DEGLI OCCHIALI SUL VISO =====
// Il viso dà la grandezza di partenza; lo slider (e i bottoni − e +) la moltiplica da 0.6 a 1.4.
const sliderGrandezza = document.getElementById('prova-grandezza');
const valoreGrandezza = document.getElementById('prova-grandezza-valore');
let ingrandimento = 1;

function impostaGrandezza(percento) {
    percento = Math.min(Number(sliderGrandezza.max), Math.max(Number(sliderGrandezza.min), percento));
    sliderGrandezza.value = percento;
    valoreGrandezza.textContent = percento + '%';
    ingrandimento = percento / 100;
}

sliderGrandezza.addEventListener('input', function () {
    impostaGrandezza(Number(sliderGrandezza.value));
});
document.getElementById('prova-rimpicciolisci').addEventListener('click', function () {
    impostaGrandezza(Number(sliderGrandezza.value) - 5);
});
document.getElementById('prova-ingrandisci').addEventListener('click', function () {
    impostaGrandezza(Number(sliderGrandezza.value) + 5);
});

function scrivi(testo) {
    messaggio.textContent = testo;
    messaggio.hidden = !testo;
}

async function preparaRiconoscitore() {
    if (riconoscitore) return riconoscitore;
    const vision = await import(VISION + '/vision_bundle.mjs');
    const file = await vision.FilesetResolver.forVisionTasks(VISION + '/wasm');
    const opzioni = function (delegate) {
        return {
            baseOptions: { modelAssetPath: MODELLO_VISO, delegate: delegate },
            runningMode: 'VIDEO',
            numFaces: 1
        };
    };
    try {
        riconoscitore = await vision.FaceLandmarker.createFromOptions(file, opzioni('GPU'));
    } catch (e) {
        // se la scheda video non va bene, uso il processore (più lento ma funziona ovunque)
        riconoscitore = await vision.FaceLandmarker.createFromOptions(file, opzioni('CPU'));
    }
    return riconoscitore;
}

// gli occhiali da mettere sul viso: copie dei pezzi del visore (stesse forme e colori)
function costruisciOcchiali(THREE, box) {
    const modello = new THREE.Group();
    // le lenti: sempre trasparenti e colorate, così si vedono gli occhi
    const colore = box.stato.lenti === 'originale' ? new THREE.Color('#d8dde2') : box.matLenti.color.clone();
    const matLenti = new THREE.MeshPhysicalMaterial({
        color: colore, transparent: true, opacity: 0.35, roughness: 0.05,
        metalness: 0, side: THREE.DoubleSide, depthWrite: false
    });

    const scatola = new THREE.Box3();
    const scatolaLenti = new THREE.Box3();
    box.modello.pezzi.forEach(function (pezzo) {
        const lente = pezzo.userData.lente;
        const copia = new THREE.Mesh(pezzo.geometry, lente ? matLenti : pezzo.material);
        copia.frustumCulled = false;
        copia.renderOrder = lente ? 2 : 1;
        modello.add(copia);
        pezzo.geometry.computeBoundingBox();
        scatola.union(pezzo.geometry.boundingBox);
        if (lente) scatolaLenti.union(pezzo.geometry.boundingBox);
    });

    // il punto degli occhiali che va sulla radice del naso:
    // al centro, all'altezza delle lenti, sul davanti
    const riferimento = scatolaLenti.isEmpty() ? scatola : scatolaLenti;
    const aggancio = new THREE.Vector3(0, riferimento.getCenter(new THREE.Vector3()).y, scatola.max.z - 0.15);
    modello.position.copy(aggancio).negate();
    return { modello: modello, matLenti: matLenti, aggancio: aggancio };
}

export async function apri(parti) {
    const THREE = parti.THREE;
    const RoomEnvironment = parti.RoomEnvironment;
    const box = parti.box;
    const occhiale = parti.occhiale;
    // la scritta in basso nella foto e il testo quando la si condivide (ogni pagina può avere i suoi)
    const firma = parti.firma || ('Triennale Milano · La collezione · ' + occhiale.nome);
    const testoCondivisione = parti.testoCondivisione || ('I miei occhiali ' + occhiale.nome + ' alla Triennale Milano');
    if (aperta) return;

    document.getElementById('prova-nome').textContent = occhiale.nome;
    finestra.hidden = false;
    document.body.style.overflow = 'hidden';   // la pagina sotto non scorre
    bottoneScatta.disabled = true;
    bottoneScatta.hidden = false;
    condivisione.hidden = true;
    avviso.hidden = true;
    bottoneRifai.hidden = true;
    fotoAnteprima.hidden = true;
    video.hidden = false;
    scrivi('Accendo la fotocamera…');
    bottoneChiudi.focus();

    const prova = { fermata: false };
    aperta = prova;

    // ===== 1. LA FOTOCAMERA =====
    try {
        prova.stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false
        });
    } catch (e) {
        console.error(e);
        scrivi('Non riesco ad accendere la fotocamera. Controlla di averle dato il permesso (e di aver aperto la pagina da Live Server o da https).');
        return;
    }
    if (prova.fermata) { prova.stream.getTracks().forEach(function (t) { t.stop(); }); return; }
    video.srcObject = prova.stream;
    await video.play();
    const W = video.videoWidth, H = video.videoHeight;

    // la scena ha la forma del video e non è più alta del 70% dello schermo
    scena.style.aspectRatio = W + ' / ' + H;
    scena.style.width = 'min(100%, calc(70vh * ' + (W / H).toFixed(4) + '))';

    // ===== 2. IL RICONOSCIMENTO DEL VISO =====
    scrivi('Preparo il riconoscimento del viso…');
    try {
        await preparaRiconoscitore();
    } catch (e) {
        console.error(e);
        scrivi('Non riesco a caricare il riconoscimento del viso. Serve la connessione a internet.');
        return;
    }
    if (prova.fermata) return;
    scrivi('Guarda in camera: cerco il tuo viso…');

    // ===== 3. IL 3D SOPRA IL VIDEO =====
    // La camera è "piatta" (ortografica) e misura in pixel del video:
    // x da 0 a W, y da 0 a H (in alto), z verso di me.
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.domElement.className = 'prova-3d';
    scena.insertBefore(renderer.domElement, fotoAnteprima);
    renderer.setSize(scena.clientWidth, scena.clientHeight);
    prova.renderer = renderer;

    const scena3d = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scena3d.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scena3d.environmentIntensity = 0.6;
    scena3d.add(new THREE.HemisphereLight(0xffffff, 0xd9cbb5, 1.0));
    const luce = new THREE.DirectionalLight(0xffffff, 1.8);
    luce.position.set(0.3, 0.6, 1);
    scena3d.add(luce);

    const camera = new THREE.OrthographicCamera(0, W, H, 0, -100000, 100000);

    // il "viso": un gruppo che segue la testa. Dentro ci sono gli occhiali
    // e una testa invisibile che nasconde le stanghette quando passano dietro la testa.
    const viso = new THREE.Group();
    viso.visible = false;
    scena3d.add(viso);
    const occhiali = costruisciOcchiali(THREE, box);
    viso.add(occhiali.modello);

    const LARGHEZZA_VISO = 3;   // nel gruppo "viso" il viso è largo 3, come gli occhiali
    const testa = new THREE.Mesh(
        new THREE.SphereGeometry(1, 32, 24),
        new THREE.MeshBasicMaterial({ colorWrite: false })   // non si vede, ma copre quello che sta dietro
    );
    testa.scale.set(0.46 * LARGHEZZA_VISO, 0.7 * LARGHEZZA_VISO, 0.6 * LARGHEZZA_VISO);
    testa.position.set(0, -0.15 * LARGHEZZA_VISO, -0.62 * LARGHEZZA_VISO);
    testa.renderOrder = 0;   // disegnata per prima
    viso.add(testa);

    function adatta() {
        renderer.setSize(scena.clientWidth, scena.clientHeight);
    }
    window.addEventListener('resize', adatta);
    prova.adatta = adatta;

    // ===== 4. OGNI FOTOGRAMMA: trovo il viso e ci appoggio gli occhiali =====
    const punto = function (punti, i) {
        // da coordinate di MediaPipe (0..1, y in basso) a pixel del video (y in alto, z verso di me)
        return new THREE.Vector3(punti[i].x * W, (1 - punti[i].y) * H, -punti[i].z * W);
    };
    const destra = new THREE.Vector3(), su = new THREE.Vector3(), avanti = new THREE.Vector3();
    const base = new THREE.Matrix4();
    const rotazione = new THREE.Quaternion();
    let ultimoTempo = -1;
    let trovatoUnaVolta = false;

    function fotogramma() {
        if (prova.fermata) return;
        prova.raf = requestAnimationFrame(fotogramma);
        if (!fotoAnteprima.hidden) return;   // sto guardando la foto scattata

        if (video.currentTime !== ultimoTempo) {
            ultimoTempo = video.currentTime;
            const risultato = riconoscitore.detectForVideo(video, performance.now());
            const punti = risultato.faceLandmarks && risultato.faceLandmarks[0];
            if (punti) {
                // gli assi del viso: destra (tra gli occhi), su (dal mento alla fronte), avanti
                destra.subVectors(punto(punti, OCCHIO_SINISTRO_ESTERNO), punto(punti, OCCHIO_DESTRO_ESTERNO)).normalize();
                su.subVectors(punto(punti, FRONTE), punto(punti, MENTO)).normalize();
                avanti.crossVectors(destra, su).normalize();
                su.crossVectors(avanti, destra).normalize();
                base.makeBasis(destra, su, avanti);
                rotazione.setFromRotationMatrix(base);

                const posizione = punto(punti, RADICE_NASO);
                const scala = punto(punti, LATO_DESTRO).distanceTo(punto(punti, LATO_SINISTRO)) / LARGHEZZA_VISO;
                // la grandezza scelta con lo slider cambia solo gli occhiali, non la testa invisibile
                occhiali.modello.scale.setScalar(ingrandimento);
                occhiali.modello.position.copy(occhiali.aggancio).multiplyScalar(-ingrandimento);

                if (!viso.visible) {
                    viso.position.copy(posizione);
                    viso.quaternion.copy(rotazione);
                    viso.scale.setScalar(scala);
                } else {
                    // movimenti morbidi: metà strada verso la nuova posizione (meno tremolio)
                    viso.position.lerp(posizione, 0.5);
                    viso.quaternion.slerp(rotazione, 0.5);
                    viso.scale.setScalar(viso.scale.x + (scala - viso.scale.x) * 0.5);
                }
                viso.visible = true;
                if (!trovatoUnaVolta) {
                    trovatoUnaVolta = true;
                    bottoneScatta.disabled = false;
                    scrivi('');
                }
            } else {
                viso.visible = false;
            }
        }
        renderer.render(scena3d, camera);
    }
    fotogramma();

    // ===== 5. LA FOTO =====
    prova.scatta = function () {
        renderer.render(scena3d, camera);
        const foto = document.createElement('canvas');
        foto.width = W;
        foto.height = H;
        const ctx = foto.getContext('2d');
        // come in uno specchio: video e occhiali girati da destra a sinistra
        ctx.save();
        ctx.translate(W, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, W, H);
        ctx.drawImage(renderer.domElement, 0, 0, W, H);
        ctx.restore();

        // la firma in basso
        const altezzaFascia = Math.round(H * 0.08);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fillRect(0, H - altezzaFascia, W, altezzaFascia);
        ctx.fillStyle = '#222222';
        ctx.font = '600 ' + Math.round(altezzaFascia * 0.42) + 'px sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText(firma, Math.round(W * 0.03), H - altezzaFascia / 2);

        foto.toBlob(function (immagine) {
            if (prova.url) URL.revokeObjectURL(prova.url);
            prova.url = URL.createObjectURL(immagine);
            fotoAnteprima.src = prova.url;
            fotoAnteprima.hidden = false;
            prova.file = new File([immagine], 'occhiali-' + occhiale.id + '.jpg', { type: 'image/jpeg' });
            prova.testo = testoCondivisione;
            linkScarica.href = prova.url;
            linkScarica.download = prova.file.name;
            condivisione.hidden = false;
            avviso.hidden = true;
            bottoneRifai.hidden = false;
            bottoneScatta.hidden = true;
        }, 'image/jpeg', 0.92);
    };

    prova.liberaOcchiali = function () {
        occhiali.matLenti.dispose();
        testa.geometry.dispose();
        testa.material.dispose();
        pmrem.dispose();
    };
}

function chiudi() {
    const prova = aperta;
    if (!prova) return;
    prova.fermata = true;
    cancelAnimationFrame(prova.raf);
    if (prova.stream) prova.stream.getTracks().forEach(function (t) { t.stop(); });   // spengo la fotocamera
    video.srcObject = null;
    if (prova.adatta) window.removeEventListener('resize', prova.adatta);
    if (prova.liberaOcchiali) prova.liberaOcchiali();
    if (prova.renderer) {
        prova.renderer.dispose();
        prova.renderer.forceContextLoss();
        prova.renderer.domElement.remove();
    }
    if (prova.url) URL.revokeObjectURL(prova.url);
    fotoAnteprima.removeAttribute('src');
    finestra.hidden = true;
    document.body.style.overflow = '';
    aperta = null;
    document.getElementById('prova-apri').focus();
}

bottoneScatta.addEventListener('click', function () {
    if (aperta && aperta.scatta) aperta.scatta();
});
bottoneRifai.addEventListener('click', function () {
    fotoAnteprima.hidden = true;
    condivisione.hidden = true;
    avviso.hidden = true;
    bottoneRifai.hidden = true;
    bottoneScatta.hidden = false;
});
bottoneChiudi.addEventListener('click', chiudi);

// ===== MANDARE LA FOTO: Instagram, WhatsApp, email =====
function scaricaFoto() {
    linkScarica.click();
}

function mostraAvviso(testo) {
    avviso.textContent = testo;
    avviso.hidden = false;
}

// il menu "Condividi" del sistema può ricevere la foto? (sì sui telefoni, quasi mai sul computer)
function puoCondividereFoto() {
    return aperta && aperta.file && navigator.canShare && navigator.canShare({ files: [aperta.file] });
}

function condividi(app) {
    if (!aperta || !aperta.file) return;
    const prova = aperta;
    if (puoCondividereFoto()) {
        navigator.share({ files: [prova.file], title: prova.testo, text: prova.testo }).catch(function (e) {
            if (e.name !== 'AbortError') console.error(e);   // AbortError = la persona ha chiuso il menu
        });
        return;
    }
    // sul computer: scarico la foto e apro l'app dove allegarla
    scaricaFoto();
    if (app === 'whatsapp') {
        window.open('https://wa.me/?text=' + encodeURIComponent(prova.testo), '_blank', 'noopener');
        mostraAvviso('Ho scaricato la foto e aperto WhatsApp: allegala al messaggio con la graffetta.');
    } else if (app === 'email') {
        window.location.href = 'mailto:?subject=' + encodeURIComponent(prova.testo) +
            '&body=' + encodeURIComponent('Ti mando la foto con i miei occhiali (è nell\'allegato).');
        mostraAvviso('Ho scaricato la foto e aperto la posta: allegala all\'email prima di mandarla.');
    } else {
        mostraAvviso('Ho scaricato la foto. Dal computer Instagram non riceve foto dal browser: caricala da instagram.com o mandala al telefono e pubblicala dall\'app.');
    }
}

condivisione.querySelectorAll('[data-app]').forEach(function (bottone) {
    bottone.addEventListener('click', function () {
        condividi(bottone.dataset.app);
    });
});
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && aperta) chiudi();
});
// clic sullo sfondo scuro: chiude
finestra.addEventListener('click', function (e) {
    if (e.target === finestra) chiudi();
});
