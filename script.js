// Diese PHP-Datei liefert uns die Daten für die Diagramme
const DATEN_URL = 'unload.php';



// Diese Zeitspanne und Altersgruppe verwenden wir für unsere Auswertung
const AKTUELLER_ZEITRAUM = '2018-2022';
const ZIELALTER = '20-29';
const MAX_NEUERKRANKUNGEN_UNTER_50 = 4000;
const GESCHLECHTER = { total: 'Beide Geschlechter', female: 'Frauen', male: 'Männer', comparison: 'Frauen & Männer' };
const ROSA = '#f3b6a6';
const BLAU = '#a9b4ff';



// Hier speichern wir später die Daten, die wir von PHP bekommen
let daten = [];
let datenHinweis = '';

// Die ersten zwei Diagramme starten mit beiden Geschlechtern, das dritte mit Frauen
const auswahl = { altersdiagramm: 'total', zeitdiagramm: 'comparison', krebsartendiagramm: 'female' };
let alter50Plus = true;

// Hier merken wir uns die Diagramme. So müssen wir sie nicht bei jedem Klick neu erstellen
const diagramme = {};



// In den Daten kann zum Beispiel Frauen stehen. Unser Code nennt das female
// Mit dieser Liste ordnen wir die verschiedenen Namen einander zu
const GESCHLECHT_ZUORDNUNG = new Map([
    ['Frauen', 'female'], ['Weiblich', 'female'], ['Männer', 'male'], ['Männlich', 'male'],
    ['Beide Geschlechter', 'total'], ['Total', 'total'], ['Insgesamt', 'total'],
    ['total', 'total'], ['female', 'female'], ['male', 'male']
]);
const GESAMT_KREBSARTEN = ['Alle Krebsarten', 'Alle Krebsarten (C00-C97)', 'Alle Krebsarten (total) (C00-C97*)', 'Total', 'Insgesamt'];
const GESCHLECHTSSPEZIFISCHE_KREBSARTEN = new Map([
    ['Eierstockkrebs (C56)', 'female'],
    ['Gebärmutterhalskrebs (C53)', 'female'],
    ['Gebärmutterkörperkrebs (C54-C55)', 'female'],
    ['Hodenkrebs (C62)', 'male'],
    ['Prostatakrebs (C61)', 'male']
]);

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
        if (vorhandeneZeilen.length < 2 && GESCHLECHTSSPEZIFISCHE_KREBSARTEN.get(vorlage.cancer_type) !== vorlage.sex) {
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
            mortality_cases: vorhandeneZeilen.every(zeile => Number.isFinite(zeile.mortality_cases))
                ? Math.round(vorhandeneZeilen.reduce((summe, zeile) => summe + zeile.mortality_cases, 0) * 10000) / 10000
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
            sex: GESCHLECHT_ZUORDNUNG.get(geschlecht) ?? geschlecht,
            cancer_type: GESAMT_KREBSARTEN.includes(krebsart) ? 'Alle Krebsarten' : krebsart,
            cases: zeile.incidence_cases !== undefined ? zeile.incidence_cases : zeile.cases,
            mortality_cases: Number.isFinite(zeile.mortality_cases) ? zeile.mortality_cases : null,
            incidence_rate: zeile.incidence_rate,
            mortality_rate: zeile.mortality_rate
        };
    });
    return gesamtwerteErgaenzen(angepassteZeilen);
}

function altersSkalaMaximum(diagrammdaten) {
    if (!alter50Plus) {
        return MAX_NEUERKRANKUNGEN_UNTER_50;
    }
    const summen = diagrammdaten.labels.map((altersklasse, index) =>
        diagrammdaten.datasets.reduce((summe, datensatz) => summe + (datensatz.data[index]?.cases ?? 0), 0));
    const hoechsterWert = Math.max(6000, ...summen);
    return Math.ceil(hoechsterWert * 1.05 / 1000) * 1000;
}

function ratenVerhaeltnis(zeile) {
    if (!Number.isFinite(zeile?.incidence_rate) || zeile.incidence_rate <= 0 ||
        !Number.isFinite(zeile.mortality_rate) || zeile.mortality_rate < 0) {
        return null;
    }
    const verhaeltnis = zeile.mortality_rate / zeile.incidence_rate * 100;
    return Number.isFinite(verhaeltnis) ? verhaeltnis : null;
}

function prozentBeschriften(wert) {
    return wert === null ? null : wert.toLocaleString('de-CH', { maximumFractionDigits: 1 }) + ' %';
}

function krebsartBeschriften(achse, wert) {
    const bezeichnung = achse.getLabelForValue(wert).replace(
        'Krebs des Gehirns und Zentralnervensystems (ZNS)', 'Gehirn- und ZNS-Krebs'
    );
    const maximaleBreite = Math.min(220, Math.max(150, achse.chart.width / 2)) - 40;
    const kontext = achse.ctx;
    kontext.save();
    kontext.font = window['Chart']['helpers']['toFont'](achse.options.ticks.font)['string'];
    const zeilen = [];
    let zeile = '';
    for (const wort of bezeichnung.split(' ')) {
        const erweitert = zeile ? zeile + ' ' + wort : wort;
        if (zeile && kontext.measureText(erweitert).width > maximaleBreite) {
            zeilen.push(zeile);
            zeile = wort;
        } else {
            zeile = erweitert;
        }
    }
    zeilen.push(zeile);
    kontext.restore();
    return zeilen;
}

// type bestimmt die Diagrammart. In data stehen die Daten und in options die Einstellungen
function diagrammErstellen(kennung, diagrammdaten) {
    const Chart = window['Chart'];
    if (typeof Chart !== 'function') {
        throw new Error('Chart.js konnte nicht geladen werden. Seite neu laden.');
    }
    let konfiguration;
    // Das erste Diagramm zeigt Balken für die Altersgruppen
    if (kennung === 'altersdiagramm') {
        konfiguration = {
            type: 'bar',
            data: diagrammdaten,
            plugins: [{
                id: 'zielalterHintergrund',
                beforeDraw(diagramm) {
                    // Nur bei beiden Geschlechtern die Spalte für 20–29 Jahre heller hinterlegen.
                    if (auswahl.altersdiagramm !== 'total') {
                        return;
                    }
                    const index = diagramm.data.labels.indexOf(ZIELALTER);
                    const { ctx, chartArea, scales: { x } } = diagramm;
                    if (index < 0 || !chartArea) {
                        return;
                    }
                    const links = Math.max(chartArea.left, x.getPixelForValue(index - 0.5));
                    const rechts = Math.min(chartArea.right, x.getPixelForValue(index + 0.5));
                    ctx.save();
                    ctx.fillStyle = 'rgba(255, 244, 241, 0.1)';
                    ctx.fillRect(links, chartArea.top, rechts - links, chartArea.bottom - chartArea.top);
                    ctx.restore();
                }
            }],
            options: {
                responsive: true, // Die Breite passt sich dem Bildschirm an
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: auswahl.altersdiagramm === 'total' },
                    tooltip: {
                        callbacks: {
                            label: kontext => {
                                const anteil = kontext.chart.data.datasets.length === 2 && kontext.raw.gesamt > 0
                                    ? ' (' + prozentBeschriften(kontext.raw.cases / kontext.raw.gesamt * 100) + ')'
                                    : '';
                                return kontext.dataset.label + ': ' + kontext.raw.cases + anteil;
                            },
                            footer: eintraege => {
                                const eintrag = eintraege[0];
                                return eintrag?.chart.data.datasets.length === 2 && Number.isFinite(eintrag.raw.gesamt)
                                    ? 'Gesamt: ' + eintrag.raw.gesamt
                                    : '';
                            }
                        }
                    }
                },
                scales: {
                    x: { stacked: true, title: { display: true, text: 'Altersklasse (Jahre)' } },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        max: altersSkalaMaximum(diagrammdaten),
                        ticks: { stepSize: 1000 },
                        title: { display: true, text: 'Anzahl Neuerkrankungen' }
                    }
                }
            }
        };
    }
    // Das zweite Diagramm zeigt die Entwicklung über die Jahre als Linien
    if (kennung === 'zeitdiagramm') {
        konfiguration = {
            type: 'line',
            data: diagrammdaten,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: kontext => kontext.dataset.label + ': ' +
                                (kontext.dataset.yAxisID === 'verhaeltnis'
                                    ? prozentBeschriften(kontext.parsed.y)
                                    : kontext.formattedValue + ' pro 100’000')
                        }
                    }
                },
                scales: {
                    x: { title: { display: true, text: 'Fünfjahreszeitraum' } },
                    y: { beginAtZero: true, title: { display: true, text: 'Pro 100’000 Einwohner:innen' } },
                    verhaeltnis: {
                        axis: 'y',
                        type: 'linear',
                        position: 'right',
                        beginAtZero: true,
                        suggestedMax: 20,
                        grid: { drawOnChartArea: false },
                        ticks: { callback: prozentBeschriften },
                        title: { display: true, text: 'Mortalität / Inzidenz (%)' }
                    }
                }
            }
        };
    }
    // Das dritte Diagramm zeigt die fünf häufigsten Krebsarten mit waagrechten Balken
    if (kennung === 'krebsartendiagramm') {
        konfiguration = {
            type: 'bar',
            data: diagrammdaten,
            options: {
                indexAxis: 'y', // So stehen die Namen links und die Balken gehen nach rechts
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', axis: 'y', intersect: false },
                plugins: {
                    legend: { display: true },
                    tooltip: {
                        callbacks: {
                            label: kontext => kontext.dataset.label + ': ' + kontext.formattedValue + ' pro Jahr'
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        suggestedMax: 120,
                        ticks: { stepSize: 20 },
                        title: { display: true, text: 'Anzahl pro Jahr' }
                    },
                    y: {
                        afterFit: achse => {
                            achse.width = Math.min(220, Math.max(150, achse.chart.width / 2));
                            achse.paddingTop = 0;
                            achse.paddingBottom = 0;
                        },
                        ticks: {
                            autoSkip: false,
                            callback: function(wert) { return krebsartBeschriften(this, wert); }
                        },
                        title: { display: true, text: 'Krebsart' }
                    }
                }
            }
        };
    }
    // Canvas-Texte und Hilfslinien übernehmen die hellen Farben der Seite.
    const canvas = document.getElementById(kennung);
    const farben = window.getComputedStyle(canvas.closest('.card'));
    const textfarbe = farben.getPropertyValue('--text').trim();
    const linienfarbe = farben.getPropertyValue('--border').trim();
    konfiguration.options.color = textfarbe;
    konfiguration.options.plugins.legend = {
        ...konfiguration.options.plugins.legend,
        labels: { color: textfarbe }
    };
    Object.values(konfiguration.options.scales).forEach(achse => {
        achse.ticks = { ...achse.ticks, color: textfarbe };
        achse.title = { ...achse.title, color: textfarbe };
        achse.grid = { ...achse.grid, color: linienfarbe, tickColor: linienfarbe };
        achse.border = { color: linienfarbe };
    });
    konfiguration.options.animation = false;
    diagramme[kennung] = new Chart(canvas, konfiguration);
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
function render(kennung, erstellen = false) {
    const geschlecht = auswahl[kennung];
    const diagramm = diagramme[kennung];
    const diagrammdaten = { labels: [], datasets: [] };
    let zeilen = [];
    let spalten = [];
    let tabellenwerte = [];

    // Für das erste Diagramm nehmen wir die Neuerkrankungen pro Altersgruppe
    if (kennung === 'altersdiagramm') {
        const geschlechter = geschlecht === 'total' ? ['female', 'male'] : [geschlecht];
        zeilen = daten.filter(zeile =>
            geschlechter.includes(zeile.sex) && zeile.period === AKTUELLER_ZEITRAUM &&
            zeile.cancer_type === 'Alle Krebsarten' && zeile.cases !== null &&
            (alter50Plus || parseInt(zeile.age_group, 10) < 50)
        );
        // Wir sortieren von jung nach alt. parseInt liest dafür die erste Zahl, z. B. 20 aus 20-29
        zeilen.sort((a, b) => parseInt(a.age_group) - parseInt(b.age_group));
        diagrammdaten.labels = [...new Set(zeilen.map(zeile => zeile.age_group))];
        const werte = new Map(diagrammdaten.labels.map(altersklasse => [altersklasse, {}]));
        zeilen.forEach(zeile => {
            werte.get(zeile.age_group)[zeile.sex] = zeile.cases;
        });
        const alterswerte = diagrammdaten.labels.map(altersklasse => {
            const frauen = werte.get(altersklasse).female ?? null;
            const maenner = werte.get(altersklasse).male ?? null;
            return {
                altersklasse,
                female: frauen,
                male: maenner,
                gesamt: Number.isFinite(frauen) && Number.isFinite(maenner)
                    ? Math.round((frauen + maenner) * 10000) / 10000
                    : null
            };
        });
        diagrammdaten.datasets = geschlechter.map(ausgewaehltesGeschlecht => ({
            label: GESCHLECHTER[ausgewaehltesGeschlecht],
            stack: 'geschlechter',
            data: alterswerte.map(alterswert => ({
                x: alterswert.altersklasse,
                y: alterswert[ausgewaehltesGeschlecht],
                cases: alterswert[ausgewaehltesGeschlecht],
                gesamt: alterswert.gesamt
            })),
            backgroundColor: geschlecht === 'total'
                ? (ausgewaehltesGeschlecht === 'female' ? ROSA : BLAU)
                : alterswerte.map(alterswert => alterswert.altersklasse === ZIELALTER ? ROSA : '#d5ccca')
        }));
        spalten = geschlecht === 'total'
            ? ['Altersklasse', 'Frauen', 'Männer', 'Gesamt']
            : ['Altersklasse', 'Neuerkrankungen'];
        tabellenwerte = alterswerte.map(alterswert => geschlecht === 'total'
            ? [alterswert.altersklasse, alterswert.female, alterswert.male, alterswert.gesamt]
            : [alterswert.altersklasse, alterswert[geschlecht]]);
    }

    // Für den Verlauf nehmen wir die Werte der 20- bis 29-Jährigen aus allen Zeiträumen
    if (kennung === 'zeitdiagramm') {
        const geschlechter = ['female', 'male'];
        zeilen = daten.filter(zeile =>
            geschlechter.includes(zeile.sex) && zeile.age_group === ZIELALTER &&
            zeile.cancer_type === 'Alle Krebsarten' &&
            (zeile.incidence_rate !== null || zeile.mortality_rate !== null)
        );
        zeilen.sort((a, b) => parseInt(a.period) - parseInt(b.period));
        const zeitraeume = [...new Set(zeilen.map(zeile => zeile.period))];
        diagrammdaten.labels = zeitraeume;
        diagrammdaten.datasets = geschlechter.flatMap(ausgewaehltesGeschlecht => {
            const werte = new Map(zeilen.filter(zeile => zeile.sex === ausgewaehltesGeschlecht)
                .map(zeile => [zeile.period, zeile]));
            const bezeichnung = GESCHLECHTER[ausgewaehltesGeschlecht] + ' · ';
            const farbe = ausgewaehltesGeschlecht === 'male' ? BLAU : ROSA;
            return [
                {
                    label: bezeichnung + 'Inzidenz',
                    data: zeitraeume.map(zeitraum => werte.get(zeitraum)?.incidence_rate ?? null),
                    borderColor: farbe, backgroundColor: farbe
                },
                {
                    label: bezeichnung + 'Mortalität',
                    data: zeitraeume.map(zeitraum => werte.get(zeitraum)?.mortality_rate ?? null),
                    borderColor: farbe, backgroundColor: farbe, borderDash: [7, 5]
                },
                {
                    label: bezeichnung + 'Verhältnis (%)',
                    data: zeitraeume.map(zeitraum => ratenVerhaeltnis(werte.get(zeitraum))),
                    yAxisID: 'verhaeltnis',
                    borderColor: farbe,
                    backgroundColor: farbe,
                    borderDash: [2, 4],
                    pointStyle: 'triangle'
                }
            ];
        });
        // Fehlende Zahlen bleiben in der Linie eine Lücke. Wir setzen dafür keine 0 ein
        spalten = ['Zeitraum', ...geschlechter.flatMap(ausgewaehltesGeschlecht => {
            const bezeichnung = GESCHLECHTER[ausgewaehltesGeschlecht] + ' · ';
            return [bezeichnung + 'Inzidenz pro 100’000', bezeichnung + 'Mortalität pro 100’000',
                bezeichnung + 'Mortalität / Inzidenz (%)'];
        })];
        tabellenwerte = zeitraeume.map(zeitraum => [zeitraum, ...geschlechter.flatMap(ausgewaehltesGeschlecht => {
            const zeile = zeilen.find(zeile => zeile.sex === ausgewaehltesGeschlecht && zeile.period === zeitraum);
            return [zeile?.incidence_rate ?? null, zeile?.mortality_rate ?? null,
                prozentBeschriften(ratenVerhaeltnis(zeile))];
        })]);
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
        diagrammdaten.labels = zeilen.map(zeile => zeile.cancer_type);
        diagrammdaten.datasets = [
            {
                label: 'Neuerkrankungen',
                data: zeilen.map(zeile => zeile.cases),
                backgroundColor: ROSA
            },
            {
                label: 'Todesfälle (Mortalität)',
                data: zeilen.map(zeile => zeile.mortality_cases),
                backgroundColor: BLAU
            }
        ];
        spalten = ['Krebsart', 'Neuerkrankungen pro Jahr', 'Todesfälle pro Jahr'];
        tabellenwerte = zeilen.map(zeile => [zeile.cancer_type, zeile.cases, zeile.mortality_cases]);
    }

    // Wenn passende Daten fehlen, blenden wir die Zeichenfläche des Diagramms aus
    const canvas = document.getElementById(kennung);
    canvas.parentElement.hidden = zeilen.length === 0;
    const titel = { altersdiagramm: 'Neuerkrankungen nach Altersklasse', zeitdiagramm: 'Inzidenz und Mortalität im Zeitverlauf', krebsartendiagramm: 'Neuerkrankungen und Todesfälle der fünf häufigsten Krebsarten' };
    // Diese Beschreibung können Vorleseprogramme vorlesen
    canvas.setAttribute('aria-label', titel[kennung] + ' · ' + GESCHLECHTER[geschlecht]);
    // Wenn Daten fehlen, erscheint unter dem Diagramm ein Hinweis
    const status = document.getElementById(kennung + '-status');
    status.textContent = zeilen.length === 0 ? 'Für diese Auswahl fehlen passende Daten. Zeitraum, Altersgruppe und Bezeichnungen in der Datenbank prüfen.' : datenHinweis;
    if (kennung === 'krebsartendiagramm' && zeilen.length === 0 && DATEN_URL === 'data.json') {
        status.textContent += ' Die Musterdatei enthält nur eine Beispielreihe für Frauen.';
    }
    tabelleAnzeigen(kennung, spalten, tabellenwerte);
    if (diagramm) {
        diagramm.data = diagrammdaten;
        if (kennung === 'altersdiagramm') {
            diagramm.options.scales.y.max = altersSkalaMaximum(diagrammdaten);
            diagramm.options.plugins.legend.display = geschlecht === 'total';
        }
        diagramm.update(); // Das vorhandene Diagramm zeigt jetzt die neuen Zahlen
    } else if (erstellen && zeilen.length > 0) {
        diagrammErstellen(kennung, diagrammdaten);
    }
}

function diagrammAnimationEinrichten() {
    // Die Daten sind von Anfang an sichtbar. Die Animation ergänzt nur den ersten Bildaufbau.
    if (!('IntersectionObserver' in window)) {
        return;
    }

    const beobachter = new IntersectionObserver(eintraege => {
        eintraege.forEach(eintrag => {
            if (!eintrag.isIntersecting) {
                return;
            }
            const canvas = eintrag.target.querySelector('canvas');
            const diagramm = canvas && diagramme[canvas.id];
            if (!diagramm) {
                return;
            }
            beobachter.unobserve(eintrag.target);
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                return;
            }

            diagramm.options.animation = { duration: 2400, easing: 'easeOutQuart' };
            diagramm.reset();
            diagramm.update();
        });
    }, { threshold: 0.1 });

    ['altersdiagramm', 'zeitdiagramm', 'krebsartendiagramm'].forEach(kennung => {
        const canvas = document.getElementById(kennung);
        if (canvas) {
            beobachter.observe(canvas.parentElement);
        }
    });
}

// Hier legen wir fest, was beim Klick auf einen Geschlechter-Knopf passiert
function altersfilterEinrichten() {
    const knopf = document.getElementById('alter-50-plus');
    if (!knopf) {
        return;
    }
    knopf.addEventListener('click', () => {
        alter50Plus = !alter50Plus;
        knopf.classList.toggle('active', alter50Plus);
        knopf.setAttribute('aria-pressed', String(alter50Plus));
        render('altersdiagramm');
    });
}

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

function datenKopieLaden(ladefehler) {
    const sicherung = document.getElementById('diagramm-daten-sicherung');
    if (!sicherung) {
        throw ladefehler ?? new Error('Die gespeicherte Datenkopie fehlt.');
    }
    const kopie = JSON.parse(sicherung.textContent);
    if (!Array.isArray(kopie.zeilen) || kopie.zeilen.length === 0) {
        throw ladefehler ?? new Error('Die gespeicherte Datenkopie ist leer.');
    }
    datenHinweis = 'Gespeicherte Originaldatenkopie.';
    return datenAnpassen(kopie.zeilen);
}

async function datenLaden() {
    datenHinweis = '';
    // Beim direkten Öffnen der HTML-Datei kann der Browser kein PHP ausführen.
    if (window.location.protocol === 'file:') {
        return datenKopieLaden();
    }
    try {
        const antwort = await fetch(DATEN_URL);
        if (!antwort.ok) {
            throw new Error('HTTP-Status ' + antwort.status);
        }
        const contentType = antwort.headers.get('content-type') ?? '';
        if (!contentType.includes('application/json')) {
            throw new Error('Die Antwort ist kein JSON.');
        }
        const zeilen = await antwort.json();
        if (!Array.isArray(zeilen) || zeilen.length === 0) {
            throw new Error('Der Datenvertrag verlangt eine nicht leere Liste von Datensätzen.');
        }
        return datenAnpassen(zeilen);
    } catch (fehler) {
        return datenKopieLaden(fehler);
    }
}

// Beim Öffnen der Seite laden wir die Daten und bereiten die Diagramme und Knöpfe vor
async function starten() {
    try {
        daten = await datenLaden();
        if (typeof window['Chart'] !== 'function') {
            throw new Error('Chart.js konnte nicht geladen werden. Seite neu laden.');
        }
        ['altersdiagramm', 'zeitdiagramm', 'krebsartendiagramm'].forEach(kennung => {
            render(kennung, true);
            filterEinrichten(kennung);
        });

        altersfilterEinrichten();
        diagrammAnimationEinrichten();

    } catch (fehler) {
        // Wenn etwas schiefgeht, zeigen wir eine Fehlermeldung statt leerer Diagramme
        document.querySelectorAll('.chart-container').forEach(element => { element.hidden = true; });
        document.querySelectorAll('.data-status').forEach(element => {
            element.textContent = 'Die Daten konnten nicht geladen werden. unload.php über einen PHP-Server öffnen und die Datenbankverbindung prüfen. (' + fehler.message + ')';
        });
        console.error(fehler); // Den Fehler sehen wir auch in der Browser-Konsole
    }
}
function grafikNavigationEinrichten() {
    const links = [...document.querySelectorAll('.grafik-navigation a')];
    const grafiken = links.map(link => document.getElementById(link.hash.slice(1)));
    let bildAngefordert = false;

    function navigationAktualisieren() {
        bildAngefordert = false;
        let aktuelleGrafik = null;
        grafiken.forEach((grafik, index) => {
            if (grafik && grafik.getBoundingClientRect().top <= window.innerHeight * 0.4) {
                aktuelleGrafik = links[index];
            }
        });
        links.forEach(link => {
            if (link === aktuelleGrafik) {
                link.setAttribute('aria-current', 'location');
            } else {
                link.removeAttribute('aria-current');
            }
        });
    }

    function navigationAnfordern() {
        if (!bildAngefordert) {
            bildAngefordert = true;
            window.requestAnimationFrame(navigationAktualisieren);
        }
    }

    window.addEventListener('scroll', navigationAnfordern, { passive: true });
    window.addEventListener('resize', navigationAnfordern);
    navigationAktualisieren();
}

function introBereich(fortschritt, start, ende) {
    return Math.max(0, Math.min(1, (fortschritt - start) / (ende - start)));
}

// Die Illustrationen erscheinen beim Scrollen; Lisa trinkt Kaffee oder schließt im Krankenhaus müde die Augen.
function lisaIllustrationEinrichten() {
    document.querySelectorAll('.lisa-illustration, .lisa-krankenhaus-illustration, .lisa-abschluss-illustration').forEach(illustration => {
        const bewegung = window.matchMedia('(prefers-reduced-motion: reduce)');
        const ablaeufe = [
            { animationen: illustration.querySelectorAll('.lisa-auge > animateTransform'), pause: 3000, variation: 2000, dauer: 220 },
            { animationen: illustration.querySelectorAll('[data-lisa-animation="schluerfen"]'), erstePause: 2100, pause: 3000, variation: 0, dauer: 3200 },
            { animationen: illustration.querySelectorAll('[data-lisa-animation="krankenhaus-ruhen"]'), erstePause: 2600, pause: 4500, variation: 2000, dauer: 1150 },
            { animationen: illustration.querySelectorAll('[data-lisa-animation="abschluss-blinzeln"]'), erstePause: 2300, pause: 3000, variation: 1800, dauer: 380 }
        ];
        let sichtbar = false;

        function animationPlanen(ablauf, ersteRunde = false) {
            window.clearTimeout(ablauf.zeitgeber);
            ablauf.animationen.forEach(animation => animation.endElement());
            if (ablauf.animationen.length === 0 || !sichtbar || document.hidden || bewegung.matches) {
                return;
            }

            // Der erste Schluck folgt dem Einblenden; danach wiederholt er sich regelmäßig.
            const pause = ersteRunde ? (ablauf.erstePause ?? ablauf.pause) : ablauf.pause;
            ablauf.zeitgeber = window.setTimeout(() => {
                ablauf.animationen.forEach(animation => animation.beginElement());
                ablauf.zeitgeber = window.setTimeout(() => animationPlanen(ablauf), ablauf.dauer);
            }, pause + Math.random() * ablauf.variation);
        }

        function animationenPlanen() {
            ablaeufe.forEach(ablauf => animationPlanen(ablauf, true));
        }

        illustration.classList.add('lisa-animiert');
        const beobachter = new IntersectionObserver(eintraege => {
            const nunSichtbar = eintraege[0].isIntersecting;
            if (nunSichtbar === sichtbar) {
                return;
            }
            sichtbar = nunSichtbar;
            if (sichtbar) {
                illustration.classList.add('lisa-sichtbar');
            }
            animationenPlanen();
        }, { threshold: 0, rootMargin: '0px' });

        beobachter.observe(illustration);
        bewegung.addEventListener('change', animationenPlanen);
        document.addEventListener('visibilitychange', animationenPlanen);
    });
}

function introEinrichten() {
    const bereich = document.getElementById('dna-intro');
    const video = document.querySelector('video#dna-video');
    if (!bereich || !video) {
        return;
    }

    const buehne = bereich.querySelector('.dna-stage');
    const titel = document.getElementById('dna-title');
    const zaehler = document.getElementById('dna-counter');
    const zahl = document.getElementById('dna-number');
    const frage = document.getElementById('dna-question');
    const hinweis = document.getElementById('dna-hint');
    const abdunklung = document.getElementById('dna-shade');
    const bewegung = window.matchMedia('(prefers-reduced-motion: reduce)');
    let gewuenschteZeit = 0;
    let bildAngefordert = false;

    function videoAktualisieren() {
        if (!Number.isFinite(video.duration) || video.seeking) {
            return;
        }
        if (Math.abs(video.currentTime - gewuenschteZeit) > 0.04) {
            video.currentTime = gewuenschteZeit;
        }
    }

    function introAktualisieren() {
        bildAngefordert = false;
        const scrollstrecke = Math.max(1, bereich.offsetHeight - buehne.offsetHeight);
        const fortschritt = bewegung.matches ? 0 : Math.max(0, Math.min(1,
            -bereich.getBoundingClientRect().top / scrollstrecke));
        const ausblenden = introBereich(fortschritt, 0.01, 0.06);
        titel.style.opacity = String(1 - ausblenden);
        titel.style.transform = 'scale(' + (1 + ausblenden * 0.4) + ')';
        hinweis.style.opacity = String(1 - introBereich(fortschritt, 0, 0.04));
        video.style.transform = 'scale(' + (1 + introBereich(fortschritt, 0, 0.5) * 0.6) + ')';
        abdunklung.style.opacity = String(introBereich(fortschritt, 0.04, 0.1) * 0.45);

        zaehler.style.opacity = String(introBereich(fortschritt, 0.06, 0.1) *
            (1 - introBereich(fortschritt, 0.7, 0.75)));
        zahl.textContent = String(Math.round(100 - 80 * introBereich(fortschritt, 0.1, 0.58)));
        const frageSichtbar = introBereich(fortschritt, 0.74, 0.8);
        frage.style.opacity = String(frageSichtbar);
        frage.style.transform = 'translateY(' + ((1 - frageSichtbar) * 30) + 'px)';

        if (Number.isFinite(video.duration)) {
            gewuenschteZeit = introBereich(fortschritt, 0, 0.8) * Math.max(0, video.duration - 0.05);
            videoAktualisieren();
        }
    }

    function introAnfordern() {
        if (!bildAngefordert) {
            bildAngefordert = true;
            window.requestAnimationFrame(introAktualisieren);
        }
    }

    function videoFreigeben() {
        void video.play().then(() => {
            video.pause();
            introAnfordern();
        }).catch(() => { introAnfordern(); });
    }

    bereich.classList.add('dna-aktiv');
    video.addEventListener('loadeddata', introAnfordern);
    video.addEventListener('seeked', videoAktualisieren);
    window.addEventListener('scroll', introAnfordern, { passive: true });
    window.addEventListener('resize', introAnfordern);
    window.addEventListener('touchstart', videoFreigeben, { once: true, passive: true });
    bewegung.addEventListener('change', introAnfordern);
    introAktualisieren();
}

// Die Diagramme starten unabhängig von den dekorativen Animationen.
void starten();
introEinrichten();
lisaIllustrationEinrichten();
grafikNavigationEinrichten();
