// attrezzatura.js – le frecce per scorrere i prodotti dell'attrezzatura (inde1.html, #attrezzatura).
// La fila dei prodotti scorre anche da sola col dito o col trackpad (CSS: overflow e scroll-snap);
// le frecce la spostano di una "pagina" alla volta e si spengono all'inizio e alla fine.
// L'aggiunta al carrello è in js/carrello.js.

document.addEventListener('DOMContentLoaded', function () {
    const carosello = document.getElementById('carosello-attrezzatura');
    const indietro = document.getElementById('attrezzatura-indietro');
    const avanti = document.getElementById('attrezzatura-avanti');
    if (!carosello) return;

    // di quanto scorrere: le carte che si vedono intere, meno una (così si capisce dove si era)
    function passo() {
        const carta = carosello.querySelector('.prodotto');
        const larghezza = carta.getBoundingClientRect().width + parseFloat(getComputedStyle(carosello).columnGap || 0);
        const visibili = Math.max(1, Math.floor(carosello.clientWidth / larghezza) - 1);
        return visibili * larghezza;
    }

    function aggiornaFrecce() {
        const fine = carosello.scrollWidth - carosello.clientWidth - 2;
        indietro.disabled = carosello.scrollLeft <= 2;
        avanti.disabled = carosello.scrollLeft >= fine;
    }

    indietro.addEventListener('click', function () {
        carosello.scrollBy({ left: -passo(), behavior: 'smooth' });
    });
    avanti.addEventListener('click', function () {
        carosello.scrollBy({ left: passo(), behavior: 'smooth' });
    });

    // anche con le frecce della tastiera, quando la fila è selezionata
    carosello.tabIndex = 0;
    carosello.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') { e.preventDefault(); avanti.click(); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); indietro.click(); }
    });

    carosello.addEventListener('scroll', aggiornaFrecce, { passive: true });
    window.addEventListener('resize', aggiornaFrecce);
    aggiornaFrecce();
});
