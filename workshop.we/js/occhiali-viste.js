// occhiali-viste.js – la row sotto il configuratore degli occhiali:
// box 1 (#visore-viste): le 4 viste degli occhiali insieme (davanti, lato, alto, prospettiva)
// box 2 (#visore-esploso): l'esploso, con i pezzi che si separano e le etichette
// Il modello models/lindagarnaroli.glb si carica una volta sola e si copia per i due box.

Promise.all([
    import('three'),
    import('three/addons/controls/OrbitControls.js'),
    import('three/addons/environments/RoomEnvironment.js'),
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/renderers/CSS2DRenderer.js')   // per le etichette in HTML sopra il 3D
]).then(function (moduli) {

    const THREE = moduli[0];
    const OrbitControls = moduli[1].OrbitControls;
    const RoomEnvironment = moduli[2].RoomEnvironment;
    const GLTFLoader = moduli[3].GLTFLoader;
    const CSS2DRenderer = moduli[4].CSS2DRenderer;
    const CSS2DObject = moduli[4].CSS2DObject;

    const sezione = document.getElementById('viste-occhiali');
    const visoreViste = document.getElementById('visore-viste');
    const visoreEsploso = document.getElementById('visore-esploso');

    const LARGHEZZA_OCCHIALI = 3;   // quanto sono larghi gli occhiali nelle scene
    // lo sfondo delle scene è quello del visore nel CSS (beige in index.html, nero nella pagina di Vento, inde1.html)
    const SFONDO = getComputedStyle(visoreViste).backgroundColor;

    // ===== I PEZZI DEGLI OCCHIALI (come in occhiali.js) =====
    // i numeri dei pezzi nel file e la parte a cui appartengono;
    // tutto il resto (linee, disegni piatti, copie doppie) lo tolgo
    const pezzi = {
        573: 'montatura', 575: 'montatura', 576: 'montatura',
        569: 'aste', 570: 'aste',
        579: 'lenti', 580: 'lenti',
        571: 'cerniere', 572: 'cerniere'
    };

    // di quanto si sposta ogni pezzo nell'esploso (misure del modello: gli occhiali sono larghi 0,147)
    // x = verso destra, y = verso l'alto, z = verso chi guarda
    const spostamenti = {
        573: [0, 0, 0],             // la montatura resta al centro
        575: [0, 0, 0],
        576: [0, 0, 0],
        579: [0, 0, 0.07],          // le lenti escono in avanti
        580: [0, 0, 0.07],
        571: [-0.035, 0, -0.02],    // le cerniere si allontanano di lato
        572: [0.035, 0, -0.02],
        569: [-0.075, 0, -0.06],    // le stanghette vanno di lato e indietro
        570: [0.075, 0, -0.06]
    };

    // le etichette dell'esploso: su quale pezzo stanno e cosa scrivono
    const etichette = {
        573: 'Montatura',
        579: 'Lente',
        571: 'Cerniera',
        569: 'Stanghetta'
    };

    // materiali: la versione "Classico" del configuratore (nero lucido, lenti trasparenti)
    const lucido = { roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.03 };
    const materiali = {
        montatura: new THREE.MeshPhysicalMaterial(Object.assign({ color: '#151515' }, lucido)),
        aste: new THREE.MeshPhysicalMaterial(Object.assign({ color: '#151515' }, lucido)),
        lenti: new THREE.MeshPhysicalMaterial({
            color: '#ffffff', transmission: 1, roughness: 0.05, thickness: 0.002, ior: 1.5,
            side: THREE.DoubleSide
        }),
        cerniere: new THREE.MeshPhysicalMaterial({ color: 0xb8bcc2, metalness: 1, roughness: 0.3 })
    };

    // ===== UNA SCENA "STUDIO" PER OGNI BOX =====
    // sfondo come il visore, luci fisse e i riflessi di una stanza finta
    function creaScena(renderer) {
        const scena = new THREE.Scene();
        scena.background = new THREE.Color(SFONDO);
        scena.add(new THREE.HemisphereLight(0xffffff, 0xd9cbb5, 1.0));
        const luce1 = new THREE.DirectionalLight(0xfff8f0, 2.0);
        luce1.position.set(4, 8, 6);
        scena.add(luce1);
        const luce2 = new THREE.DirectionalLight(0xfff8f0, 0.7);
        luce2.position.set(-6, 2, -4);
        scena.add(luce2);
        const pmrem = new THREE.PMREMGenerator(renderer);
        scena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        scena.environmentIntensity = 0.5;
        return scena;
    }

    function creaRenderer(visore) {
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(visore.clientWidth, visore.clientHeight);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        visore.appendChild(renderer.domElement);
        return renderer;
    }

    // ===== BOX 1: TUTTE LE VISTE =====
    // Un solo canvas diviso in 4 riquadri: per ogni riquadro disegno la scena con una camera diversa.
    // Le prime 3 camere sono "ortografiche": niente prospettiva, come nel disegno tecnico.
    const rendererViste = creaRenderer(visoreViste);
    rendererViste.setScissorTest(true);   // disegno solo dentro il riquadro di ogni vista
    const scenaViste = creaScena(rendererViste);

    const MEZZA_ALTEZZA = 1.85;  // quanto spazio vede ogni camera ortografica (in alto e in basso dal centro)
    function cameraTecnica(x, y, z, alto) {
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
        camera.position.set(x, y, z);
        if (alto) camera.up.set(0, 0, -1);   // vista dall'alto: il davanti degli occhiali va in basso
        camera.lookAt(0, 0, 0);
        return camera;
    }
    const cameraProspettiva = new THREE.PerspectiveCamera(35, 1, 0.1, 100);

    // l'ordine è quello della griglia: in alto a sinistra, in alto a destra, in basso a sinistra, in basso a destra
    const viste = [
        cameraTecnica(0, 0, 10),           // Davanti
        cameraTecnica(10, 0, 0),           // Di lato (da destra)
        cameraTecnica(0, 10, 0, true),     // Dall'alto
        cameraProspettiva                  // Prospettiva
    ];
    let angoloProspettiva = 0.6;

    function disegnaViste() {
        const larghezza = visoreViste.clientWidth / 2;
        const altezza = visoreViste.clientHeight / 2;
        const proporzione = larghezza / altezza;

        viste.forEach(function (camera, i) {
            const colonna = i % 2;
            const riga = Math.floor(i / 2);
            // il canvas conta i pixel dal basso: la riga in alto parte da metà altezza
            const x = colonna * larghezza;
            const y = (1 - riga) * altezza;

            if (camera.isOrthographicCamera) {
                camera.left = -MEZZA_ALTEZZA * proporzione;
                camera.right = MEZZA_ALTEZZA * proporzione;
                camera.top = MEZZA_ALTEZZA;
                camera.bottom = -MEZZA_ALTEZZA;
            } else {
                // la prospettiva gira piano intorno agli occhiali
                angoloProspettiva += 0.004;
                camera.aspect = proporzione;
                camera.position.set(Math.sin(angoloProspettiva) * 6.5, 2.4, Math.cos(angoloProspettiva) * 6.5);
                camera.lookAt(0, 0, 0);
            }
            camera.updateProjectionMatrix();

            rendererViste.setViewport(x, y, larghezza, altezza);
            rendererViste.setScissor(x, y, larghezza, altezza);
            rendererViste.render(scenaViste, camera);
        });
    }

    // ===== BOX 2: L'ESPLOSO =====
    const rendererEsploso = creaRenderer(visoreEsploso);
    const scenaEsploso = creaScena(rendererEsploso);

    // le etichette sono elementi HTML che seguono i pezzi: CSS2DRenderer le mette nel posto giusto
    const rendererEtichette = new CSS2DRenderer();
    rendererEtichette.setSize(visoreEsploso.clientWidth, visoreEsploso.clientHeight);
    rendererEtichette.domElement.style.position = 'absolute';
    rendererEtichette.domElement.style.top = '0';
    rendererEtichette.domElement.style.left = '0';
    rendererEtichette.domElement.style.pointerEvents = 'none';   // il mouse arriva al 3D sotto
    visoreEsploso.appendChild(rendererEtichette.domElement);

    const cameraEsploso = new THREE.PerspectiveCamera(35, visoreEsploso.clientWidth / visoreEsploso.clientHeight, 0.1, 100);
    cameraEsploso.position.set(6.2, 3.7, 6.2);   // posizione di partenza: quella giusta la calcola inquadraEsploso()

    const controlliEsploso = new OrbitControls(cameraEsploso, rendererEsploso.domElement);
    controlliEsploso.enableDamping = true;
    controlliEsploso.enablePan = false;
    controlliEsploso.minDistance = 3;
    controlliEsploso.maxDistance = 16;

    let separazione = 0;          // 0 = montato, 1 = esploso (i valori in mezzo per il movimento)
    let separazioneMeta = sezione.querySelector('.separa.selected').dataset.stato === 'esploso' ? 1 : 0;
    const pezziEsploso = [];      // i pezzi che si spostano
    const elementiEtichette = []; // gli elementi HTML delle etichette

    function aggiornaEsploso() {
        // muovo ogni pezzo verso la sua posizione: spostamento intero quando separazione = 1
        separazione += (separazioneMeta - separazione) * 0.06;
        pezziEsploso.forEach(function (pezzo) {
            const s = spostamenti[pezzo.userData.numero];
            pezzo.position.set(s[0] * separazione, s[1] * separazione, s[2] * separazione);
        });
        // le etichette compaiono solo quando i pezzi sono separati
        elementiEtichette.forEach(function (elemento) {
            elemento.style.opacity = Math.max(0, separazione * 1.4 - 0.4);
        });
    }

    // ===== INQUADRATURA DELL'ESPLOSO =====
    // Con i pezzi separati gli occhiali occupano molto più spazio: calcolo io a che distanza
    // mettere la camera perché TUTTI i pezzi esplosi stiano dentro il box.
    const DIREZIONE_3_4 = new THREE.Vector3(1, 0.6, 1).normalize();   // 3/4: a 45° tra davanti e lato, un po' dall'alto
    const MARGINE = 0.9;           // uso solo il 90% del box: resta un po' di spazio intorno
    let angoliEsploso = [];        // i punti delle superfici di tutti i pezzi, quando sono esplosi
    const centroEsploso = new THREE.Vector3();

    // metto per un momento i pezzi nella posizione "esploso" e misuro dove finiscono
    function misuraEsploso() {
        pezziEsploso.forEach(function (pezzo) {
            const s = spostamenti[pezzo.userData.numero];
            pezzo.position.set(s[0], s[1], s[2]);
        });
        scenaEsploso.updateMatrixWorld(true);

        // prendo i punti veri delle superfici (uno ogni 8: bastano e il calcolo resta veloce).
        // Le scatole dei pezzi non vanno bene: le stanghette sono curve e in diagonale,
        // e la loro scatola ha angoli vuoti lontanissimi dal pezzo vero.
        const tutto = new THREE.Box3();
        angoliEsploso = [];
        pezziEsploso.forEach(function (pezzo) {
            pezzo.traverse(function (superficie) {
                if (!superficie.isMesh) return;
                const posizioni = superficie.geometry.attributes.position;
                for (let i = 0; i < posizioni.count; i += 8) {
                    const punto = new THREE.Vector3().fromBufferAttribute(posizioni, i).applyMatrix4(superficie.matrixWorld);
                    angoliEsploso.push(punto);
                    tutto.expandByPoint(punto);
                }
            });
        });
        tutto.getCenter(centroEsploso);

        // rimetto i pezzi dov'erano (l'animazione continua da lì)
        pezziEsploso.forEach(function (pezzo) {
            const s = spostamenti[pezzo.userData.numero];
            pezzo.position.set(s[0] * separazione, s[1] * separazione, s[2] * separazione);
        });
    }

    // cerco la distanza più piccola a cui tutti gli angoli entrano nel box, in larghezza e in altezza
    function inquadraEsploso() {
        if (angoliEsploso.length === 0) return;
        const tanV = Math.tan(THREE.MathUtils.degToRad(cameraEsploso.fov) / 2) * MARGINE;
        const tanH = tanV * cameraEsploso.aspect;

        // le tre direzioni della camera: avanti (verso gli occhiali), destra e su
        const avanti = DIREZIONE_3_4.clone().negate();
        const destra = new THREE.Vector3().crossVectors(avanti, new THREE.Vector3(0, 1, 0)).normalize();
        const su = new THREE.Vector3().crossVectors(destra, avanti);

        // il punto da guardare: il centro di come i pezzi si vedono di 3/4
        // (non il centro della scatola 3D, che di 3/4 appare spostato da un lato)
        const centro = centroEsploso.clone();
        let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
        angoliEsploso.forEach(function (angolo) {
            const v = angolo.clone().sub(centro);
            xMin = Math.min(xMin, v.dot(destra)); xMax = Math.max(xMax, v.dot(destra));
            yMin = Math.min(yMin, v.dot(su));     yMax = Math.max(yMax, v.dot(su));
        });
        centro.addScaledVector(destra, (xMin + xMax) / 2).addScaledVector(su, (yMin + yMax) / 2);

        let distanza = 0;
        angoliEsploso.forEach(function (angolo) {
            const v = angolo.clone().sub(centro);
            const x = Math.abs(v.dot(destra));
            const y = Math.abs(v.dot(su));
            const versoCamera = v.dot(DIREZIONE_3_4);   // i punti più vicini alla camera hanno bisogno di più spazio
            distanza = Math.max(distanza, versoCamera + x / tanH, versoCamera + y / tanV);
        });

        controlliEsploso.target.copy(centro);
        cameraEsploso.position.copy(centro).addScaledVector(DIREZIONE_3_4, distanza);
        controlliEsploso.maxDistance = Math.max(16, distanza * 1.5);
        controlliEsploso.update();
    }

    sezione.querySelectorAll('.separa').forEach(function (bottone, i, tutti) {
        bottone.addEventListener('click', function () {
            separazioneMeta = bottone.dataset.stato === 'esploso' ? 1 : 0;
            tutti.forEach(function (b) {
                b.classList.remove('selected');
            });
            bottone.classList.add('selected');
        });
    });

    // ===== CARICO IL MODELLO UNA VOLTA E LO METTO NEI DUE BOX =====
    function togliSegnaposti(testo) {
        [visoreViste, visoreEsploso].forEach(function (visore) {
            const segnaposto = visore.querySelector('.visore-segnaposto');
            if (!segnaposto) return;
            if (testo) {
                segnaposto.textContent = testo;
                segnaposto.style.position = 'absolute';
            } else {
                segnaposto.remove();
            }
        });
    }

    new GLTFLoader().load('models/lindagarnaroli.glb', function (gltf) {
        const modello = gltf.scene;

        modello.children.slice().forEach(function (pezzo) {
            const info = gltf.parser.associations.get(pezzo) || {};
            const numero = info.meshes !== undefined ? info.meshes : info.nodes;
            const parte = pezzi[numero];
            if (!parte) {
                modello.remove(pezzo);
                pezzo.traverse(function (o) {
                    if (o.geometry) o.geometry.dispose();
                });
                return;
            }
            pezzo.userData.numero = numero;   // mi serve per l'esploso (la copia se lo porta dietro)
            pezzo.traverse(function (superficie) {
                if (!superficie.isMesh) return;
                superficie.material.dispose();
                superficie.material = materiali[parte];
            });
        });

        // grandezza giusta e centro degli occhiali nel punto (0, 0, 0)
        modello.updateMatrixWorld(true);
        const scatola = new THREE.Box3().setFromObject(modello);
        const scala = LARGHEZZA_OCCHIALI / scatola.getSize(new THREE.Vector3()).x;
        const centro = scatola.getCenter(new THREE.Vector3());

        function contenitore(copia) {
            const gruppo = new THREE.Group();
            copia.scale.setScalar(scala);
            copia.position.set(-centro.x * scala, -centro.y * scala, -centro.z * scala);
            gruppo.add(copia);
            return gruppo;
        }

        // box 1: il modello così com'è
        scenaViste.add(contenitore(modello));

        // box 2: una copia (stesse forme e materiali, ma posizioni dei pezzi indipendenti)
        const copiaEsploso = modello.clone();
        scenaEsploso.add(contenitore(copiaEsploso));
        scenaEsploso.updateMatrixWorld(true);   // posizioni aggiornate, per mettere le etichette al centro dei pezzi

        copiaEsploso.children.forEach(function (pezzo) {
            pezziEsploso.push(pezzo);

            const testo = etichette[pezzo.userData.numero];
            if (!testo) return;
            // l'etichetta sta al centro del pezzo e si muove con lui
            const elemento = document.createElement('div');
            elemento.className = 'etichetta-esploso';
            elemento.textContent = testo;
            elemento.style.opacity = 0;
            const etichetta = new CSS2DObject(elemento);
            new THREE.Box3().setFromObject(pezzo).getCenter(etichetta.position);
            etichetta.position.applyMatrix4(new THREE.Matrix4().copy(pezzo.matrixWorld).invert());
            pezzo.add(etichetta);
            elementiEtichette.push(elemento);
        });

        misuraEsploso();
        inquadraEsploso();
        togliSegnaposti();
    }, function (avanzamento) {
        if (avanzamento.total) {
            const percento = Math.round(avanzamento.loaded / avanzamento.total * 100);
            [visoreViste, visoreEsploso].forEach(function (visore) {
                const segnaposto = visore.querySelector('.visore-segnaposto');
                if (segnaposto) segnaposto.textContent = 'Caricamento del modello 3D… ' + percento + '%';
            });
        }
    }, function (errore) {
        console.error('Impossibile caricare models/lindagarnaroli.glb', errore);
        togliSegnaposti('Non riesco a caricare il modello 3D. Apri la pagina da un server locale (es. Live Server).');
    });

    // il segnaposto resta sopra il 3D finché il modello non è caricato
    [visoreViste, visoreEsploso].forEach(function (visore) {
        const segnaposto = visore.querySelector('.visore-segnaposto');
        if (segnaposto) segnaposto.style.position = 'absolute';
    });

    // ===== ANIMAZIONE DEI DUE BOX =====
    function anima() {
        disegnaViste();

        aggiornaEsploso();
        controlliEsploso.update();
        rendererEsploso.render(scenaEsploso, cameraEsploso);
        rendererEtichette.render(scenaEsploso, cameraEsploso);

        requestAnimationFrame(anima);
    }
    anima();

    window.addEventListener('resize', function () {
        rendererViste.setSize(visoreViste.clientWidth, visoreViste.clientHeight);
        rendererEsploso.setSize(visoreEsploso.clientWidth, visoreEsploso.clientHeight);
        rendererEtichette.setSize(visoreEsploso.clientWidth, visoreEsploso.clientHeight);
        cameraEsploso.aspect = visoreEsploso.clientWidth / visoreEsploso.clientHeight;
        cameraEsploso.updateProjectionMatrix();
        inquadraEsploso();   // con il box di un'altra misura ricalcolo la distanza
    });

});
