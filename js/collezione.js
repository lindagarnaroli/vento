// collezione.js – l'elenco degli occhiali della collezione (cartella modelli_occhiali_glbxweb).
// Lo usano tutte e due le pagine:
//   index.html     la griglia con tutti gli occhiali (un box per modello)
//   occhiale.html  la pagina di un occhiale, che si riempie con i dati del modello cliccato
//                  (es. occhiale.html?modello=sprint)
// Per aggiungere un occhiale basta aggiungere un elemento qui.
//
//   id          il nome nell'indirizzo della pagina (minuscolo, senza spazi)
//   nome        il nome del modello
//   autori      chi l'ha progettato
//   descrizione il testo della pagina dell'occhiale
//   file        il nome del file nella cartella
//   lenti       come riconoscere le lenti:  "nome:lenti"  (nome del pezzo o del materiale)
//                                           "materiale:3" (numero del materiale nel file)
//                                           "nodi:579,580" (numero dei pezzi nel file)
//   togli       (se serve) i pezzi da togliere, separati da virgole
//   ruota       (se serve) "z180" capovolge sopra/sotto, "y180" gira davanti/dietro
//   cerniera    (se serve) dove sono le cerniere (da 1.5 = davanti a -1.5 = dietro);
//               se manca, il programma la trova da solo
//   stanghette  "no" per gli occhiali senza stanghette (es. con l'elastico)

const COLLEZIONE = [
    {
        id: 'sprint', nome: 'Sprint',
        autori: 'Anna Porcellini, Takwa Guezguez',
        descrizione: 'Occhiali sportivi avvolgenti: il frontale curvo segue la forma del viso e protegge anche ai lati. I gommini arancioni sul naso e in fondo alle stanghette li tengono fermi durante il movimento.',
        file: 'AnnaPorcellini.glb', lenti: 'nome:lenti'
    },
    {
        id: 'vento', nome: 'Vento',
        autori: 'Alessandro Morri, Linda Garnaroli',
        descrizione: 'Sportivi a mezza montatura: il frontale tiene le lenti solo in alto, così la vista resta libera verso il basso. Piccoli ganci uniscono il frontale alle stanghette.',
        file: 'alessandromorri.glb', lenti: 'nodi:579,580'
    },
    {
        id: 'visiera', nome: 'Visiera',
        autori: 'Davide Sebastianelli, Luigi Boccarossa',
        descrizione: 'Una visiera unica al posto delle due lenti, con il frontale nero opaco. Le stanghette sottili si agganciano ai lati con cerniere a vista.',
        file: 'davidesebastianelli.glb', lenti: 'nome:lente'
    },
    {
        id: 'scudo', nome: 'Scudo',
        autori: 'Adele De Marini, Francesca Galli, Giuli',
        descrizione: 'Occhiali a schermo: una sola lente avvolgente copre gli occhi da un lato all\'altro. Le stanghette, larghe vicino al frontale, riparano anche di lato.',
        file: 'demariniadele.glb', lenti: 'nome:lente', cerniera: 0.9
    },
    {
        id: 'orizzonte', nome: 'Orizzonte',
        autori: 'Gianmarco Tito, Jacopo Del Bianco',
        descrizione: 'Lo schermo trasparente disegna un unico orizzonte davanti agli occhi. Le stanghette larghe e scolpite fanno da protezione laterale.',
        file: 'gianmarcotito.glb', lenti: 'nome:lente', ruota: 'y180', cerniera: 1.0
    },
    {
        id: 'aurora', nome: 'Aurora',
        autori: 'Edoardo Fabbri',
        descrizione: 'Montatura rossa con il frontale che sale verso l\'esterno, come un occhiale a gatto in versione sportiva. Frontale e stanghette sono un pezzo unico.',
        file: 'fabbri_Edoardo.glb', lenti: 'nome:lenti', ruota: 'z180'
    },
    {
        id: 'maschera', nome: 'Maschera',
        autori: 'Eleonora Nobili',
        descrizione: 'Una maschera con l\'elastico al posto delle stanghette: aderisce al viso e chiude tutto intorno agli occhi, come quelle da sci.',
        file: 'Eleonora_Nobili.glb', lenti: 'nome:lente', stanghette: 'no'
    },
    {
        id: 'riparo', nome: 'Riparo',
        autori: 'Giulia Camasso',
        descrizione: 'Occhiali a schermo con una lente unica e avvolgente e stanghette dritte e larghe, pensati per proteggere gli occhi.',
        file: 'giuliacamasso.glb', lenti: 'materiale:0', cerniera: 0.9
    },
    {
        id: 'pilota', nome: 'Pilota',
        autori: 'Luca Giorgetti',
        descrizione: 'Frontale dritto e squadrato, con la lente unica sotto il ponte. I naselli separati e le stanghette curve lo rendono leggero.',
        file: 'lucagiorgetti.glb', lenti: 'materiale:3'
    },
    {
        id: 'brezza', nome: 'Brezza',
        autori: 'Valentina Vicinanza',
        descrizione: 'Mezza montatura leggera: la lente è libera in basso e le stanghette, unite con piccoli ganci, seguono la forma della testa.',
        file: 'valentinavicinanza.glb', lenti: 'nome:lenti'
    }
];
