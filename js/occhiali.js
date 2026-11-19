// occhiali.js – gli occhiali (models/lindagarnaroli.glb) dentro il secondo visualizzatore (#visore-occhiali)
// Funziona come cubo.js (la lampada), ma con le opzioni degli occhiali:
// colore di montatura, aste e lenti, modelli pronti, finitura, viste e giro automatico.
// Anche qui il file .glb si carica solo aprendo la pagina da un server locale (es. Live Server).

Promise.all([
    import('three'),
    import('three/addons/controls/OrbitControls.js'),
    import('three/addons/environments/RoomEnvironment.js'),
    import('three/addons/loaders/GLTFLoader.js')
]).then(function (moduli) {

    const THREE = moduli[0];
    const OrbitControls = moduli[1].OrbitControls;
    const RoomEnvironment = moduli[2].RoomEnvironment;
    const GLTFLoader = moduli[3].GLTFLoader;

    const visore = document.getElementById('visore-occhiali');
    // tutti i bottoni degli occhiali li cerco solo dentro la loro sezione
    const sezione = document.getElementById('configuratore-occhiali');
    const segnaposto = visore.querySelector('.visore-segnaposto');

    // scena con lo stesso colore di sfondo del visore (lo prendo dal CSS:
    // beige in index.html, nero nella pagina di Vento, inde1.html)
    const scena = new THREE.Scene();
    scena.background = new THREE.Color(getComputedStyle(visore).backgroundColor);

    const CENTRO_Y = 1.2;   // a che altezza dal pavimento stanno gli occhiali (sospesi, con l'ombra sotto)

    // camera: si parte di tre quarti, la vista più bella per capire la forma
    const camera = new THREE.PerspectiveCamera(40, visore.clientWidth / visore.clientHeight, 0.1, 100);
    camera.position.set(3.6, CENTRO_Y + 1.6, 4.6);

    // renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(visore.clientWidth, visore.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    visore.appendChild(renderer.domElement);

    // ===== LUCI (come per la lampada: seguono la vista) =====
    const luceAmbiente = new THREE.HemisphereLight(0xffffff, 0xd9cbb5, 1.0);
    scena.add(luceAmbiente);

    const lucePrincipale = new THREE.DirectionalLight(0xfff8f0, 2.2);
    lucePrincipale.castShadow = true;
    lucePrincipale.shadow.mapSize.set(2048, 2048);
    lucePrincipale.shadow.radius = 4;
    lucePrincipale.shadow.bias = -0.0005;
    lucePrincipale.shadow.normalBias = 0.02;
    lucePrincipale.shadow.camera.left = -4;
    lucePrincipale.shadow.camera.right = 4;
    lucePrincipale.shadow.camera.top = 4;
    lucePrincipale.shadow.camera.bottom = -4;
    lucePrincipale.shadow.camera.far = 25;
    scena.add(lucePrincipale);

    const luceRiempimento = new THREE.DirectionalLight(0xfff8f0, 0.6);
    scena.add(luceRiempimento);

    // riflessi: le lenti e la finitura lucida riflettono questa stanza finta
    const pmrem = new THREE.PMREMGenerator(renderer);
    scena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scena.environmentIntensity = 0.5;

    // ===== PAVIMENTO =====
    // qui basta un piano che mostra solo l'ombra degli occhiali
    const pavimento = new THREE.Mesh(
        new THREE.PlaneGeometry(40, 40),
        new THREE.ShadowMaterial({ opacity: 0.2 })
    );
    pavimento.rotation.x = -Math.PI / 2;
    pavimento.receiveShadow = true;
    scena.add(pavimento);

    // ===== GLI OCCHIALI =====
    const oggetto = new THREE.Group();
    oggetto.position.set(0, CENTRO_Y, 0);
    scena.add(oggetto);

    const LARGHEZZA_OCCHIALI = 3;   // quanto sono larghi gli occhiali nella scena

    // Il file viene da Rhino: i pezzi non hanno un nome, quindi li riconosco dal loro numero
    // nel file. Ogni numero è un gruppo che contiene più superfici.
    // Nel file ci sono anche linee e disegni piatti (quote, testi): quelli non
    // compaiono in questa lista e li tolgo.
    // (574, 577 e 578 sono copie doppie della parte sinistra della montatura,
    //  che è già tutta dentro 573: le tolgo anche loro, altrimenti si sovrappongono)
    const pezzi = {
        573: 'montatura', 575: 'montatura', 576: 'montatura',
        569: 'aste', 570: 'aste',
        579: 'lenti', 580: 'lenti',
        571: 'cerniere', 572: 'cerniere'
    };

    // dove sono le cerniere (misure del modello, prima della scala) e quanto si chiudono le stanghette.
    // Le stanghette sono curve (occhiali avvolgenti): se si chiudessero uguali si incrocerebbero.
    // La sinistra si chiude di più e resta vicina alla montatura, la destra si appoggia dietro.
    const PERNO_Z = -0.0815;
    const lati = [
        { asta: 569, cerniera: 571, x: -0.070, chiusa: THREE.MathUtils.degToRad(-80) },   // stanghetta sinistra
        { asta: 570, cerniera: 572, x:  0.070, chiusa: THREE.MathUtils.degToRad(55) }     // stanghetta destra
    ];
    const bottoniStanghette = sezione.querySelectorAll('.stanghette');
    let stanghetteChiuse = sezione.querySelector('.stanghette.selected').dataset.stato === 'chiuse';

    const finiture = {
        opaco:  { roughness: 0.6,  clearcoat: 0, clearcoatRoughness: 0 },
        lucido: { roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.03 }   // l'acetato lucido
    };

    // i materiali di ogni parte: un materiale per parte, condiviso da tutti i suoi pezzi
    function coloreIniziale(parte) {
        const scelto = sezione.querySelector('.campioni[data-parte="' + parte + '"] .campione.selected');
        return scelto ? scelto.dataset.color : '#ffffff';
    }
    const finituraIniziale = sezione.querySelector('.finitura.selected').dataset.finitura;

    const materiali = {
        montatura: new THREE.MeshPhysicalMaterial({ color: coloreIniziale('montatura') }),
        aste: new THREE.MeshPhysicalMaterial({ color: coloreIniziale('aste') }),
        // le lenti: vetro trasparente (transmission) colorato
        lenti: new THREE.MeshPhysicalMaterial({
            color: coloreIniziale('lenti'),
            transmission: 1,      // fa passare la luce: si vede attraverso
            roughness: 0.05,
            thickness: 0.002,     // spessore del vetro
            ior: 1.5,             // come il vetro vero
            side: THREE.DoubleSide
        }),
        // le cerniere sono di metallo e non cambiano colore
        cerniere: new THREE.MeshPhysicalMaterial({ color: 0xb8bcc2, metalness: 1, roughness: 0.3 })
    };
    materiali.montatura.setValues(finiture[finituraIniziale]);
    materiali.aste.setValues(finiture[finituraIniziale]);

    new GLTFLoader().load('models/lindagarnaroli.glb', function (gltf) {
        const modello = gltf.scene;

        const trovati = {};   // i pezzi tenuti, per numero (mi servono per le stanghette)

        // guardo i pezzi principali del file (i figli diretti della scena)
        modello.children.slice().forEach(function (pezzo) {
            const info = gltf.parser.associations.get(pezzo) || {};
            const numero = info.meshes !== undefined ? info.meshes : info.nodes;
            const parte = pezzi[numero];
            trovati[numero] = pezzo;

            // linee, disegni piatti e copie doppie: li tolgo dalla scena
            if (!parte) {
                modello.remove(pezzo);
                pezzo.traverse(function (o) {
                    if (o.geometry) o.geometry.dispose();
                });
                return;
            }

            // tutte le superfici del pezzo prendono il materiale della sua parte
            pezzo.traverse(function (superficie) {
                if (!superficie.isMesh) return;
                superficie.material.dispose();
                superficie.material = materiali[parte];
                superficie.castShadow = parte !== 'lenti';   // le lenti trasparenti non fanno un'ombra piena
                superficie.receiveShadow = true;
            });
        });

        // ===== LE STANGHETTE SI APRONO E SI CHIUDONO =====
        // Ogni stanghetta va dentro un "perno": un gruppo vuoto messo proprio sulla cerniera.
        // Girando il perno intorno all'asse verticale, la stanghetta si piega come quella vera.
        // Anche i pezzetti di cerniera attaccati alla stanghetta (quelli dietro il perno) vanno nel perno.
        modello.updateMatrixWorld(true);
        lati.forEach(function (lato) {
            const perno = new THREE.Group();
            perno.position.set(lato.x, 0, PERNO_Z);
            modello.add(perno);
            perno.updateMatrixWorld(true);

            perno.attach(trovati[lato.asta]);   // attach: la stanghetta resta dov'era, ma ora gira col perno

            const pezzettiCerniera = [];
            trovati[lato.cerniera].traverse(function (superficie) {
                if (!superficie.isMesh) return;
                superficie.geometry.computeBoundingBox();
                const centroPezzetto = superficie.geometry.boundingBox.getCenter(new THREE.Vector3());
                if (centroPezzetto.z < PERNO_Z + 0.0005) pezzettiCerniera.push(superficie);
            });
            pezzettiCerniera.forEach(function (superficie) {
                perno.attach(superficie);
            });

            lato.perno = perno;
        });

        // grandezza giusta e centro degli occhiali nel punto (0, 0, 0) del contenitore
        modello.updateMatrixWorld(true);
        const scatola = new THREE.Box3().setFromObject(modello);
        const misure = scatola.getSize(new THREE.Vector3());
        const scala = LARGHEZZA_OCCHIALI / misure.x;
        modello.scale.setScalar(scala);
        const centro = scatola.getCenter(new THREE.Vector3());
        modello.position.set(-centro.x * scala, -centro.y * scala, -centro.z * scala);

        oggetto.add(modello);
        if (segnaposto) segnaposto.remove();

        // avviso la pagina che gli occhiali sono pronti: in inde1.html lo usa la prova
        // con la fotocamera (js/prova-vento.js), che ha bisogno dei pezzi e dei materiali
        document.dispatchEvent(new CustomEvent('occhiali-pronti', {
            detail: { THREE: THREE, RoomEnvironment: RoomEnvironment, oggetto: oggetto, materiali: materiali, lati: lati }
        }));
    }, function (avanzamento) {
        // il file è grande (circa 14 MB): mostro a che punto è il caricamento
        if (segnaposto && avanzamento.total) {
            segnaposto.textContent = 'Caricamento del modello 3D… ' + Math.round(avanzamento.loaded / avanzamento.total * 100) + '%';
        }
    }, function (errore) {
        console.error('Impossibile caricare models/lindagarnaroli.glb', errore);
        if (segnaposto) {
            segnaposto.textContent = 'Non riesco a caricare il modello 3D. Apri la pagina da un server locale (es. Live Server).';
        }
    });

    // il segnaposto resta sopra il 3D finché il modello non è caricato
    if (segnaposto) {
        segnaposto.style.position = 'absolute';
    }

    // ===== CONTROLLI COL MOUSE =====
    const controlli = new OrbitControls(camera, renderer.domElement);
    controlli.target.set(0, CENTRO_Y, 0);
    controlli.enableDamping = true;
    controlli.enablePan = false;
    controlli.minDistance = 2.5;
    controlli.maxDistance = 12;
    controlli.minPolarAngle = 0.05;
    controlli.maxPolarAngle = Math.PI - 0.05;   // si possono guardare anche da sotto

    // le luci girano insieme alla vista (come per la lampada)
    function muoviLuci() {
        const angolo = Math.atan2(
            camera.position.x - controlli.target.x,
            camera.position.z - controlli.target.z
        );
        const dalBasso = camera.position.y < controlli.target.y;
        lucePrincipale.position.set(Math.sin(angolo + 0.8) * 6, dalBasso ? -6 : 8, Math.cos(angolo + 0.8) * 6);
        luceRiempimento.position.set(Math.sin(angolo - 1.4) * 6, dalBasso ? -1 : 3, Math.cos(angolo - 1.4) * 6);
        pavimento.visible = camera.position.y > 0;
    }

    // ===== VISTE PRONTE =====
    const viste = {
        davanti: new THREE.Vector3(0,   CENTRO_Y + 0.4, 5.5),
        lato:    new THREE.Vector3(5.5, CENTRO_Y + 0.4, 0.3),
        alto:    new THREE.Vector3(0.3, CENTRO_Y + 5.5, 1.2)
    };

    // In inde1.html il box è largo quanto la pagina (data-adatta="larghezza"):
    // avvicino la camera perché gli occhiali riempiano circa due terzi della larghezza del box,
    // e porto alla stessa distanza anche le viste pronte.
    if (visore.dataset.adatta === 'larghezza') {
        const aspetto = visore.clientWidth / visore.clientHeight;
        const tangente = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        const larghezzaVista = LARGHEZZA_OCCHIALI / 0.65;   // gli occhiali = 65% di quello che si vede
        const distanza = Math.max(3, larghezzaVista / (2 * tangente * Math.max(aspetto, 0.6)));
        [camera.position, viste.davanti, viste.lato, viste.alto].forEach(function (punto) {
            punto.sub(controlli.target).setLength(distanza).add(controlli.target);
        });
        controlli.minDistance = distanza * 0.5;
        controlli.maxDistance = distanza * 2.5;
    }
    let destinazione = null;
    const sfCamera = new THREE.Spherical();
    const sfMeta = new THREE.Spherical();

    const bottoniVista = sezione.querySelectorAll('.vista');

    function vaiAllaVista(nome) {
        destinazione = viste[nome];
        bottoniVista.forEach(function (b) {
            b.classList.toggle('selected', b.dataset.vista === nome);
        });
    }

    controlli.addEventListener('start', function () {
        destinazione = null;
        fermaGiro();
        bottoniVista.forEach(function (b) {
            b.classList.remove('selected');
        });
    });

    bottoniVista.forEach(function (bottone) {
        bottone.addEventListener('click', function () {
            fermaGiro();
            vaiAllaVista(bottone.dataset.vista);
        });
    });

    // ===== GIRO AUTOMATICO =====
    // davanti -> lato -> alto -> davanti -> ... ogni posizione dura 5 secondi
    const sequenzaGiro = ['davanti', 'lato', 'alto'];
    const DURATA_POSIZIONE = 5000;
    const bottoneGiro = document.getElementById('giro-occhiali');
    let timerGiro = null;
    let passoGiro = 0;

    function avviaGiro() {
        passoGiro = 0;
        vaiAllaVista(sequenzaGiro[passoGiro]);
        timerGiro = setInterval(function () {
            passoGiro = (passoGiro + 1) % sequenzaGiro.length;
            vaiAllaVista(sequenzaGiro[passoGiro]);
        }, DURATA_POSIZIONE);
        bottoneGiro.classList.add('selected');
        bottoneGiro.textContent = 'Ferma giro';
    }

    function fermaGiro() {
        if (timerGiro === null) return;
        clearInterval(timerGiro);
        timerGiro = null;
        bottoneGiro.classList.remove('selected');
        bottoneGiro.textContent = 'Giro automatico';
    }

    bottoneGiro.addEventListener('click', function () {
        if (timerGiro === null) avviaGiro();
        else fermaGiro();
    });

    // ===== ANIMAZIONE =====
    function anima() {
        // la camera gira intorno agli occhiali fino alla vista scelta (non va in linea retta)
        if (destinazione) {
            sfCamera.setFromVector3(camera.position.clone().sub(controlli.target));
            sfMeta.setFromVector3(destinazione.clone().sub(controlli.target));
            sfCamera.radius += (sfMeta.radius - sfCamera.radius) * 0.05;
            sfCamera.phi    += (sfMeta.phi    - sfCamera.phi)    * 0.05;
            let diffLato = sfMeta.theta - sfCamera.theta;
            if (diffLato > Math.PI) diffLato -= 2 * Math.PI;
            if (diffLato < -Math.PI) diffLato += 2 * Math.PI;
            sfCamera.theta  += diffLato * 0.05;
            camera.position.setFromSpherical(sfCamera).add(controlli.target);
            if (camera.position.distanceTo(destinazione) < 0.01) destinazione = null;
        }
        // le stanghette girano piano piano fino a "aperte" (0°) o "chiuse"
        lati.forEach(function (lato) {
            if (!lato.perno) return;   // il modello non è ancora caricato
            const meta = stanghetteChiuse ? lato.chiusa : 0;
            lato.perno.rotation.y += (meta - lato.perno.rotation.y) * 0.08;
        });

        controlli.update();
        muoviLuci();
        renderer.render(scena, camera);
        requestAnimationFrame(anima);
    }
    anima();

    window.addEventListener('resize', function () {
        camera.aspect = visore.clientWidth / visore.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(visore.clientWidth, visore.clientHeight);
    });

    // ===== COLORI =====
    const campioni = sezione.querySelectorAll('.campione');
    const bottoniModello = sezione.querySelectorAll('.modello');
    const nomeModello = document.getElementById('nome-modello-occhiali');

    campioni.forEach(function (campione) {
        campione.addEventListener('click', function () {
            const contenitore = campione.closest('.campioni');
            materiali[contenitore.dataset.parte].color.set(campione.dataset.color);

            contenitore.querySelectorAll('.campione').forEach(function (c) {
                c.classList.remove('selected');
            });
            campione.classList.add('selected');
            campione.closest('.opzione').querySelector('.opzione-valore').textContent = campione.dataset.nome;

            // un colore scelto a mano: non è più uno dei modelli pronti
            bottoniModello.forEach(function (b) {
                b.classList.remove('selected');
            });
            nomeModello.textContent = 'Personalizzato';
        });
    });

    // modelli pronti: "clicco" il campione giusto in ogni gruppo
    bottoniModello.forEach(function (bottone) {
        bottone.addEventListener('click', function () {
            sezione.querySelectorAll('.campioni[data-parte]').forEach(function (contenitore) {
                const colore = bottone.dataset[contenitore.dataset.parte];
                const campione = contenitore.querySelector('.campione[data-color="' + colore + '"]');
                if (campione) campione.click();
            });
            bottone.classList.add('selected');
            nomeModello.textContent = bottone.dataset.nome;
        });
    });

    // ===== STANGHETTE APERTE / CHIUSE =====
    bottoniStanghette.forEach(function (bottone) {
        bottone.addEventListener('click', function () {
            stanghetteChiuse = bottone.dataset.stato === 'chiuse';

            bottoniStanghette.forEach(function (b) {
                b.classList.remove('selected');
            });
            bottone.classList.add('selected');
            bottone.closest('.opzione').querySelector('.opzione-valore').textContent = bottone.dataset.nome;
        });
    });

    // ===== FINITURA (solo montatura e aste: le lenti restano di vetro) =====
    const bottoniFinitura = sezione.querySelectorAll('.finitura');
    bottoniFinitura.forEach(function (bottone) {
        bottone.addEventListener('click', function () {
            materiali.montatura.setValues(finiture[bottone.dataset.finitura]);
            materiali.aste.setValues(finiture[bottone.dataset.finitura]);

            bottoniFinitura.forEach(function (b) {
                b.classList.remove('selected');
            });
            bottone.classList.add('selected');
            bottone.closest('.opzione').querySelector('.opzione-valore').textContent = bottone.dataset.nome;
        });
    });

});
