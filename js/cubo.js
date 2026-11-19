// cubo.js – la lampada PH5 (models/ph5.glb) dentro il visualizzatore 3D (#visore)
// Three.js viene caricato con import('three'), usando l'import map nell'head.
// Insieme a Three.js carico OrbitControls (per girare la lampada col mouse)
// e GLTFLoader (per leggere il file .glb).
// Attenzione: il file .glb si carica solo aprendo la pagina da un server locale
// (es. Live Server di VS Code), non con doppio clic su index.html.

// RoomEnvironment è una "stanza" finta che le superfici lucide riflettono.

Promise.all([
    import('three'),
    import('three/addons/controls/OrbitControls.js'),
    import('three/addons/environments/RoomEnvironment.js'),
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/postprocessing/EffectComposer.js'),
    import('three/addons/postprocessing/RenderPass.js'),
    import('three/addons/postprocessing/UnrealBloomPass.js'),
    import('three/addons/postprocessing/OutputPass.js')
]).then(function (moduli) {

    const THREE = moduli[0];
    const OrbitControls = moduli[1].OrbitControls;
    const RoomEnvironment = moduli[2].RoomEnvironment;
    const GLTFLoader = moduli[3].GLTFLoader;   // legge i file .glb (il modello della lampada)
    // per il bagliore della lampadina accesa (effetto "bloom")
    const EffectComposer = moduli[4].EffectComposer;
    const RenderPass = moduli[5].RenderPass;
    const UnrealBloomPass = moduli[6].UnrealBloomPass;
    const OutputPass = moduli[7].OutputPass;

    const visore = document.getElementById('visore');
    // tutti i bottoni della lampada li cerco solo dentro la sua sezione,
    // così non si confondono con quelli degli occhiali più in basso
    const sezione = document.getElementById('configuratore-ph5');

    // tolgo la scritta segnaposto: al suo posto arriva il 3D
    const segnaposto = visore.querySelector('.visore-segnaposto');
    if (segnaposto) segnaposto.remove();

    // scena con lo stesso colore di sfondo del visore
    const scena = new THREE.Scene();
    scena.background = new THREE.Color('#f3efe8');

    // camera
    const camera = new THREE.PerspectiveCamera(45, visore.clientWidth / visore.clientHeight, 0.1, 100);
    camera.position.set(4.2, 2.0, 4.2);   // uguale alla vista "Di lato"

    // renderer: crea il canvas e lo mette dentro il visore
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(visore.clientWidth, visore.clientHeight);
    renderer.shadowMap.enabled = true;                  // attivo le ombre
    renderer.shadowMap.type = THREE.PCFShadowMap;       // ombre con i bordi sfumati (qui "radius" funziona)
    renderer.toneMapping = THREE.ACESFilmicToneMapping; // luci e colori più naturali
    visore.appendChild(renderer.domElement);

    // ===== LUCI =====
    // Le luci seguono la vista: quando giri col mouse, la luce principale e
    // quella di riempimento girano insieme a te (vedi muoviLuci più sotto),
    // quindi cambiano le parti illuminate e l'ombra si sposta sul pavimento.

    // 1. luce d'ambiente "cielo/pavimento": dall'alto arriva luce bianca,
    //    dal basso un riflesso caldo, così le parti in ombra non sono mai nere
    const luceAmbiente = new THREE.HemisphereLight(0xffffff, 0xd9cbb5, 1.2);
    scena.add(luceAmbiente);

    // 2. luce principale (come una finestra o una lampada): è l'unica che fa l'ombra
    const lucePrincipale = new THREE.DirectionalLight(0xffffff, 2.5);
    lucePrincipale.position.set(4, 8, 3);
    lucePrincipale.castShadow = true;
    lucePrincipale.shadow.mapSize.set(2048, 2048);  // ombra più definita
    lucePrincipale.shadow.radius = 4;               // bordo dell'ombra sfumato
    lucePrincipale.shadow.bias = -0.0005;           // evita righe strane sulle superfici
    lucePrincipale.shadow.normalBias = 0.02;
    // l'ombra copre solo la zona intorno alla lampada: così ha più dettaglio
    lucePrincipale.shadow.camera.left = -4;
    lucePrincipale.shadow.camera.right = 4;
    lucePrincipale.shadow.camera.top = 4;
    lucePrincipale.shadow.camera.bottom = -4;
    lucePrincipale.shadow.camera.far = 25;
    scena.add(lucePrincipale);

    // 3. luce di riempimento dal lato opposto, più debole e senza ombra:
    //    schiarisce il lato non illuminato e fa leggere meglio la forma
    const luceRiempimento = new THREE.DirectionalLight(0xffffff, 0.6);
    luceRiempimento.position.set(-5, 3, -4);
    scena.add(luceRiempimento);

    // 4. riflessi: una stanza finta intorno all'oggetto. Su una superficie lucida
    //    si vedono i suoi riflessi, su una opaca si sente appena
    const pmrem = new THREE.PMREMGenerator(renderer);
    scena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scena.environmentIntensity = 0.35;

    // ===== BAGLIORE (bloom) =====
    // invece di disegnare la scena direttamente, la passo a un "compositore":
    // 1. RenderPass disegna la scena normale
    // 2. UnrealBloomPass fa brillare solo le parti molto luminose (la lampadina accesa
    //    e l'interno dei paralumi illuminato da lei): sopra la soglia 1 si accendono, il resto no
    // 3. OutputPass sistema colori e tone mapping come faceva il renderer
    const compositore = new EffectComposer(renderer);
    compositore.setPixelRatio(window.devicePixelRatio);
    compositore.setSize(visore.clientWidth, visore.clientHeight);
    compositore.addPass(new RenderPass(scena, camera));
    const misuraVisore = new THREE.Vector2(visore.clientWidth, visore.clientHeight);
    const bagliore = new UnrealBloomPass(misuraVisore, 0.9, 0.5, 1.0); // forza, ampiezza, soglia
    compositore.addPass(bagliore);
    compositore.addPass(new OutputPass());

    // ===== PAVIMENTO =====
    // un pavimento vero, che riceve la luce: sotto la lampada la luce calda si posa
    // in modo uniforme e diminuisce piano piano allontanandosi.
    // Verso i bordi il pavimento diventa trasparente e si confonde con lo sfondo.
    const telaBordi = document.createElement('canvas');
    telaBordi.width = telaBordi.height = 256;
    const pennelloBordi = telaBordi.getContext('2d');
    const sfumaBordi = pennelloBordi.createRadialGradient(128, 128, 0, 128, 128, 128);
    sfumaBordi.addColorStop(0,   '#ffffff');   // bianco = pavimento pieno
    sfumaBordi.addColorStop(0.5, '#ffffff');
    sfumaBordi.addColorStop(1,   '#000000');   // nero = pavimento trasparente
    pennelloBordi.fillStyle = sfumaBordi;
    pennelloBordi.fillRect(0, 0, 256, 256);

    const pavimento = new THREE.Mesh(
        new THREE.PlaneGeometry(24, 24),
        new THREE.MeshStandardMaterial({
            color: 0xc9c0b2,        // più scuro dello sfondo: illuminato diventa simile allo sfondo
            roughness: 1,
            metalness: 0,
            alphaMap: new THREE.CanvasTexture(telaBordi),
            transparent: true,
            depthWrite: false
        })
    );
    pavimento.rotation.x = -Math.PI / 2;   // il piano diventa orizzontale
    pavimento.receiveShadow = true;
    scena.add(pavimento);

    // ===== LA LAMPADA PH5 =====
    // Il modello 3D è nel file models/ph5.glb. Lo carico con GLTFLoader.
    // "oggetto" è un contenitore: dentro ci metto la lampada, e tutte le opzioni
    // (colore, finitura, grandezza) agiscono su di lui.
    const oggetto = new THREE.Group();
    scena.add(oggetto);

    // le finiture: MeshPhysicalMaterial ha anche il "clearcoat", uno strato di vernice
    // trasparente sopra il colore, quello che rende lucida una superficie
    const finiture = {
        opaco:  { roughness: 0.85, clearcoat: 0, clearcoatRoughness: 0 },    // ruvido, nessun riflesso netto
        lucido: { roughness: 0.2,  clearcoat: 1, clearcoatRoughness: 0.05 }  // liscio, con vernice lucida sopra
    };

    // qui raccolgo i materiali della lampada:
    // - tutti: ricevono la finitura
    // - materialiParti: per ogni gruppo del pannello (data-parte), i materiali che cambiano colore
    const materialiTutti = [];
    const materialiParti = { grande: [], superiore: [], inferiori: [], anello: [] };

    // a quale gruppo appartiene ogni pezzo del modello (nome del pezzo -> data-parte)
    const gruppoDelPezzo = {
        paralume_grande: 'grande',
        attacco: 'grande',
        paralume_superiore: 'superiore',
        paralume_medio: 'inferiori',
        paralume_inferiore: 'inferiori',
        anello_riflettore: 'anello'
    };

    // il colore già selezionato nel pannello per un gruppo
    function coloreIniziale(gruppo) {
        const scelto = sezione.querySelector('.campioni[data-parte="' + gruppo + '"] .campione.selected');
        return scelto ? scelto.dataset.color : null;
    }

    // finitura di partenza: quella già selezionata nel pannello
    const finituraIniziale = sezione.querySelector('.finitura.selected');

    const LARGHEZZA_LAMPADA = 2.2; // quanto è largo il paralume grande nella scena
    const CENTRO_Y = 1.5;          // a che altezza dal pavimento sta il centro della lampada (è appesa)

    // materiale del vetro della lampadina: "emissive" è la luce che emette lei stessa
    // (accesa = brilla di giallo caldo, spenta = vetro grigio chiaro)
    const materialeLampadina = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffa040,     // giallo-arancio caldo, come una lampadina a incandescenza
        emissiveIntensity: 8,   // molto forte: così il bagliore la fa brillare
        roughness: 0.3
    });

    // la luce vera della lampadina: una PointLight illumina in tutte le direzioni
    const luceLampadina = new THREE.PointLight(0xffa34d, 14, 0, 2);   // luce calda (circa 2700 K)
    luceLampadina.castShadow = true;
    luceLampadina.shadow.mapSize.set(1024, 1024);
    luceLampadina.shadow.camera.near = 0.05;  // i paralumi sono vicini alla lampadina
    luceLampadina.shadow.camera.far = 20;
    luceLampadina.shadow.radius = 8;          // bordi molto sfumati: la luce sotto è uniforme, senza strisce nette
    luceLampadina.shadow.bias = -0.0005;
    luceLampadina.shadow.normalBias = 0.02;   // evita righe e macchie sui paralumi sottili

    // il contenitore sta al centro della lampada: la camera gira intorno a questo punto
    // e lo slider della grandezza la ingrandisce restando al centro
    oggetto.position.set(0, CENTRO_Y, 0);

    new GLTFLoader().load('models/ph5.glb', function (gltf) {
        const lampada = gltf.scene;

        lampada.traverse(function (parte) {
            if (!parte.isMesh) return;

            // sostituisco il materiale del file con un MeshPhysicalMaterial
            // (stesso colore), così posso usare il clearcoat per la finitura lucida
            const vecchio = parte.material;
            const materiale = new THREE.MeshPhysicalMaterial({
                color: vecchio.color,
                map: vecchio.map,
                metalness: vecchio.metalness,
                side: vecchio.side
            });
            materiale.setValues(finiture[finituraIniziale ? finituraIniziale.dataset.finitura : 'opaco']);
            vecchio.dispose();
            parte.material = materiale;
            materialiTutti.push(materiale);

            // se il pezzo fa parte di un gruppo colorabile, prende il colore scelto
            const gruppo = gruppoDelPezzo[parte.name];
            if (gruppo) {
                const colore = coloreIniziale(gruppo);
                if (colore) materiale.color.set(colore);
                materialiParti[gruppo].push(materiale);
            }

            parte.castShadow = true;      // la lampada proietta l'ombra sul pavimento
            parte.receiveShadow = true;   // e i paralumi fanno ombra l'uno sull'altro
        });

        // porto la lampada alla grandezza giusta e la metto al centro della vista.
        // Misuro la scatola che contiene la lampada SENZA il cavo: il cavo è lungo
        // e sale verso l'alto, se lo contassi la lampada finirebbe piccola e in basso.
        lampada.updateMatrixWorld(true);
        const scatola = new THREE.Box3();
        lampada.traverse(function (parte) {
            if (parte.isMesh && parte.name !== 'cavo') scatola.expandByObject(parte);
        });
        const misure = scatola.getSize(new THREE.Vector3());
        const scala = LARGHEZZA_LAMPADA / misure.x;
        lampada.scale.setScalar(scala);

        // il centro dei paralumi va nel punto (0, 0, 0) del contenitore "oggetto"
        const centro = scatola.getCenter(new THREE.Vector3());
        lampada.position.set(-centro.x * scala, -centro.y * scala, -centro.z * scala);

        // ===== LA LAMPADINA =====
        // la metto dentro la lampada, sotto l'attacco e dentro il paralume superiore.
        // È figlia di "lampada", quindi le misure sono quelle del modello (prima della scala).
        const vetro = new THREE.Mesh(new THREE.SphereGeometry(0.035, 32, 16), materialeLampadina);
        vetro.position.set(0, 0.13, 0);
        const collo = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.04, 24), materialeLampadina);
        collo.position.set(0, 0.165, 0);
        lampada.add(vetro, collo);

        // la luce della lampadina parte dal centro del vetro e illumina tutto intorno:
        // i paralumi la schermano e fanno sul pavimento le ombre tipiche della PH5
        vetro.add(luceLampadina);

        oggetto.add(lampada);
    }, undefined, function (errore) {
        // se il file non si carica (es. pagina aperta con doppio clic invece che da un server)
        console.error('Impossibile caricare models/ph5.glb', errore);
        const avviso = document.createElement('p');
        avviso.className = 'visore-segnaposto';
        avviso.textContent = 'Non riesco a caricare il modello 3D. Apri la pagina da un server locale (es. Live Server).';
        avviso.style.position = 'absolute';
        visore.appendChild(avviso);
    });

    // controlli col mouse: trascina per girare, rotella per avvicinarti
    const controlli = new OrbitControls(camera, renderer.domElement);
    controlli.target.set(0, CENTRO_Y, 0);  // la vista gira intorno al centro della lampada
    controlli.enableDamping = true;   // il movimento rallenta in modo morbido
    controlli.enablePan = false;      // l'oggetto resta sempre al centro
    controlli.minDistance = 2.2;      // quanto ci si può avvicinare (per vedere i dettagli)
    controlli.maxDistance = 12;       // quanto ci si può allontanare
    controlli.minPolarAngle = 0.05;           // quasi sopra la lampada
    controlli.maxPolarAngle = Math.PI - 0.05; // quasi sotto la lampada: si può guardare dal basso
    // il pavimento si vede solo dall'alto: da sotto è trasparente e non copre la lampada

    // le luci girano insieme alla vista:
    // calcolo da che angolo stai guardando l'oggetto (girando intorno a lui)
    // e metto le luci sempre nella stessa posizione rispetto a te
    function muoviLuci() {
        const angolo = Math.atan2(
            camera.position.x - controlli.target.x,
            camera.position.z - controlli.target.z
        );

        // se guardi da sotto la lampada, le luci passano sotto anche loro,
        // così la parte che stai guardando è illuminata e non resta in ombra
        const dalBasso = camera.position.y < controlli.target.y;

        // luce principale: in alto (o in basso), un po' alla tua destra
        // -> l'ombra cade dietro a sinistra dell'oggetto e si sposta mentre giri
        lucePrincipale.position.set(
            Math.sin(angolo + 0.8) * 6,
            dalBasso ? -6 : 8,
            Math.cos(angolo + 0.8) * 6
        );

        // luce di riempimento: più vicina all'altezza della lampada, alla tua sinistra
        luceRiempimento.position.set(
            Math.sin(angolo - 1.4) * 6,
            dalBasso ? -1 : 3,
            Math.cos(angolo - 1.4) * 6
        );

        // da sotto il pavimento non c'è ombra da mostrare
        pavimento.visible = camera.position.y > 0;
    }

    // ===== VISTE PRONTE =====
    // posizioni della camera per i bottoni "Vista" (la camera guarda sempre il centro della lampada)
    const viste = {
        lato:  new THREE.Vector3(4.2, CENTRO_Y + 0.5, 4.2),
        alto:  new THREE.Vector3(1.2, CENTRO_Y + 5.2, 1.2),
        basso: new THREE.Vector3(1.0, CENTRO_Y - 4.7, 1.0)
    };
    let destinazione = null;   // dove sta andando la camera (null = ferma)
    const sfCamera = new THREE.Spherical();   // posizione della camera "intorno" alla lampada
    const sfMeta = new THREE.Spherical();     // posizione della vista da raggiungere

    const bottoniVista = sezione.querySelectorAll('.vista');

    // porta la camera verso una vista e seleziona il suo bottone
    function vaiAllaVista(nome) {
        destinazione = viste[nome];
        bottoniVista.forEach(function (b) {
            b.classList.toggle('selected', b.dataset.vista === nome);
        });
    }

    // se trascini col mouse, il viaggio verso la vista e il giro automatico si fermano
    controlli.addEventListener('start', function () {
        destinazione = null;
        fermaGiro();
        bottoniVista.forEach(function (b) {
            b.classList.remove('selected');
        });
    });

    bottoniVista.forEach(function (bottone) {
        bottone.addEventListener('click', function () {
            fermaGiro();   // scegliere una vista a mano ferma il giro automatico
            vaiAllaVista(bottone.dataset.vista);
        });
    });

    // ===== GIRO AUTOMATICO =====
    // alto -> lato -> basso -> alto -> ... ogni posizione dura 5 secondi
    const sequenzaGiro = ['alto', 'lato', 'basso'];
    const DURATA_POSIZIONE = 5000;   // millisecondi = 5 secondi
    const bottoneGiro = document.getElementById('giro');
    let timerGiro = null;   // null = giro fermo
    let passoGiro = 0;

    function avviaGiro() {
        passoGiro = 0;
        vaiAllaVista(sequenzaGiro[passoGiro]);    // si parte subito dall'alto
        timerGiro = setInterval(function () {
            passoGiro = (passoGiro + 1) % sequenzaGiro.length;   // dopo "basso" si torna ad "alto"
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

    // ===== AMBIENTE ACCESO / SPENTO =====
    // L'interruttore accende e spegne la luce della stanza, come in una casa vera.
    // La lampadina della PH5 resta sempre accesa e ha sempre la stessa potenza.
    // - acceso: la stanza è illuminata da una luce bianca e neutra (come quella del giorno
    //   o di un soffitto); la lampada si vede, ma la sua luce calda si nota poco
    // - spento: le luci della stanza sono a zero. Resta solo la lampadina: la sua luce calda
    //   si posa sotto la lampada e rimbalza un po' su pareti e soffitto (luce d'ambiente
    //   debole e arancione). Gli occhi si abituano al buio: l'esposizione sale un po'.
    const stati = {
        accesa: {
            sfondo: new THREE.Color('#f3efe8'),
            cielo: new THREE.Color('#ffffff'), terra: new THREE.Color('#d9cbb5'), ambiente: 0.9,
            principale: 1.8, riempimento: 0.45, coloreStanza: new THREE.Color('#fff8f0'),
            riflessi: 0.35, esposizione: 1.0, bagliore: 0.6
        },
        spenta: {
            // penombra: la stanza è scura ma si vede ancora (come di sera, con un po' di luce da fuori)
            sfondo: new THREE.Color('#4a423a'),
            cielo: new THREE.Color('#ffc999'), terra: new THREE.Color('#5a4838'), ambiente: 0.45,
            principale: 0.35, riempimento: 0.12, coloreStanza: new THREE.Color('#fff8f0'),
            riflessi: 0.1, esposizione: 1.25, bagliore: 1.0
        }
    };
    let livello = 1;    // 1 = stanza accesa, 0 = stanza spenta (i valori in mezzo servono per il passaggio)
    let obiettivo = 1;  // dove sta andando "livello"

    // mescolo i valori dei due stati in base a "livello" e li do alle luci
    function applicaLuce() {
        const a = stati.accesa;
        const s = stati.spenta;
        function mix(chiave) {
            return s[chiave] + (a[chiave] - s[chiave]) * livello;
        }
        scena.background.lerpColors(s.sfondo, a.sfondo, livello);

        // luce d'ambiente: di giorno bianca dall'alto, al buio solo il riflesso caldo della lampada
        luceAmbiente.color.lerpColors(s.cielo, a.cielo, livello);
        luceAmbiente.groundColor.lerpColors(s.terra, a.terra, livello);
        luceAmbiente.intensity = mix('ambiente');

        // le luci della stanza (finestra / soffitto): spente del tutto al buio
        lucePrincipale.color.copy(a.coloreStanza);
        luceRiempimento.color.copy(a.coloreStanza);
        lucePrincipale.intensity = mix('principale');
        luceRiempimento.intensity = mix('riempimento');

        scena.environmentIntensity = mix('riflessi');
        renderer.toneMappingExposure = mix('esposizione');

        // al buio la lampadina sembra più luminosa: il bagliore intorno si allarga
        bagliore.strength = mix('bagliore');
    }
    applicaLuce();   // all'inizio la stanza è accesa

    const bottoniLuce = sezione.querySelectorAll('.interruttore');
    bottoniLuce.forEach(function (bottone) {
        bottone.addEventListener('click', function () {
            obiettivo = bottone.dataset.luce === 'accesa' ? 1 : 0;

            bottoniLuce.forEach(function (b) {
                b.classList.remove('selected');
            });
            bottone.classList.add('selected');

            const valore = bottone.closest('.opzione').querySelector('.opzione-valore');
            valore.textContent = bottone.dataset.nome;
        });
    });

    // animazione: a ogni fotogramma aggiorno i controlli, sposto le luci e disegno la scena
    function anima() {
        // come un interruttore vero: la luce della stanza cambia in un attimo (circa 0,2 secondi)
        if (Math.abs(obiettivo - livello) > 0.001) {
            livello += (obiettivo - livello) * 0.25;
            applicaLuce();
        }

        // la camera si avvicina piano piano alla vista scelta.
        // Non va in linea retta (passerebbe dentro la lampada): gira intorno al centro,
        // cambiando a poco a poco distanza (radius), altezza (phi) e lato (theta)
        if (destinazione) {
            sfCamera.setFromVector3(camera.position.clone().sub(controlli.target));
            sfMeta.setFromVector3(destinazione.clone().sub(controlli.target));
            sfCamera.radius += (sfMeta.radius - sfCamera.radius) * 0.05;
            sfCamera.phi    += (sfMeta.phi    - sfCamera.phi)    * 0.05;
            // per il lato scelgo la strada più corta (non faccio il giro lungo intorno alla lampada)
            let diffLato = sfMeta.theta - sfCamera.theta;
            if (diffLato > Math.PI) diffLato -= 2 * Math.PI;
            if (diffLato < -Math.PI) diffLato += 2 * Math.PI;
            sfCamera.theta  += diffLato * 0.05;
            camera.position.setFromSpherical(sfCamera).add(controlli.target);
            if (camera.position.distanceTo(destinazione) < 0.01) destinazione = null;
        }
        controlli.update();
        muoviLuci();
        compositore.render();   // disegna la scena e ci aggiunge il bagliore
        requestAnimationFrame(anima);
    }
    anima();

    // se la finestra cambia misura, il 3D si adatta al visore
    window.addEventListener('resize', function () {
        camera.aspect = visore.clientWidth / visore.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(visore.clientWidth, visore.clientHeight);
        compositore.setSize(visore.clientWidth, visore.clientHeight);
    });

    // click sui campioni: solo le parti del suo gruppo prendono il colore scelto
    const campioni = sezione.querySelectorAll('.campione');

    campioni.forEach(function (campione) {
        campione.addEventListener('click', function () {
            const contenitore = campione.closest('.campioni');
            const gruppo = contenitore.dataset.parte;

            // cambia il colore delle parti di questo gruppo
            materialiParti[gruppo].forEach(function (m) {
                m.color.set(campione.dataset.color);
            });

            // sposta il bordo "selected" sul campione cliccato (solo in questo gruppo)
            contenitore.querySelectorAll('.campione').forEach(function (c) {
                c.classList.remove('selected');
            });
            campione.classList.add('selected');

            // aggiorna il nome del colore accanto a "Colore"
            const valore = campione.closest('.opzione').querySelector('.opzione-valore');
            valore.textContent = campione.dataset.nome;

            // un colore scelto a mano: la lampada non è più uno dei modelli pronti
            bottoniModello.forEach(function (b) {
                b.classList.remove('selected');
            });
            nomeModello.textContent = 'Personalizzato';
        });
    });

    // click sui modelli pronti: per ogni gruppo "clicco" il campione con il colore del modello,
    // così cambiano insieme la lampada, i bordi dei campioni e i nomi dei colori
    const bottoniModello = sezione.querySelectorAll('.modello');
    const nomeModello = document.getElementById('nome-modello');

    bottoniModello.forEach(function (bottone) {
        bottone.addEventListener('click', function () {
            sezione.querySelectorAll('.campioni[data-parte]').forEach(function (contenitore) {
                const colore = bottone.dataset[contenitore.dataset.parte];
                const campione = contenitore.querySelector('.campione[data-color="' + colore + '"]');
                if (campione) campione.click();
            });

            // dopo i click sui campioni (che tolgono la selezione) seleziono il modello
            bottone.classList.add('selected');
            nomeModello.textContent = bottone.dataset.nome;
        });
    });

    // slider della grandezza (fluido, senza scatti):
    // 0 = invisibile, 50 = grandezza normale, 100 = doppia
    const sliderFluido = document.getElementById('grandezza-fluida');
    const valoreFluido = document.getElementById('valore-fluido');

    sliderFluido.addEventListener('input', function () {
        const valore = Number(sliderFluido.value);
        oggetto.scale.setScalar(valore / 50);   // la lampada cresce intorno al suo centro: resta al centro della vista        valoreFluido.textContent = Math.round(valore);
    });

    // click sui bottoni Finitura: l'oggetto diventa opaco o lucido
    const bottoniFinitura = sezione.querySelectorAll('.finitura');

    bottoniFinitura.forEach(function (bottone) {
        bottone.addEventListener('click', function () {
            // applico al materiale i valori della finitura scelta
            materialiTutti.forEach(function (m) {
                m.setValues(finiture[bottone.dataset.finitura]);
            });

            // sposta "selected" sul bottone cliccato
            bottoniFinitura.forEach(function (b) {
                b.classList.remove('selected');
            });
            bottone.classList.add('selected');

            // aggiorna il nome della finitura accanto a "Finitura"
            const valore = bottone.closest('.opzione').querySelector('.opzione-valore');
            valore.textContent = bottone.dataset.nome;
        });
    });

});
