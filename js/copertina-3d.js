// copertina-3d.js – il "video" degli occhiali nella copertina di inde1.html.
//
// 1. Se nella cartella c'è il file video/vento.mp4, la copertina mostra quel video
//    (in loop, senza audio) e questo script non fa altro.
// 2. Se il video non c'è, gli occhiali di Linda (models/lindagarnaroli.glb) diventano
//    un filmato in 3D: girano piano su se stessi, con la luce arancione del tramonto
//    da dietro e una luce fredda da davanti, come in alta quota.
// Il 3D si ferma quando la copertina non si vede, per non appesantire la pagina.

(function () {
    const video = document.getElementById('copertina-video');
    const contenitore = document.getElementById('copertina-3d');
    if (!video || !contenitore) return;

    const sorgente = video.querySelector('source');
    let avviato = false;

    function senzaVideo() {
        if (avviato) return;
        avviato = true;
        video.remove();
        avvia3D();
    }

    // il file non c'è (o non si può leggere): passo al 3D
    sorgente.addEventListener('error', senzaVideo);
    video.addEventListener('error', senzaVideo);
    // l'errore può essere già successo prima che questo script partisse
    if (video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) senzaVideo();
    // se il browser non ha ancora deciso dopo 4 secondi e il video non parte, uso il 3D
    setTimeout(function () {
        if (video.isConnected && video.readyState === 0) senzaVideo();
    }, 4000);

    function avvia3D() {
        Promise.all([
            import('three'),
            import('three/addons/environments/RoomEnvironment.js'),
            import('three/addons/loaders/GLTFLoader.js')
        ]).then(function (moduli) {
            const THREE = moduli[0];
            const RoomEnvironment = moduli[1].RoomEnvironment;
            const GLTFLoader = moduli[2].GLTFLoader;

            const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.setClearColor(0x000000, 0);   // trasparente: dietro si vede il cielo del CSS
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.setSize(contenitore.clientWidth, contenitore.clientHeight);
            contenitore.appendChild(renderer.domElement);

            const scena = new THREE.Scene();
            const pmrem = new THREE.PMREMGenerator(renderer);
            scena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
            scena.environmentIntensity = 0.35;

            // luci di montagna: cielo freddo sopra, bosco scuro sotto,
            // tramonto arancione da dietro e una luce fredda da davanti
            scena.add(new THREE.HemisphereLight(0x9fb8d0, 0x0d1611, 0.9));
            const tramonto = new THREE.DirectionalLight(0xff7a3d, 4.0);
            tramonto.position.set(4, 3, -6);
            scena.add(tramonto);
            const fredda = new THREE.DirectionalLight(0xdfe9f5, 1.4);
            fredda.position.set(-4, 2, 6);
            scena.add(fredda);

            const camera = new THREE.PerspectiveCamera(32, contenitore.clientWidth / contenitore.clientHeight, 0.1, 100);

            // ===== GLI OCCHIALI (stessi pezzi di js/occhiali.js) =====
            const pezzi = {
                573: 'montatura', 575: 'montatura', 576: 'montatura',
                569: 'aste', 570: 'aste',
                579: 'lenti', 580: 'lenti',
                571: 'cerniere', 572: 'cerniere'
            };
            const materiali = {
                // montatura verde bosco, lucida come plastica tecnica
                montatura: new THREE.MeshPhysicalMaterial({ color: '#2f4a3a', roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.1 }),
                aste: new THREE.MeshPhysicalMaterial({ color: '#1f2c24', roughness: 0.4, clearcoat: 0.6 }),
                // lenti a specchio arancioni, come quelle da alta quota
                lenti: new THREE.MeshPhysicalMaterial({
                    color: '#ff6a2b', metalness: 0.7, roughness: 0.05,
                    transparent: true, opacity: 0.8, side: THREE.DoubleSide
                }),
                cerniere: new THREE.MeshPhysicalMaterial({ color: 0xb8bcc2, metalness: 1, roughness: 0.3 })
            };
            const occhiali = new THREE.Group();
            scena.add(occhiali);

            new GLTFLoader().load('models/lindagarnaroli.glb', function (gltf) {
                const modello = gltf.scene;
                modello.children.slice().forEach(function (pezzo) {
                    const info = gltf.parser.associations.get(pezzo) || {};
                    const numero = info.meshes !== undefined ? info.meshes : info.nodes;
                    const parte = pezzi[numero];
                    if (!parte) {   // linee, disegni e copie doppie: via
                        modello.remove(pezzo);
                        pezzo.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
                        return;
                    }
                    pezzo.traverse(function (superficie) {
                        if (!superficie.isMesh) return;
                        superficie.material.dispose();
                        superficie.material = materiali[parte];
                    });
                });
                // grandezza e centro: occhiali larghi 3, al centro della scena
                modello.updateMatrixWorld(true);
                const scatola = new THREE.Box3().setFromObject(modello);
                const scala = 3 / scatola.getSize(new THREE.Vector3()).x;
                const centro = scatola.getCenter(new THREE.Vector3());
                modello.scale.setScalar(scala);
                modello.position.set(-centro.x * scala, -centro.y * scala, -centro.z * scala);
                occhiali.add(modello);
                contenitore.classList.add('pronto');   // il CSS lo fa comparire piano
            }, undefined, function (errore) {
                console.error('Copertina: impossibile caricare models/lindagarnaroli.glb', errore);
            });

            // ===== IL MOVIMENTO, COME UNA RIPRESA =====
            // gli occhiali girano piano, la camera sale e scende appena e si avvicina e allontana
            const fermo = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            let visibile = true;
            new IntersectionObserver(function (voci) {
                visibile = voci[0].isIntersecting;
            }).observe(contenitore);

            const orologio = new THREE.Clock();
            renderer.setAnimationLoop(function () {
                if (!visibile) return;
                const t = fermo ? 6 : orologio.getElapsedTime();
                occhiali.rotation.y = -0.6 + t * 0.18;               // un giro ogni ~35 secondi
                occhiali.position.y = Math.sin(t * 0.8) * 0.06;      // galleggia appena
                const distanza = 7.2 + Math.sin(t * 0.21) * 0.5;
                const altezza = 1.0 + Math.sin(t * 0.13) * 0.6;
                camera.position.set(0, altezza, distanza);
                camera.lookAt(0, 0, 0);
                renderer.render(scena, camera);
            });

            window.addEventListener('resize', function () {
                camera.aspect = contenitore.clientWidth / contenitore.clientHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(contenitore.clientWidth, contenitore.clientHeight);
            });
        });
    }
})();
