// carrello.js – il carrello della pagina di Vento (inde1.html).
//
// "Aggiungi al carrello" degli occhiali legge i colori scelti nel configuratore (#configuratore-occhiali):
// montatura, aste, lenti e finitura. Due paia uguali diventano una riga con quantità 2.
// I prodotti dell'attrezzatura (#attrezzatura) si aggiungono con i loro bottoni .aggiungi-prodotto,
// che hanno nome, prezzo e descrizione scritti nell'HTML.
// Il carrello si apre da destra; "Procedi all'ordine" chiede nome, email, indirizzo, CAP,
// città, stato e come pagare, poi apre l'email con il riepilogo da inviare all'indirizzo qui sotto.
//
// Pagamento con carta di credito: il numero della carta NON si chiede in questa pagina.
// Il sito non ha un server, e mandare i dati di una carta per email non è sicuro (e non è permesso
// dalle regole dei circuiti di pagamento). Con "Carta di credito" si apre invece la pagina
// di pagamento sicura di Stripe: la carta si inserisce lì.
// Per attivarla: su stripe.com crea un "Payment Link" e incolla il suo indirizzo in LINK_PAGAMENTO_CARTA.
// Attenzione: un Payment Link ha un prezzo fisso, quindi va bene solo se si vende un prodotto.
// Con l'attrezzatura il totale cambia da ordine a ordine: finché non c'è un server che crea
// il pagamento giusto (es. Stripe Checkout), lascia LINK_PAGAMENTO_CARTA vuoto e rispondi
// a ogni ordine con un link di pagamento fatto apposta (Stripe lo permette dalla dashboard).
//
// Il carrello resta salvato nel browser (localStorage) anche se si ricarica la pagina.

// ===== DA CAMBIARE =====
const EMAIL_ORDINI = 'vento@example.com';   // l'email a cui arrivano gli ordini (è un esempio)
const PREZZO = 180;                          // prezzo di un paio, in euro (è un esempio)
const LINK_PAGAMENTO_CARTA = '';             // il link di pagamento di Stripe, es. 'https://buy.stripe.com/...'
const IBAN = 'IT00 X000 0000 0000 0000 0000 000';   // per il bonifico (è un esempio)
const NOME_OCCHIALI = 'Vento';
const CHIAVE_SALVATAGGIO = 'carrello-vento';

document.addEventListener('DOMContentLoaded', function () {

    const configuratore = document.getElementById('configuratore-occhiali');
    const carrello = document.getElementById('carrello');
    const sfondo = document.getElementById('carrello-sfondo');
    const elenco = document.getElementById('carrello-elenco');
    const vuoto = document.getElementById('carrello-vuoto');
    const rigaTotale = document.getElementById('carrello-totale-riga');
    const totale = document.getElementById('carrello-totale');
    const numero = document.getElementById('carrello-numero');
    const bottoneProcedi = document.getElementById('carrello-procedi');
    const passoElenco = document.getElementById('carrello-elenco-passo');
    const modulo = document.getElementById('carrello-modulo');
    const passoFatto = document.getElementById('carrello-fatto');
    const avviso = document.getElementById('avviso-carrello');

    const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
    document.getElementById('prezzo-occhiali').textContent = euro.format(PREZZO);

    // ===== IL CONTENUTO DEL CARRELLO =====
    // Ogni riga è un prodotto: { id, nome, prezzo, dettagli, quantita }
    // e in più, a seconda del prodotto:
    //   colori:   i tre colori degli occhiali (montatura, aste, lenti), disegnati come pallini
    //   immagine: il disegno del prodotto dell'attrezzatura
    // Due righe con lo stesso id sono lo stesso prodotto: si somma la quantità.
    let righe = [];
    try {
        righe = JSON.parse(localStorage.getItem(CHIAVE_SALVATAGGIO)) || [];
    } catch (e) {
        righe = [];   // in una finestra privata il browser può non salvare: si parte vuoti
    }
    // i carrelli salvati con la versione di prima (solo occhiali) vengono aggiornati
    righe = righe.map(function (r) {
        if (r.prezzo !== undefined) return r;
        return rigaOcchiali({ colori: r.colori, finitura: r.finitura }, r.quantita);
    });

    function salva() {
        try {
            localStorage.setItem(CHIAVE_SALVATAGGIO, JSON.stringify(righe));
        } catch (e) {
            // niente salvataggio: il carrello funziona lo stesso finché la pagina è aperta
        }
    }

    // ----- gli occhiali: la riga nasce dalle scelte del configuratore -----
    function sceltaAttuale() {
        const colori = {};
        configuratore.querySelectorAll('.campioni').forEach(function (gruppo) {
            const scelto = gruppo.querySelector('.campione.selected');
            colori[gruppo.dataset.parte] = { nome: scelto.dataset.nome, colore: scelto.dataset.color };
        });
        const finitura = configuratore.querySelector('.finitura.selected');
        return { colori: colori, finitura: finitura ? finitura.dataset.nome : '' };
    }

    function rigaOcchiali(scelta, quantita) {
        const parti = ['montatura', 'aste', 'lenti'];
        return {
            // stessi colori e stessa finitura = stesso prodotto
            id: 'vento|' + parti.map(function (p) { return scelta.colori[p].colore; }).join('|') + '|' + scelta.finitura,
            nome: NOME_OCCHIALI,
            prezzo: PREZZO,
            dettagli: 'Montatura ' + scelta.colori.montatura.nome +
                ' · Aste ' + scelta.colori.aste.nome +
                ' · Lenti ' + scelta.colori.lenti.nome +
                ' · ' + scelta.finitura,
            colori: parti.map(function (p) { return { parte: p, nome: scelta.colori[p].nome, colore: scelta.colori[p].colore }; }),
            quantita: quantita
        };
    }

    function quantiPezzi() {
        return righe.reduce(function (somma, r) { return somma + r.quantita; }, 0);
    }

    function totaleEuro() {
        return righe.reduce(function (somma, r) { return somma + r.prezzo * r.quantita; }, 0);
    }

    // ===== DISEGNO DEL CARRELLO =====
    function disegna() {
        numero.textContent = quantiPezzi();
        elenco.innerHTML = '';
        righe.forEach(function (riga, indice) {
            const li = document.createElement('li');
            li.className = 'carrello-riga';

            // a sinistra: i tre colori degli occhiali, oppure il disegno del prodotto
            const figura = document.createElement('div');
            if (riga.colori) {
                figura.className = 'carrello-pallini';
                riga.colori.forEach(function (c) {
                    const pallino = document.createElement('span');
                    pallino.style.backgroundColor = c.colore;
                    pallino.title = c.parte + ': ' + c.nome;
                    figura.appendChild(pallino);
                });
            } else {
                figura.className = 'carrello-figura';
                if (riga.immagine) {
                    const img = document.createElement('img');
                    img.src = riga.immagine;
                    img.alt = '';
                    figura.appendChild(img);
                }
            }

            const testo = document.createElement('div');
            testo.className = 'carrello-testo';
            const nome = document.createElement('p');
            nome.className = 'carrello-nome';
            nome.textContent = riga.nome;
            const dettagli = document.createElement('p');
            dettagli.className = 'carrello-dettagli';
            dettagli.textContent = riga.dettagli;

            // quantità con − e +, e "Rimuovi"
            const quantita = document.createElement('div');
            quantita.className = 'carrello-quantita';
            const meno = document.createElement('button');
            meno.textContent = '−';
            meno.setAttribute('aria-label', 'Togli uno');
            const valore = document.createElement('span');
            valore.textContent = riga.quantita;
            const piu = document.createElement('button');
            piu.textContent = '+';
            piu.setAttribute('aria-label', 'Aggiungi uno');
            const rimuovi = document.createElement('button');
            rimuovi.className = 'carrello-rimuovi';
            rimuovi.textContent = 'Rimuovi';
            meno.addEventListener('click', function () { cambiaQuantita(indice, -1); });
            piu.addEventListener('click', function () { cambiaQuantita(indice, 1); });
            rimuovi.addEventListener('click', function () { cambiaQuantita(indice, -riga.quantita); });
            quantita.append(meno, valore, piu, rimuovi);

            testo.append(nome, dettagli, quantita);

            const prezzo = document.createElement('p');
            prezzo.className = 'carrello-prezzo';
            prezzo.textContent = euro.format(riga.prezzo * riga.quantita);

            li.append(figura, testo, prezzo);
            elenco.appendChild(li);
        });

        const pieno = righe.length > 0;
        vuoto.hidden = pieno;
        rigaTotale.hidden = !pieno;
        bottoneProcedi.hidden = !pieno;
        totale.textContent = euro.format(totaleEuro());
    }

    function cambiaQuantita(indice, di) {
        righe[indice].quantita += di;
        if (righe[indice].quantita <= 0) righe.splice(indice, 1);
        salva();
        disegna();
    }

    // ===== APRIRE E CHIUDERE =====
    function mostraPasso(passo) {
        passoElenco.hidden = passo !== 'elenco';
        modulo.hidden = passo !== 'modulo';
        passoFatto.hidden = passo !== 'fatto';
    }

    function apri() {
        mostraPasso('elenco');
        carrello.classList.add('aperto');
        carrello.setAttribute('aria-hidden', 'false');
        sfondo.hidden = false;
        document.getElementById('carrello-chiudi').focus();
    }

    function chiudi() {
        carrello.classList.remove('aperto');
        carrello.setAttribute('aria-hidden', 'true');
        sfondo.hidden = true;
    }

    document.getElementById('carrello-apri').addEventListener('click', apri);
    document.getElementById('carrello-chiudi').addEventListener('click', chiudi);
    sfondo.addEventListener('click', chiudi);
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && carrello.classList.contains('aperto')) chiudi();
    });

    // ===== AGGIUNGI AL CARRELLO =====
    let timerAvviso = null;

    function aggiungi(nuova) {
        const uguale = righe.find(function (r) { return r.id === nuova.id; });
        if (uguale) uguale.quantita += 1;
        else righe.push(nuova);
        salva();
        disegna();

        avviso.textContent = nuova.nome + ' aggiunto al carrello';
        avviso.hidden = false;
        clearTimeout(timerAvviso);
        timerAvviso = setTimeout(function () { avviso.hidden = true; }, 3000);
        apri();
    }

    // gli occhiali, con i colori scelti nel configuratore
    document.getElementById('aggiungi-carrello').addEventListener('click', function () {
        aggiungi(rigaOcchiali(sceltaAttuale(), 1));
    });

    // l'attrezzatura: i bottoni hanno i dati del prodotto (data-id, data-nome, data-prezzo...)
    document.querySelectorAll('.aggiungi-prodotto').forEach(function (bottone) {
        const d = bottone.dataset;
        bottone.addEventListener('click', function () {
            aggiungi({
                id: d.id,
                nome: d.nome,
                prezzo: Number(d.prezzo),
                dettagli: d.dettagli,
                immagine: d.immagine,
                quantita: 1
            });
        });
    });
    // il prezzo scritto sotto ogni prodotto
    document.querySelectorAll('.prodotto-prezzo[data-prezzo]').forEach(function (el) {
        el.textContent = euro.format(Number(el.dataset.prezzo));
    });

    // ===== L'ORDINE =====
    bottoneProcedi.addEventListener('click', function () { mostraPasso('modulo'); });
    document.getElementById('carrello-indietro').addEventListener('click', function () { mostraPasso('elenco'); });
    document.getElementById('carrello-ricomincia').addEventListener('click', function () { mostraPasso('elenco'); });

    // la spiegazione sotto il metodo di pagamento cambia con la scelta
    const notaPagamento = document.getElementById('nota-pagamento');
    function aggiornaNotaPagamento() {
        const metodo = new FormData(modulo).get('pagamento');
        if (metodo === 'Carta di credito') {
            notaPagamento.textContent = LINK_PAGAMENTO_CARTA
                ? 'Dopo l\'invio si apre la pagina di pagamento sicura di Stripe: i dati della carta li inserisci lì, non passano da questo sito.'
                : 'Il pagamento con carta online non è ancora attivo: ti mandiamo noi il link per pagare in modo sicuro, rispondendo alla tua email.';
        } else {
            notaPagamento.textContent = 'Ti mandiamo le coordinate per il bonifico; spediamo appena arriva il pagamento.';
        }
    }
    modulo.querySelectorAll('input[name="pagamento"]').forEach(function (r) {
        r.addEventListener('change', aggiornaNotaPagamento);
    });
    aggiornaNotaPagamento();

    modulo.addEventListener('submit', function (e) {
        e.preventDefault();
        const dati = new FormData(modulo);
        const metodo = dati.get('pagamento');
        const testo = [
            'Ciao, vorrei ordinare:',
            ''
        ].concat(righe.map(function (r) {
            return '- ' + r.quantita + ' × ' + r.nome + ' (' + r.dettagli + ') – ' + euro.format(r.prezzo * r.quantita);
        })).concat([
            '',
            'Totale: ' + euro.format(totaleEuro()),
            '',
            'Nome: ' + dati.get('nome'),
            'Email: ' + dati.get('email'),
            '',
            'Spedizione:',
            dati.get('indirizzo'),
            dati.get('cap') + ' ' + dati.get('citta'),
            dati.get('stato'),
            '',
            'Pagamento: ' + metodo,
            dati.get('note') ? '\nNote: ' + dati.get('note') : ''
        ]).join('\n');

        // con la carta (se il link c'è) apro in un'altra scheda la pagina di pagamento di Stripe,
        // con l'email già scritta; il numero della carta si inserisce lì
        const pagaConCarta = metodo === 'Carta di credito' && LINK_PAGAMENTO_CARTA;
        if (pagaConCarta) {
            window.open(LINK_PAGAMENTO_CARTA + '?prefilled_email=' + encodeURIComponent(dati.get('email')), '_blank', 'noopener');
        }

        // apre il programma di posta con l'ordine già scritto
        window.location.href = 'mailto:' + EMAIL_ORDINI +
            '?subject=' + encodeURIComponent('Ordine ' + NOME_OCCHIALI + ' – ' + dati.get('nome')) +
            '&body=' + encodeURIComponent(testo);

        const fatto = document.getElementById('carrello-fatto-testo');
        if (pagaConCarta) {
            fatto.textContent = 'Si sono aperte la tua email con il riepilogo (inviala) e, in un\'altra scheda, la pagina di pagamento sicura per la carta.';
        } else if (metodo === 'Carta di credito') {
            fatto.textContent = 'Si è aperta la tua email con il riepilogo: inviala e ti risponderemo con il link per pagare con la carta in modo sicuro.';
        } else {
            fatto.textContent = 'Si è aperta la tua email con il riepilogo: inviala. Per il bonifico: IBAN ' + IBAN + ', causale "Ordine ' + NOME_OCCHIALI + ' – ' + dati.get('nome') + '".';
        }
        mostraPasso('fatto');
    });

    disegna();
});
