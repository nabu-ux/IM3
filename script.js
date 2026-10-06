// Diese PHP-Datei liefert uns die Daten für die Diagramme
const DATEN_URL = '/unload.php';



// Diese Zeitspanne und Altersgruppe verwenden wir für unsere Auswertung
const AKTUELLER_ZEITRAUM = '2018-2022';
const ZIELALTER = '20-29';
const GESCHLECHTER = { total: 'Beide Geschlechter', female: 'Frauen', male: 'Männer' };
const ROTBRAUN = '#954139';
const ORANGE = '#b74f1c';



// Hier speichern wir später die Daten, die wir von PHP bekommen
let daten = [];

// Die ersten zwei Diagramme starten mit beiden Geschlechtern, das dritte mit Frauen
const auswahl = { altersdiagramm: 'total', zeitdiagramm: 'total', krebsartendiagramm: 'female' };

// Hier merken wir uns die Diagramme. So müssen wir sie nicht bei jedem Klick neu erstellen
const diagramme = {};



// In den Daten kann zum Beispiel Frauen stehen. Unser Code nennt das female
// Mit dieser Liste ordnen wir die verschiedenen Namen einander zu
const GESCHLECHT_ZUORDNUNG = {
    'Frauen': 'female', 'Weiblich': 'female', 'Männer': 'male', 'Männlich': 'male',
    'Beide Geschlechter': 'total', 'Total': 'total', 'Insgesamt': 'total',
    'total': 'total', 'female': 'female', 'male': 'male'
};
const GESAMT_KREBSARTEN = ['Alle Krebsarten', 'Alle Krebsarten (C00-C97)', 'Alle Krebsarten (total) (C00-C97*)', 'Total', 'Insgesamt'];
const GESCHLECHTSSPEZIFISCHE_KREBSARTEN = {
    'Eierstockkrebs (C56)': 'female',
    'Gebärmutterhalskrebs (C53)': 'female',
    'Gebärmutterkörperkrebs (C54-C55)': 'female',
    'Hodenkrebs (C62)': 'male',
    'Prostatakrebs (C61)': 'male'
};

function gesamtwerteErgaenzen(zeilen) {
    const gruppen = new Map();
    const bevoelkerungen = new Map();

    zeilen.forEach(zeile => {
        if (!['female', 'male', 'total'].includes(zeile.sex)) {
            return;
        }
        const gruppenschluessel = JSON.stringify([zeile.period, zeile.age_group, zeile.cancer_type]);
        if (!gruppen.has(gruppenschluessel)) {
            gruppen.set(gruppenschluessel, {});
        }
        gruppen.get(gruppenschluessel)[zeile.sex] = zeile;

        if (zeile.cancer_type === 'Alle Krebsarten' && zeile.sex !== 'total' &&
            Number.isFinite(zeile.cases) && zeile.cases > 0 &&
            Number.isFinite(zeile.incidence_rate) && zeile.incidence_rate > 0) {
            const bevoelkerungsschluessel = JSON.stringify([zeile.period, zeile.age_group, zeile.sex]);
            bevoelkerungen.set(bevoelkerungsschluessel, zeile.cases / zeile.incidence_rate * 100000);
        }
    });

    const gesamtzeilen = [];
    gruppen.forEach(gruppe => {
        if (gruppe.total) {
            return;
        }
        const vorhandeneZeilen = [gruppe.female, gruppe.male].filter(Boolean);
        const vorlage = vorhandeneZeilen[0];
        if (vorhandeneZeilen.length < 2 && GESCHLECHTSSPEZIFISCHE_KREBSARTEN[vorlage.cancer_type] !== vorlage.sex) {
            return;
        }

        const frauenBevoelkerung = bevoelkerungen.get(JSON.stringify([vorlage.period, vorlage.age_group, 'female']));
        const maennerBevoelkerung = bevoelkerungen.get(JSON.stringify([vorlage.period, vorlage.age_group, 'male']));
        const gesamtBevoelkerung = frauenBevoelkerung + maennerBevoelkerung;
        const gemeinsameRate = kennzahl => {
            if (!Number.isFinite(gesamtBevoelkerung) || gesamtBevoelkerung <= 0 ||
                !vorhandeneZeilen.every(zeile => Number.isFinite(zeile[kennzahl]))) {
                return null;
            }
            const gewichteteSumme = vorhandeneZeilen.reduce((summe, zeile) => {
                const bevoelkerung = zeile.sex === 'female' ? frauenBevoelkerung : maennerBevoelkerung;
                return summe + zeile[kennzahl] * bevoelkerung;
            }, 0);
            return Math.round(gewichteteSumme / gesamtBevoelkerung * 10000) / 10000;
        };

        gesamtzeilen.push({
            ...vorlage,
            sex: 'total',
            cases: vorhandeneZeilen.every(zeile => Number.isFinite(zeile.cases))
                ? Math.round(vorhandeneZeilen.reduce((summe, zeile) => summe + zeile.cases, 0) * 10000) / 10000
                : null,
            incidence_rate: gemeinsameRate('incidence_rate'),
            mortality_rate: gemeinsameRate('mortality_rate')
        });
    });
    return [...zeilen, ...gesamtzeilen];
}




// Hier passen wir die Namen und Schreibweisen aus den Daten an unsere Diagramme an
function datenAnpassen(zeilen) {
    // Wir gehen jede Datenzeile einzeln durch
    const angepassteZeilen = zeilen.map(zeile => {
        // Falls gender fehlt, nehmen wir sex. trim entfernt Leerzeichen am Anfang und Ende
        const geschlecht = String(zeile.gender ?? zeile.sex ?? '').trim();
        const krebsart = String(zeile.cancer_type ?? '').trim();
        return {
            period: String(zeile.time_span ?? zeile.period ?? '').trim().replace(/\s*[–−-]\s*/g, '-'),
            age_group: String(zeile.age_group ?? '').trim().replace(/\s*[–−-]\s*/g, '-'),
            sex: GESCHLECHT_ZUORDNUNG[geschlecht] ?? geschlecht,
            cancer_type: GESAMT_KREBSARTEN.includes(krebsart) ? 'Alle Krebsarten' : krebsart,
            cases: zeile.incidence_cases !== undefined ? zeile.incidence_cases : zeile.cases,
            incidence_rate: zeile.incidence_rate,
            mortality_rate: zeile.mortality_rate
        };
    });
    return gesamtwerteErgaenzen(angepassteZeilen);
}

// Wir erstellen die drei Diagramme zuerst ohne Daten. Die Zahlen kommen später dazu
// type bestimmt die Diagrammart. In data stehen die Daten und in options die Einstellungen
function diagrammeErstellen() {
    // Das erste Diagramm zeigt Balken für die Altersgruppen
    diagramme.altersdiagramm = new Chart(document.querySelector('#altersdiagramm'), {
        type: 'bar',
        data: { labels: [], datasets: [] },
        options: {
            responsive: true, // Die Breite passt sich dem Bildschirm an
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { title: { display: true, text: 'Altersklasse (Jahre)' } },
                y: { beginAtZero: true, title: { display: true, text: 'Anzahl Neuerkrankungen' } }
            }
        }
    });
    // Das zweite Diagramm zeigt die Entwicklung über die Jahre als Linien
    diagramme.zeitdiagramm = new Chart(document.querySelector('#zeitdiagramm'), {
        type: 'line',
        data: { labels: [], datasets: [] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { title: { display: true, text: 'Fünfjahreszeitraum' } },
                // Beide Linien zeigen Werte pro 100'000 Personen. Darum reicht eine gemeinsame Skala
                y: { beginAtZero: true, title: { display: true, text: 'Pro 100’000 Einwohner:innen' } }
            }
        }
    });
    // Das dritte Diagramm zeigt die fünf häufigsten Krebsarten mit waagrechten Balken
    diagramme.krebsartendiagramm = new Chart(document.querySelector('#krebsartendiagramm'), {
        type: 'bar',
        data: { labels: [], datasets: [] },
        options: {
            indexAxis: 'y', // So stehen die Namen links und die Balken gehen nach rechts
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { beginAtZero: true, title: { display: true, text: 'Anzahl Fälle' } },
                y: { title: { display: true, text: 'Krebsart' } }
            }
        }
    });
}

// Unter jedem Diagramm zeigen wir die gleichen Zahlen nochmals als Tabelle
function tabelleAnzeigen(kennung, spalten, zeilen) {
    const tabelle = document.createElement('table');
    // Zuerst bauen wir die Zeile mit den Spaltennamen
    const kopf = document.createElement('thead');
    const kopfzeile = document.createElement('tr');
    spalten.forEach(spalte => {
        const zelle = document.createElement('th');
        zelle.scope = 'col';
        zelle.textContent = spalte;
        kopfzeile.appendChild(zelle);
    });
    kopf.appendChild(kopfzeile);
    tabelle.appendChild(kopf);
    // Danach füllen wir die Tabelle Zeile für Zeile mit den Zahlen
    const inhalt = document.createElement('tbody');
    zeilen.forEach(zeile => {
        const tabellenzeile = document.createElement('tr');
        zeile.forEach(wert => {
            const zelle = document.createElement('td');
            // Wenn eine Zahl fehlt, schreiben wir Keine Angabe. Eine fehlende Zahl ist nicht 0
            zelle.textContent = wert === null ? 'Keine Angabe' : wert;
            tabellenzeile.appendChild(zelle);
        });
        inhalt.appendChild(tabellenzeile);
    });
    tabelle.appendChild(inhalt);
    const behaelter = document.getElementById(kennung + '-tabelle');
    // Wir leeren die alte Tabelle und setzen die neue ein
    behaelter.textContent = '';
    behaelter.appendChild(tabelle);
}

// Hier zeigen wir die Daten für das ausgewählte Geschlecht
// filter behält passende Zeilen. Mit map holen wir die Namen oder Zahlen daraus
function render(kennung) {
    const geschlecht = auswahl[kennung];
    const diagramm = diagramme[kennung];
    let zeilen = [];
    let spalten = [];
    let tabellenwerte = [];

    // Für das erste Diagramm nehmen wir die Neuerkrankungen pro Altersgruppe
    if (kennung === 'altersdiagramm') {
        zeilen = daten.filter(zeile =>
            zeile.sex === geschlecht && zeile.period === AKTUELLER_ZEITRAUM &&
            zeile.cancer_type === 'Alle Krebsarten' && zeile.cases !== null
        );
        // Wir sortieren von jung nach alt. parseInt liest dafür die erste Zahl, z. B. 20 aus 20-29
        zeilen.sort((a, b) => parseInt(a.age_group) - parseInt(b.age_group));
        diagramm.data.labels = zeilen.map(zeile => zeile.age_group);
        diagramm.data.datasets = [{
            label: GESCHLECHTER[geschlecht],
            data: zeilen.map(zeile => zeile.cases),
            backgroundColor: zeilen.map(zeile => zeile.age_group === ZIELALTER ? ROTBRAUN : '#595959')
        }];
        spalten = ['Altersklasse', 'Neuerkrankungen'];
        tabellenwerte = zeilen.map(zeile => [zeile.age_group, zeile.cases]);
    }

    // Für den Verlauf nehmen wir die Werte der 20- bis 29-Jährigen aus allen Zeiträumen
    if (kennung === 'zeitdiagramm') {
        zeilen = daten.filter(zeile =>
            zeile.sex === geschlecht && zeile.age_group === ZIELALTER &&
            zeile.cancer_type === 'Alle Krebsarten' &&
            (zeile.incidence_rate !== null || zeile.mortality_rate !== null)
        );
        zeilen.sort((a, b) => parseInt(a.period) - parseInt(b.period));
        diagramm.data.labels = zeilen.map(zeile => zeile.period);
        diagramm.data.datasets = [
            { label: 'Inzidenz', data: zeilen.map(zeile => zeile.incidence_rate), borderColor: ROTBRAUN, backgroundColor: ROTBRAUN },
            { label: 'Mortalität', data: zeilen.map(zeile => zeile.mortality_rate), borderColor: ORANGE, backgroundColor: ORANGE, borderDash: [7, 5] }
        ];
        // Fehlende Zahlen bleiben in der Linie eine Lücke. Wir setzen dafür keine 0 ein
        spalten = ['Zeitraum', 'Inzidenz pro 100’000', 'Mortalität pro 100’000'];
        tabellenwerte = zeilen.map(zeile => [zeile.period, zeile.incidence_rate, zeile.mortality_rate]);
    }

    // Hier suchen wir die häufigsten Krebsarten bei den 20- bis 29-Jährigen
    if (kennung === 'krebsartendiagramm') {
        zeilen = daten.filter(zeile =>
            zeile.sex === geschlecht && zeile.period === AKTUELLER_ZEITRAUM &&
            zeile.age_group === ZIELALTER && zeile.cancer_type !== 'Alle Krebsarten' &&
            zeile.cases !== null
        );
        zeilen.sort((a, b) => b.cases - a.cases); // Die meisten Fälle kommen zuerst
        zeilen = zeilen.slice(0, 5); // Aus der sortierten Liste nehmen wir nur die ersten fünf
        diagramm.data.labels = zeilen.map(zeile => zeile.cancer_type);
        diagramm.data.datasets = [{
            label: GESCHLECHTER[geschlecht],
            data: zeilen.map(zeile => zeile.cases),
            backgroundColor: ROTBRAUN
        }];
        spalten = ['Krebsart', 'Anzahl Fälle'];
        tabellenwerte = zeilen.map(zeile => [zeile.cancer_type, zeile.cases]);
    }

    // Wenn passende Daten fehlen, blenden wir die Zeichenfläche des Diagramms aus
    const canvas = document.getElementById(kennung);
    canvas.parentElement.hidden = zeilen.length === 0;
    const titel = { altersdiagramm: 'Neuerkrankungen nach Altersklasse', zeitdiagramm: 'Inzidenz und Mortalität im Zeitverlauf', krebsartendiagramm: 'Die fünf häufigsten Krebsarten' };
    // Diese Beschreibung können Vorleseprogramme vorlesen
    canvas.setAttribute('aria-label', titel[kennung] + ' · ' + GESCHLECHTER[geschlecht]);
    // Wenn Daten fehlen, erscheint unter dem Diagramm ein Hinweis
    const status = document.getElementById(kennung + '-status');
    status.textContent = zeilen.length === 0 ? 'Für diese Auswahl fehlen passende Daten. Zeitraum, Altersgruppe und Bezeichnungen in der Datenbank prüfen.' : '';
    if (kennung === 'krebsartendiagramm' && zeilen.length === 0 && DATEN_URL === 'data.json') {
        status.textContent += ' Die Musterdatei enthält nur eine Beispielreihe für Frauen.';
    }
    tabelleAnzeigen(kennung, spalten, tabellenwerte);
    diagramm.update(); // Das vorhandene Diagramm zeigt jetzt die neuen Zahlen
}

// Hier legen wir fest, was beim Klick auf einen Geschlechter-Knopf passiert
function filterEinrichten(kennung) {
    const gruppe = document.querySelector('[data-filter-group="' + kennung + '"]');
    gruppe.querySelectorAll('button').forEach(knopf => {
        knopf.addEventListener('click', () => {
            // Wir merken uns, welches Geschlecht ausgewählt wurde
            auswahl[kennung] = knopf.dataset.value;
            // Nur der angeklickte Knopf soll als ausgewählt angezeigt werden
            gruppe.querySelectorAll('button').forEach(anderer => {
                const aktiv = anderer === knopf;
                anderer.classList.toggle('active', aktiv);
                anderer.setAttribute('aria-pressed', String(aktiv));
            });
            // Danach zeigen wir das Diagramm mit der neuen Auswahl
            render(kennung);
        });
    });
}

// Beim Öffnen der Seite laden wir die Daten und bereiten die Diagramme und Knöpfe vor
async function starten() {
    try {
        // fetch fragt die PHP-Datei an. Mit await warten wir auf die Antwort
        const antwort = await fetch(DATEN_URL);
        // Wenn der Server einen Fehler meldet, machen wir hier nicht weiter
        if (!antwort.ok) {
            throw new Error('HTTP-Status ' + antwort.status);
        }
        // Wir prüfen, ob die PHP-Datei wirklich Daten im JSON-Format liefert
        const contentType = antwort.headers.get('content-type') ?? '';
        if (!contentType.includes('application/json')) {
            throw new Error('Die Antwort ist kein JSON.');
        }
        // Hier lesen wir die Daten aus der Antwort
        daten = await antwort.json();
        // Wir erwarten eine Liste von Datenzeilen
        if (!Array.isArray(daten)) {
            throw new Error('Der Datenvertrag verlangt eine Liste von Datensätzen.');
        }
        daten = datenAnpassen(daten);
        // Ohne Chart.js können wir keine Diagramme zeichnen
        if (typeof Chart === 'undefined') {
            throw new Error('Chart.js konnte nicht geladen werden. Internetverbindung prüfen.');
        }
        diagrammeErstellen();
        ['altersdiagramm', 'zeitdiagramm', 'krebsartendiagramm'].forEach(kennung => {
            render(kennung);
            filterEinrichten(kennung);
        });
    } catch (fehler) {
        // Wenn etwas schiefgeht, zeigen wir eine Fehlermeldung statt leerer Diagramme
        document.querySelectorAll('.chart-container').forEach(element => { element.hidden = true; });
        document.querySelectorAll('.data-status').forEach(element => {
            element.textContent = 'Die Daten konnten nicht geladen werden. unload.php über einen PHP-Server öffnen und die Datenbankverbindung prüfen. (' + fehler.message + ')';
        });
        console.error(fehler); // Den Fehler sehen wir auch in der Browser-Konsole
    }
}
// Sobald diese Datei geladen ist, starten wir alles
starten();
