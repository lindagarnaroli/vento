// prova-vento.js – "Provali con la fotocamera" nella pagina di Vento (inde1.html).
//
// La prova vera e propria (fotocamera, riconoscimento del viso, foto, condivisione) è in
// js/prova-occhiali.js, la stessa di occhiale.html. Qui preparo gli occhiali da provare
// prendendoli dal configuratore (js/occhiali.js): stessi pezzi e stessi colori scelti nel pannello,
// con le stanghette aperte.
// I bottoni con la classe "apri-prova" si accendono quando il modello 3D è caricato.

(function () {
    const bottoni = document.querySelectorAll('.apri-prova');
    let configuratore = null;   // arriva da js/occhiali.js quando il modello è pronto
    let pezzi = null;           // gli occhiali per la prova: si preparano una volta sola

    bottoni.forEach(function (b) { b.disabled = true; });

    document.addEventListener('occhiali-pronti', function (evento) {
        configuratore = evento.detail;
        bottoni.forEach(function (b) { b.disabled = false; });
    });

    // Copio ogni superficie degli occhiali già "al suo posto" (con le stanghette aperte),
    // misurata rispetto al centro degli occhiali: la prova vuole i pezzi così.
    function preparaPezzi() {
        const THREE = configuratore.THREE;
        const oggetto = configuratore.oggetto;
        const lati = configuratore.lati;

        // apro le stanghette solo per il tempo della copia, poi le rimetto come erano
        const comeErano = lati.map(function (lato) { return lato.perno ? lato.perno.rotation.y : 0; });
        lati.forEach(function (lato) { if (lato.perno) lato.perno.rotation.y = 0; });
        oggetto.updateMatrixWorld(true);

        const inversa = new THREE.Matrix4().copy(oggetto.matrixWorld).invert();
        const matrice = new THREE.Matrix4();
        const elenco = [];
        oggetto.traverse(function (o) {
            if (!o.isMesh) return;
            const geometria = o.geometry.clone();
            geometria.applyMatrix4(matrice.multiplyMatrices(inversa, o.matrixWorld));
            elenco.push({
                geometry: geometria,
                material: o.material,   // lo stesso materiale: se cambi colore nel pannello, cambia anche qui
                userData: { lente: o.material === configuratore.materiali.lenti }
            });
        });

        lati.forEach(function (lato, i) { if (lato.perno) lato.perno.rotation.y = comeErano[i]; });
        oggetto.updateMatrixWorld(true);
        return elenco;
    }

    function apri() {
        if (!configuratore) return;
        if (!pezzi) pezzi = preparaPezzi();
        const box = {
            modello: { pezzi: pezzi },
            stato: { lenti: 'scelto' },                 // le lenti prendono il colore scelto nel pannello
            matLenti: configuratore.materiali.lenti
        };
        bottoni.forEach(function (b) { b.disabled = true; });
        import(new URL('js/prova-occhiali.js', document.baseURI).href).then(function (prova) {
            bottoni.forEach(function (b) { b.disabled = false; });
            return prova.apri({
                THREE: configuratore.THREE,
                RoomEnvironment: configuratore.RoomEnvironment,
                box: box,
                occhiale: { id: 'vento', nome: 'Vento' },
                firma: 'Vento · Linda Garnaroli',
                testoCondivisione: 'I miei occhiali Vento di Linda Garnaroli'
            });
        }).catch(function (errore) {
            bottoni.forEach(function (b) { b.disabled = false; });
            console.error('Impossibile aprire la prova con la fotocamera', errore);
        });
    }

    bottoni.forEach(function (b) { b.addEventListener('click', apri); });
})();
