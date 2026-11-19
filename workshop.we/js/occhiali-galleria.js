// occhiali-galleria.js – gli occhiali della collezione in 3D (cartella modelli_occhiali_glbxweb).
// L'elenco degli occhiali e le impostazioni di ogni modello sono in js/collezione.js.
// Lo usano due pagine:
//   index.html     la griglia con tutti gli occhiali, che ruotano da soli. Ogni box è un link:
//                  cliccandolo si apre occhiale.html con quel modello (trascinandolo invece si gira)
//   occhiale.html  una sola pagina per tutti gli occhiali: legge dall'indirizzo quale mostrare
//                  (es. occhiale.html?modello=sprint) e si riempie con i suoi dati. Qui si possono
//                  cambiare i colori di montatura e lenti, aprire e chiudere le stanghette,
//                  vederlo esploso e da davanti, di lato, dall'alto e dal basso.
//
// Un solo canvas WebGL disegna dentro tutti i box: il browser regge solo una quindicina
// di visori 3D per pagina, e la pagina ne ha già altri. Ogni box ha la sua scena e la sua camera.
// Ogni modello si carica quando il suo box sta per comparire sullo schermo.
// Come per gli altri visori, la pagina va aperta da un server locale (es. Live Server).
//
// L'esploso funziona per tutti i modelli: le lenti vanno in avanti, le stanghette si staccano
// ai lati e i pezzi piccoli del frontale (naselli, viti, cerniere) si spostano verso l'esterno.

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

    const CARTELLA = 'modelli_occhiali_glbxweb/';
    const CENTRO_Y = 1.2;            // gli occhiali sono sospesi, con l'ombra sotto
    const LARGHEZZA_OCCHIALI = 3;    // tutti i modelli vengono portati a questa larghezza
    const SFONDO = new THREE.Color('#f3efe8');
    // quanto si vedono le lenti: 0 = invisibili, 1 = piene (non si vede attraverso)
    const OPACITA_LENTI = 0.45;

    // in quale pagina sono? (occhiale.html ha #pagina-occhiale, index.html ha #galleria-occhiali)
    const paginaOcchiale = document.getElementById('pagina-occhiale');
    const sezione = paginaOcchiale || document.getElementById('galleria-occhiali');
    const griglia = document.getElementById('griglia-galleria');

    // ===== UN SOLO RENDERER PER TUTTI I BOX =====
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);   // fuori dai box il canvas è trasparente
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    griglia.appendChild(renderer.domElement);

    // riflessi per i materiali lucidi e le lenti (uno solo, per tutte le scene)
    const pmrem = new THREE.PMREMGenerator(renderer);
    const ambiente = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const viste = {
        davanti: new THREE.Vector3(0,    CENTRO_Y + 0.3, 6),
        lato:    new THREE.Vector3(6,    CENTRO_Y + 0.3, 0.2),
        alto:    new THREE.Vector3(0.05, CENTRO_Y + 6,   0.6),
        basso:   new THREE.Vector3(0.05, CENTRO_Y - 6,   0.6)
    };

    // ===== UN BOX: scena, camera, luci e controlli suoi =====
    function creaBox(elemento, occhiale) {
        // i materiali per cambiare colore: ogni box ha i suoi.
        // Quando si sceglie "Originale" ogni pezzo riprende il materiale del suo file.
        const matMontatura = new THREE.MeshPhysicalMaterial({
            color: '#151515', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05,
            side: THREE.DoubleSide
        });
        const matLenti = new THREE.MeshPhysicalMaterial({
            color: '#ffffff',
            transparent: true,
            opacity: OPACITA_LENTI,   // un po' trasparenti: si vede attraverso, ma col colore
            roughness: 0.05,
            clearcoat: 1,
            side: THREE.DoubleSide,
            depthWrite: false         // le lenti non nascondono quello che c'è dietro
        });

        const scena = new THREE.Scene();
        scena.background = SFONDO;
        scena.environment = ambiente;
        scena.environmentIntensity = 0.5;

        const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
        camera.position.set(3.6, CENTRO_Y + 1.6, 4.6);

        scena.add(new THREE.HemisphereLight(0xffffff, 0xd9cbb5, 1.0));
        const lucePrincipale = new THREE.DirectionalLight(0xfff8f0, 2.2);
        scena.add(lucePrincipale);
        const luceRiempimento = new THREE.DirectionalLight(0xfff8f0, 0.6);
        scena.add(luceRiempimento);

        const oggetto = new THREE.Group();
        oggetto.position.set(0, CENTRO_Y, 0);
        scena.add(oggetto);

        // i controlli ascoltano il mouse sul box (il canvas sopra lascia passare il mouse)
        const controlli = new OrbitControls(camera, elemento);
        controlli.target.set(0, CENTRO_Y, 0);
        controlli.enableDamping = true;
        controlli.enablePan = false;
        // nella griglia la rotella resta per scorrere la pagina; nella pagina dell'occhiale fa zoom
        controlli.enableZoom = !!paginaOcchiale;
        controlli.minDistance = 2.5;
        controlli.maxDistance = 12;
        controlli.minPolarAngle = 0.02;
        controlli.maxPolarAngle = Math.PI - 0.02;
        controlli.autoRotate = true;
        controlli.autoRotateSpeed = 1.5;
        // OrbitControls blocca lo scorrimento col dito: lo riattivo in verticale,
        // così sul telefono la pagina si scorre e col dito in orizzontale si girano gli occhiali
        elemento.style.touchAction = 'pan-y';

        const box = {
            elemento: elemento,
            dataset: occhiale,      // le impostazioni del modello (da js/collezione.js)
            segnaposto: elemento.querySelector('.visore-segnaposto'),
            scena: scena, camera: camera, controlli: controlli,
            lucePrincipale: lucePrincipale, luceRiempimento: luceRiempimento,
            oggetto: oggetto,
            matMontatura: matMontatura, matLenti: matLenti,
            // le scelte del pannello per questi occhiali
            stato: { montatura: 'originale', lenti: 'originale', chiuse: false, esploso: false, vista: 'giro' },
            modello: null,          // pezzi, stanghette, quanto è piegato ed esploso
            destinazione: null,
            ripresa: null           // timer per ricominciare a ruotare dopo un trascinamento
        };

        // trascinando si ferma solo questo box; dopo 3 secondi riprende a ruotare
        controlli.addEventListener('start', function () {
            controlli.autoRotate = false;
            box.destinazione = null;
            clearTimeout(box.ripresa);
        });
        // nella griglia ogni box è un link: un clic apre la pagina dell'occhiale,
        // ma se il mouse si è mosso (stavo girando gli occhiali) il link non si apre
        if (!paginaOcchiale) {
            let inizio = null;
            elemento.addEventListener('pointerdown', function (e) {
                inizio = { x: e.clientX, y: e.clientY };
            });
            elemento.addEventListener('click', function (e) {
                if (inizio && Math.hypot(e.clientX - inizio.x, e.clientY - inizio.y) > 6) e.preventDefault();
            });
        }
        controlli.addEventListener('end', function () {
            clearTimeout(box.ripresa);
            box.ripresa = setTimeout(function () {
                if (box.stato.vista === 'giro') controlli.autoRotate = true;
            }, 3000);
        });
        return box;
    }

    // l'elemento HTML di un box: nella griglia è un link alla pagina dell'occhiale
    function creaElemento(occhiale, link) {
        const elemento = document.createElement(link ? 'a' : 'div');
        elemento.className = 'visore visore-galleria';
        if (link) {
            elemento.href = 'occhiale.html?modello=' + encodeURIComponent(occhiale.id);
            elemento.draggable = false;   // trascinando si girano gli occhiali, non si sposta il link
            elemento.setAttribute('aria-label', 'Apri gli occhiali ' + occhiale.nome);
            const nome = document.createElement('span');
            nome.className = 'nome-box';
            nome.textContent = occhiale.nome;
            elemento.appendChild(nome);
        }
        const segnaposto = document.createElement('p');
        segnaposto.className = 'visore-segnaposto';
        segnaposto.textContent = 'Caricamento…';
        elemento.appendChild(segnaposto);
        griglia.appendChild(elemento);
        return elemento;
    }

    // la pagina dell'occhiale si riempie con i dati del modello scelto
    function riempiPagina(indice) {
        const occhiale = COLLEZIONE[indice];
        document.title = occhiale.nome + ' – La collezione – Triennale Milano';
        document.getElementById('occhiale-nome').textContent = occhiale.nome;
        document.getElementById('occhiale-descrizione').textContent = occhiale.descrizione;
        document.getElementById('occhiale-autori').textContent = occhiale.autori;
        document.getElementById('occhiale-stanghette').textContent =
            occhiale.stanghette === 'no' ? 'No, ha l\'elastico' : 'Sì, si aprono e si chiudono';

        // precedente e successivo (dopo l'ultimo si ricomincia dal primo)
        const precedente = COLLEZIONE[(indice - 1 + COLLEZIONE.length) % COLLEZIONE.length];
        const successivo = COLLEZIONE[(indice + 1) % COLLEZIONE.length];
        const linkPrecedente = document.getElementById('occhiale-precedente');
        const linkSuccessivo = document.getElementById('occhiale-successivo');
        linkPrecedente.href = 'occhiale.html?modello=' + encodeURIComponent(precedente.id);
        linkPrecedente.textContent = '← ' + precedente.nome;
        linkSuccessivo.href = 'occhiale.html?modello=' + encodeURIComponent(successivo.id);
        linkSuccessivo.textContent = successivo.nome + ' →';
    }

    let boxes;
    if (paginaOcchiale) {
        // occhiale.html?modello=sprint -> cerco "sprint" nella collezione
        const id = new URLSearchParams(window.location.search).get('modello');
        const indice = COLLEZIONE.findIndex(function (o) { return o.id === id; });
        if (indice === -1) {
            document.getElementById('occhiale-nome').textContent = 'Occhiali non trovati';
            document.getElementById('occhiale-contenuto').hidden = true;
            document.getElementById('occhiale-non-trovato').hidden = false;
            return;
        }
        riempiPagina(indice);
        boxes = [creaBox(creaElemento(COLLEZIONE[indice], false), COLLEZIONE[indice])];
    } else {
        boxes = COLLEZIONE.map(function (occhiale) {
            return creaBox(creaElemento(occhiale, true), occhiale);
        });
    }

    // copia di un attributo (posizioni o normali) in numeri decimali normali:
    // alcuni file salvano i punti "compressi" e non si potrebbero muovere liberamente
    function inDecimali(attributo) {
        const n = attributo.count;
        const k = attributo.itemSize;   // 3 per posizioni e normali, 2 per le coordinate delle texture
        const a = new Float32Array(n * k);
        for (let i = 0; i < n; i++) {
            a[i * k] = attributo.getX(i);
            a[i * k + 1] = attributo.getY(i);
            if (k > 2) a[i * k + 2] = attributo.getZ(i);
        }
        return new THREE.BufferAttribute(a, k);
    }

    // il pezzo (o uno dei gruppi che lo contengono, o il suo materiale) ha questo nome?
    function haNome(oggetto3d, parola) {
        parola = parola.toLowerCase();
        if (oggetto3d.material && (oggetto3d.material.name || '').toLowerCase().includes(parola)) return true;
        for (let o = oggetto3d; o; o = o.parent) {
            if ((o.name || '').toLowerCase().includes(parola)) return true;
        }
        return false;
    }

    // il pezzo è una lente? dipende dalla regola scritta in data-lenti
    function eLente(pezzo, regola, parser) {
        if (!regola) return false;
        const tipo = regola.split(':')[0];
        const valore = regola.split(':')[1];
        if (tipo === 'nome') return haNome(pezzo, valore);
        if (tipo === 'materiale') {
            const info = parser.associations.get(pezzo.material) || {};
            return String(info.materials) === valore;
        }
        if (tipo === 'nodi') {
            const numeri = valore.split(',');
            for (let o = pezzo; o; o = o.parent) {
                const info = parser.associations.get(o) || {};
                if (info.nodes !== undefined && numeri.includes(String(info.nodes))) return true;
            }
        }
        return false;
    }

    // ===== LE CERNIERE =====
    // Visti di lato, il frontale degli occhiali è alto (ci sono le lenti) e le stanghette sono basse.
    // Vado da davanti verso dietro a fette sottili: dove i lati diventano bassi, lì c'è la cerniera.
    function trovaCerniera(geometrie, zMax, zMin) {
        const passo = 0.05;
        const fette = Math.ceil((zMax - zMin) / passo) + 1;
        const yMin = new Float32Array(fette).fill(Infinity);
        const yMax = new Float32Array(fette).fill(-Infinity);
        geometrie.forEach(function (g) {
            const p = g.attributes.position.array;
            for (let i = 0; i < p.length; i += 3) {
                if (Math.abs(p[i]) < 0.45) continue;   // solo i lati, non il ponte sul naso
                const f = Math.floor((zMax - p[i + 2]) / passo);
                if (p[i + 1] < yMin[f]) yMin[f] = p[i + 1];
                if (p[i + 1] > yMax[f]) yMax[f] = p[i + 1];
            }
        });
        const altezze = [];
        let piuAlta = 0;
        for (let f = 0; f < fette; f++) {
            altezze[f] = yMax[f] > yMin[f] ? yMax[f] - yMin[f] : 0;
            if (altezze[f] > altezze[piuAlta]) piuAlta = f;
        }
        let zCerniera = zMax - (piuAlta + 1) * passo;
        for (let f = piuAlta; f < fette; f++) {
            if (altezze[f] < 0.45 * altezze[piuAlta]) break;
            zCerniera = zMax - (f + 1) * passo;
        }
        return zCerniera;
    }

    // prepara le stanghette: tutti i punti dietro la cerniera, a sinistra e a destra,
    // gireranno intorno al perno del loro lato
    function preparaStanghette(pezzi, zCerniera) {
        // Taglio i pezzi alla cerniera. Se un pezzo è in parte frontale e in parte stanghetta,
        // i suoi triangoli non devono condividere i punti: altrimenti, muovendo la stanghetta,
        // i triangoli sul taglio si stirerebbero e la stanghetta sembrerebbe allungarsi.
        // Ogni triangolo va tutto con la stanghetta (se il suo centro è dietro la cerniera) o tutto col frontale.
        pezzi.forEach(function (pezzo) {
            const p = pezzo.geometry.attributes.position.array;
            let davanti = false, dietro = false;
            for (let i = 2; i < p.length; i += 3) {
                if (p[i] < zCerniera) dietro = true; else davanti = true;
            }
            if (davanti && dietro && pezzo.geometry.index) {
                const staccato = pezzo.geometry.toNonIndexed();   // ogni triangolo con i suoi tre punti
                pezzo.geometry.dispose();
                pezzo.geometry = staccato;
            }
        });

        // il perno di ogni lato: il punto più esterno vicino alla cerniera
        let xSinistra = -1.5, xDestra = 1.5, trovatoS = false, trovatoD = false;
        pezzi.forEach(function (pezzo) {
            const p = pezzo.geometry.attributes.position.array;
            for (let i = 0; i < p.length; i += 3) {
                if (Math.abs(p[i + 2] - zCerniera) > 0.1) continue;
                if (p[i] < 0 && (!trovatoS || p[i] < xSinistra)) { xSinistra = p[i]; trovatoS = true; }
                if (p[i] >= 0 && (!trovatoD || p[i] > xDestra)) { xDestra = p[i]; trovatoD = true; }
            }
        });

        // i punti che si muovono: quelli dei triangoli dietro la cerniera
        const punti = [];
        pezzi.forEach(function (pezzo) {
            const g = pezzo.geometry;
            const p = g.attributes.position.array;
            const n = g.attributes.normal.array;
            const indici = [];   // posizione del punto nell'array (già moltiplicata per 3)
            const lati = [];     // -1 = stanghetta sinistra, 1 = destra
            if (g.index) {
                // pezzo indicizzato: qui è tutto da una parte sola, quindi basta guardare i punti
                for (let i = 0; i < p.length; i += 3) {
                    if (p[i + 2] < zCerniera) { indici.push(i); lati.push(p[i] < 0 ? -1 : 1); }
                }
            } else {
                // un triangolo ogni tre punti: decido col centro del triangolo
                for (let t = 0; t < p.length; t += 9) {
                    const zc = (p[t + 2] + p[t + 5] + p[t + 8]) / 3;
                    if (zc >= zCerniera) continue;
                    const lato = (p[t] + p[t + 3] + p[t + 6]) < 0 ? -1 : 1;
                    indici.push(t, t + 3, t + 6);
                    lati.push(lato, lato, lato);
                }
            }
            if (!indici.length) return;
            const quanti = indici.length;
            const dati = {
                geometria: g,
                indici: Int32Array.from(indici),
                lati: Int8Array.from(lati),
                x: new Float32Array(quanti), z: new Float32Array(quanti),
                nx: new Float32Array(quanti), nz: new Float32Array(quanti)
            };
            indici.forEach(function (i, k) {
                dati.x[k] = p[i]; dati.z[k] = p[i + 2];
                dati.nx[k] = n[i]; dati.nz[k] = n[i + 2];
            });
            punti.push(dati);
        });
        return { punti: punti, z: zCerniera, xSinistra: xSinistra, xDestra: xDestra };
    }

    // quanto sono chiuse le stanghette: 0 = aperte, 1 = chiuse.
    // La sinistra si chiude un po' di più, così le due stanghette non si incrociano del tutto.
    const CHIUSA_SINISTRA = THREE.MathUtils.degToRad(-85);
    const CHIUSA_DESTRA = THREE.MathUtils.degToRad(78);

    // di quanto si allontanano le stanghette nell'esploso (verso l'esterno e un po' indietro)
    const ESPLOSO_STANGHETTE_X = 0.9;
    const ESPLOSO_STANGHETTE_Z = -0.4;

    // quanto: 0 = aperte, 1 = chiuse; esploso: 0 = montate, 1 = separate dal frontale
    function piegaStanghette(stanghette, quanto, esploso) {
        const aS = CHIUSA_SINISTRA * quanto, aD = CHIUSA_DESTRA * quanto;
        const cS = Math.cos(aS), sS = Math.sin(aS), cD = Math.cos(aD), sD = Math.sin(aD);
        const zc = stanghette.z;
        stanghette.punti.forEach(function (d) {
            const p = d.geometria.attributes.position.array;
            const n = d.geometria.attributes.normal.array;
            for (let k = 0; k < d.indici.length; k++) {
                const i = d.indici[k];
                const sinistra = d.lati[k] < 0;
                const c = sinistra ? cS : cD, s = sinistra ? sS : sD;
                const perno = sinistra ? stanghette.xSinistra : stanghette.xDestra;
                const x = d.x[k] - perno, z = d.z[k] - zc;
                p[i] = x * c + z * s + perno + (sinistra ? -1 : 1) * ESPLOSO_STANGHETTE_X * esploso;
                p[i + 2] = -x * s + z * c + zc + ESPLOSO_STANGHETTE_Z * esploso;
                n[i] = d.nx[k] * c + d.nz[k] * s;
                n[i + 2] = -d.nx[k] * s + d.nz[k] * c;
            }
            d.geometria.attributes.position.needsUpdate = true;
            d.geometria.attributes.normal.needsUpdate = true;
        });
    }

    // ===== CARICAMENTO DI UN BOX =====
    const caricatore = new GLTFLoader();

    function mostraMessaggio(box, testo) {
        box.segnaposto.textContent = testo;
        box.segnaposto.style.display = testo ? '' : 'none';
    }

    function carica(box) {
        const file = box.dataset.file;
        caricatore.load(CARTELLA + encodeURIComponent(file), function (gltf) {
            box.modello = preparaPezzi(gltf, box);
            box.modello.pezzi.forEach(function (pezzo) { box.oggetto.add(pezzo); });
            applicaColori(box);
            mostraMessaggio(box, '');
            if (box === selezionato) aggiornaPannello();   // ora so se ha le stanghette
        }, function (avanzamento) {
            if (avanzamento.total) {
                mostraMessaggio(box, 'Caricamento… ' + Math.round(avanzamento.loaded / avanzamento.total * 100) + '%');
            }
        }, function (errore) {
            console.error('Impossibile caricare ' + CARTELLA + file, errore);
            mostraMessaggio(box, 'Non riesco a caricare il modello. Apri la pagina da un server locale (es. Live Server).');
        });
    }

    // ogni modello si carica quando il suo box sta per comparire (anche sotto, appena fuori schermo)
    const osservaCaricamento = new IntersectionObserver(function (voci) {
        voci.forEach(function (voce) {
            if (!voce.isIntersecting) return;
            const box = boxes.find(function (b) { return b.elemento === voce.target; });
            osservaCaricamento.unobserve(voce.target);
            carica(box);
        });
    }, { rootMargin: '300px' });
    boxes.forEach(function (box) { osservaCaricamento.observe(box.elemento); });

    // dal file prendo le superfici e preparo stanghette ed esploso
    function preparaPezzi(gltf, box) {
        const modello = gltf.scene;
        const togli = box.dataset.togli;

        // il modello va girato? (alcuni file sono capovolti o guardano all'indietro)
        const giro = new THREE.Matrix4();
        if (box.dataset.ruota === 'z180') giro.makeRotationZ(Math.PI);
        if (box.dataset.ruota === 'y180') giro.makeRotationY(Math.PI);

        // Ogni superficie diventa un pezzo nuovo, già messo al suo posto nello spazio.
        // Così posso muovere i punti delle stanghette direttamente, in qualunque file.
        // Linee e punti (quote e disegni di Rhino) non sono Mesh e restano fuori.
        modello.updateMatrixWorld(true);
        const pezzi = [];
        const matrice = new THREE.Matrix4();
        const lentiTrasparenti = new Map();   // materiale originale -> la sua copia trasparente
        modello.traverse(function (o) {
            if (!o.isMesh) return;
            // i pezzi da togliere, separati da virgole (es. la faccia e lo schermo)
            if (togli && togli.split(',').some(function (parola) { return haNome(o, parola.trim()); })) return;

            const g = new THREE.BufferGeometry();
            g.setAttribute('position', inDecimali(o.geometry.attributes.position));
            if (o.geometry.attributes.normal) g.setAttribute('normal', inDecimali(o.geometry.attributes.normal));
            if (o.geometry.attributes.uv) g.setAttribute('uv', inDecimali(o.geometry.attributes.uv));
            if (o.geometry.index) g.setIndex(o.geometry.index);
            g.applyMatrix4(matrice.multiplyMatrices(giro, o.matrixWorld));
            if (!g.attributes.normal) g.computeVertexNormals();

            const lente = eLente(o, box.dataset.lenti, gltf.parser);
            // le lenti con il colore originale del file: stesso colore, ma un po' trasparenti
            // (in molti file le lenti sono di plastica piena e non si vedrebbe attraverso)
            let materiale = o.material;
            if (lente) {
                if (!lentiTrasparenti.has(o.material)) {
                    const trasparente = o.material.clone();
                    trasparente.transparent = true;
                    trasparente.opacity = Math.min(o.material.opacity, OPACITA_LENTI);
                    if (trasparente.transmission !== undefined) trasparente.transmission = 0;
                    trasparente.depthWrite = false;
                    trasparente.side = THREE.DoubleSide;
                    lentiTrasparenti.set(o.material, trasparente);
                }
                materiale = lentiTrasparenti.get(o.material);
            }
            const pezzo = new THREE.Mesh(g, materiale);
            pezzo.userData.originale = materiale;
            pezzo.userData.lente = lente;
            pezzo.renderOrder = lente ? 1 : 0;   // le lenti trasparenti si disegnano dopo la montatura
            pezzo.frustumCulled = false;   // le stanghette si muovono: lo disegno sempre
            pezzi.push(pezzo);
        });

        // grandezza giusta e centro nel punto (0, 0, 0): larghezza = LARGHEZZA_OCCHIALI
        const scatola = new THREE.Box3();
        pezzi.forEach(function (pezzo) {
            pezzo.geometry.computeBoundingBox();
            scatola.union(pezzo.geometry.boundingBox);
        });
        const centro = scatola.getCenter(new THREE.Vector3());
        const scala = LARGHEZZA_OCCHIALI / (scatola.max.x - scatola.min.x);
        pezzi.forEach(function (pezzo) {
            pezzo.geometry.translate(-centro.x, -centro.y, -centro.z);
            pezzo.geometry.scale(scala, scala, scala);
        });
        const zMax = (scatola.max.z - centro.z) * scala;
        const zMin = (scatola.min.z - centro.z) * scala;

        // le stanghette
        const geometrie = pezzi.map(function (pezzo) { return pezzo.geometry; });
        let stanghette = null;
        if (box.dataset.stanghette !== 'no') {
            const zCerniera = box.dataset.cerniera !== undefined
                ? parseFloat(box.dataset.cerniera)
                : trovaCerniera(geometrie, zMax, zMin);
            // se dietro la cerniera non c'è quasi niente, gli occhiali non hanno stanghette
            // le lenti restano fuori: si muovono tutte insieme (in avanti) nell'esploso
            const senzaLenti = pezzi.filter(function (pezzo) { return !pezzo.userData.lente; });
            if (zCerniera - zMin > 0.5) stanghette = preparaStanghette(senzaLenti, zCerniera);
        }

        // ===== L'ESPLOSO =====
        // Ogni pezzo ha uno spostamento: le lenti vanno avanti; i pezzi del frontale fatti con un
        // materiale diverso da quello principale (naselli, viti, gommini...) vanno verso l'esterno.
        // Le stanghette si spostano a parte, insieme alla loro piega (vedi piegaStanghette).
        const zDietro = stanghette ? stanghette.z : -Infinity;
        // Il materiale principale è quello che, nel frontale, occupa più spazio
        // in larghezza per altezza (la montatura vera, non i naselli o le viti).
        const ingombri = new Map();   // materiale -> scatola che contiene i suoi pezzi del frontale
        pezzi.forEach(function (pezzo) {
            pezzo.geometry.computeBoundingBox();
            pezzo.userData.centro = pezzo.geometry.boundingBox.getCenter(new THREE.Vector3());
            if (pezzo.userData.lente || pezzo.userData.centro.z < zDietro) return;
            const m = pezzo.userData.originale;
            if (!ingombri.has(m)) ingombri.set(m, new THREE.Box3());
            ingombri.get(m).union(pezzo.geometry.boundingBox);
        });
        let principale = null, areaPrincipale = -1;
        ingombri.forEach(function (box, m) {
            const area = (box.max.x - box.min.x) * (box.max.y - box.min.y);
            if (area > areaPrincipale) { principale = m; areaPrincipale = area; }
        });
        pezzi.forEach(function (pezzo) {
            const c = pezzo.userData.centro;
            const spostamento = new THREE.Vector3();
            if (pezzo.userData.lente) {
                spostamento.set(0, 0, 1.0);
            } else if (c.z >= zDietro && pezzo.userData.originale !== principale) {
                spostamento.set(c.x, c.y, c.z * 0.3);
                if (spostamento.length() < 0.001) spostamento.set(0, -1, 0);
                spostamento.normalize().multiplyScalar(0.6);
            }
            pezzo.userData.esploso = spostamento;
        });

        modello.traverse(function (o) {
            if (o.geometry) o.geometry.dispose();   // le copie sono già fatte
        });
        return { pezzi: pezzi, stanghette: stanghette, piega: 0, esploso: 0 };
    }

    // ===== IL PANNELLO (solo nella pagina dell'occhiale) =====
    // Il pannello cambia gli occhiali della pagina. Nella griglia non c'è pannello:
    // i bottoni qui sotto non esistono e queste parti non fanno niente.
    const selezionato = paginaOcchiale ? boxes[0] : null;

    // il pannello mostra le scelte degli occhiali
    function aggiornaPannello() {
        if (!selezionato) return;
        const stato = selezionato.stato;

        sezione.querySelectorAll('.campioni').forEach(function (contenitore) {
            const parte = contenitore.dataset.parte;
            contenitore.querySelectorAll('.campione').forEach(function (c) {
                const scelto = c.dataset.color === stato[parte];
                c.classList.toggle('selected', scelto);
                if (scelto) contenitore.closest('.opzione').querySelector('.opzione-valore').textContent = c.dataset.nome;
            });
        });

        // gli occhiali senza stanghette (es. con l'elastico) hanno i bottoni spenti
        const senzaStanghette = !!(selezionato.modello && !selezionato.modello.stanghette);
        bottoniStanghette.forEach(function (b) {
            b.disabled = senzaStanghette;
            b.classList.toggle('selected', !senzaStanghette && (b.dataset.stato === 'chiuse') === stato.chiuse);
        });
        statoStanghette.textContent = senzaStanghette ? 'Non ci sono' : (stato.chiuse ? 'Chiuse' : 'Aperte');

        bottoniEsploso.forEach(function (b) {
            b.classList.toggle('selected', (b.dataset.stato === 'esploso') === stato.esploso);
        });
        statoEsploso.textContent = stato.esploso ? 'Esploso' : 'Montato';

        bottoniVista.forEach(function (b) {
            b.classList.toggle('selected', b.dataset.vista === stato.vista);
        });

        // la prova con la fotocamera si può aprire solo quando il modello è caricato
        if (bottoneProva) bottoneProva.disabled = !selezionato.modello;
    }

    // ===== COLORI =====
    function applicaColori(box) {
        if (!box.modello) return;
        box.modello.pezzi.forEach(function (pezzo) {
            const parte = pezzo.userData.lente ? 'lenti' : 'montatura';
            if (box.stato[parte] === 'originale') pezzo.material = pezzo.userData.originale;
            else pezzo.material = parte === 'lenti' ? box.matLenti : box.matMontatura;
        });
    }

    sezione.querySelectorAll('.campione').forEach(function (campione) {
        campione.addEventListener('click', function () {
            const parte = campione.closest('.campioni').dataset.parte;
            selezionato.stato[parte] = campione.dataset.color;
            if (campione.dataset.color !== 'originale') {
                (parte === 'lenti' ? selezionato.matLenti : selezionato.matMontatura).color.set(campione.dataset.color);
            }
            applicaColori(selezionato);
            aggiornaPannello();
        });
    });

    // ===== STANGHETTE APERTE / CHIUSE =====
    const bottoniStanghette = sezione.querySelectorAll('.stanghette');
    const statoStanghette = document.getElementById('stato-stanghette-galleria');
    bottoniStanghette.forEach(function (bottone) {
        bottone.addEventListener('click', function () {
            selezionato.stato.chiuse = bottone.dataset.stato === 'chiuse';
            aggiornaPannello();
        });
    });

    // ===== ESPLOSO / MONTATO =====
    const bottoniEsploso = sezione.querySelectorAll('.separa');
    const statoEsploso = document.getElementById('stato-esploso-galleria');
    bottoniEsploso.forEach(function (bottone) {
        bottone.addEventListener('click', function () {
            selezionato.stato.esploso = bottone.dataset.stato === 'esploso';
            aggiornaPannello();
        });
    });

    // ===== VISTE: davanti, lato, alto, basso, oppure ruota da solo =====
    const bottoniVista = sezione.querySelectorAll('.vista');
    bottoniVista.forEach(function (bottone) {
        bottone.addEventListener('click', function () {
            const box = selezionato;
            box.stato.vista = bottone.dataset.vista;
            clearTimeout(box.ripresa);
            box.controlli.autoRotate = box.stato.vista === 'giro';
            box.destinazione = viste[box.stato.vista] || null;
            aggiornaPannello();
        });
    });

    // ===== PROVALI CON LA FOTOCAMERA (js/prova-occhiali.js, caricato solo quando serve) =====
    const bottoneProva = document.getElementById('prova-apri');
    if (bottoneProva && selezionato) {
        bottoneProva.addEventListener('click', function () {
            const box = selezionato;
            if (!box.modello) return;
            // per provarli gli occhiali vanno montati e con le stanghette aperte
            box.stato.esploso = false;
            box.stato.chiuse = false;
            const m = box.modello;
            m.piega = 0;
            m.esploso = 0;
            m.pezzi.forEach(function (pezzo) { pezzo.position.set(0, 0, 0); });
            if (m.stanghette) piegaStanghette(m.stanghette, 0, 0);
            aggiornaPannello();

            bottoneProva.disabled = true;
            import(new URL('js/prova-occhiali.js', document.baseURI).href).then(function (prova) {
                bottoneProva.disabled = false;
                return prova.apri({ THREE: THREE, RoomEnvironment: RoomEnvironment, box: box, occhiale: box.dataset });
            }).catch(function (errore) {
                bottoneProva.disabled = false;
                console.error('Impossibile aprire la prova con la fotocamera', errore);
            });
        });
    }

    aggiornaPannello();

    // ===== ANIMAZIONE DI UN BOX =====
    const sfCamera = new THREE.Spherical();
    const sfMeta = new THREE.Spherical();

    function aggiornaBox(box) {
        // la camera gira intorno agli occhiali fino alla vista scelta
        if (box.destinazione) {
            const camera = box.camera, centro = box.controlli.target;
            sfCamera.setFromVector3(camera.position.clone().sub(centro));
            sfMeta.setFromVector3(box.destinazione.clone().sub(centro));
            sfCamera.radius += (sfMeta.radius - sfCamera.radius) * 0.06;
            sfCamera.phi += (sfMeta.phi - sfCamera.phi) * 0.06;
            let diffLato = sfMeta.theta - sfCamera.theta;
            if (diffLato > Math.PI) diffLato -= 2 * Math.PI;
            if (diffLato < -Math.PI) diffLato += 2 * Math.PI;
            sfCamera.theta += diffLato * 0.06;
            camera.position.setFromSpherical(sfCamera).add(centro);
            if (camera.position.distanceTo(box.destinazione) < 0.01) box.destinazione = null;
        }

        // le stanghette si piegano e i pezzi si separano piano piano
        const m = box.modello;
        if (m) {
            const metaPiega = box.stato.chiuse ? 1 : 0;
            const metaEsploso = box.stato.esploso ? 1 : 0;
            let cambiato = false;
            if (Math.abs(metaPiega - m.piega) > 0.001) {
                m.piega += (metaPiega - m.piega) * 0.08;
                if (Math.abs(metaPiega - m.piega) <= 0.001) m.piega = metaPiega;
                cambiato = true;
            }
            if (Math.abs(metaEsploso - m.esploso) > 0.001) {
                m.esploso += (metaEsploso - m.esploso) * 0.06;
                if (Math.abs(metaEsploso - m.esploso) <= 0.001) m.esploso = metaEsploso;
                cambiato = true;
                m.pezzi.forEach(function (pezzo) {
                    pezzo.position.copy(pezzo.userData.esploso).multiplyScalar(m.esploso);
                });
            }
            if (cambiato && m.stanghette) piegaStanghette(m.stanghette, m.piega, m.esploso);
        }

        box.controlli.update();

        // le luci girano insieme alla vista; se guardo da sotto, anche le luci vanno sotto
        const camera = box.camera, centro = box.controlli.target;
        const angolo = Math.atan2(camera.position.x - centro.x, camera.position.z - centro.z);
        const dalBasso = camera.position.y < centro.y;
        box.lucePrincipale.position.set(Math.sin(angolo + 0.8) * 6, dalBasso ? -6 : 8, Math.cos(angolo + 0.8) * 6);
        box.luceRiempimento.position.set(Math.sin(angolo - 1.4) * 6, dalBasso ? -1 : 3, Math.cos(angolo - 1.4) * 6);
    }

    // ===== DISEGNO: un pezzo di canvas per ogni box =====
    let sezioneVisibile = false;
    new IntersectionObserver(function (voci) {
        sezioneVisibile = voci[0].isIntersecting;
    }).observe(griglia);

    let larghezza = 0, altezza = 0;
    renderer.setAnimationLoop(function () {
        if (!sezioneVisibile) return;

        // il canvas è grande quanto tutta la griglia
        if (griglia.clientWidth !== larghezza || griglia.clientHeight !== altezza) {
            larghezza = griglia.clientWidth;
            altezza = griglia.clientHeight;
            renderer.setSize(larghezza, altezza);
        }

        renderer.setScissorTest(false);
        renderer.clear();
        renderer.setScissorTest(true);

        const g = griglia.getBoundingClientRect();
        boxes.forEach(function (box) {
            const r = box.elemento.getBoundingClientRect();
            // i box fuori dallo schermo non li disegno
            if (r.bottom < 0 || r.top > window.innerHeight || r.width === 0) return;

            aggiornaBox(box);

            const sinistra = r.left - g.left;
            const sotto = altezza - (r.top - g.top) - r.height;   // WebGL conta dal basso
            renderer.setViewport(sinistra, sotto, r.width, r.height);
            renderer.setScissor(sinistra, sotto, r.width, r.height);
            if (box.camera.aspect !== r.width / r.height) {
                box.camera.aspect = r.width / r.height;
                box.camera.updateProjectionMatrix();
            }
            renderer.render(box.scena, box.camera);
        });
    });
});
