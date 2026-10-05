<?php
/**
 * Load: Krebsdaten (BFS / NKRS) in die Datenbank schreiben
 *
 * Datenfluss dieser Datei:
 *
 *   alle Zeilen aus dem Transform                 (aus transform.php)
 *     -> eine Zeile pro Krebsart in cancer_types   (suchen, sonst anlegen)
 *       -> alle Zeilen in cancer_data        (prepare einmal, execute oft)
 *
 * Untersuchungseinheit = eine Zeile in cancer_date:
 *   eine Krebsart × Geschlecht × Periode × Altersgruppe
 *
 * Der Wert, der sich in fast jeder Zeile wiederholt, ist die Krebsart
 * (z. B. «Alle Krebsarten (total) (C00-C97*)»). Darum steht sie genau einmal
 * in einer eigenen Tabelle cancer_types; cancer_data verweist mit dem
 * Fremdschlüssel cancer_type_id darauf.
 *
 * Die Tabellen werden einmal von Hand in phpMyAdmin angelegt (Reiter «SQL»):
 *
 *   CREATE TABLE cancer_types (
 *     id   INT AUTO_INCREMENT PRIMARY KEY,
 *     name VARCHAR(150) NOT NULL UNIQUE
 *   );
 *
 *   CREATE TABLE cancer_data (
 *     id              INT AUTO_INCREMENT PRIMARY KEY,
 *     cancer_type_id  INT NOT NULL,
 *     gender          VARCHAR(20) NOT NULL,
 *     time_span       VARCHAR(20) NOT NULL,
 *     age_group       VARCHAR(10) NOT NULL,
 *     incidence_rate  DECIMAL(10,4) NOT NULL,
 *     mortality_rate  DECIMAL(10,4) NOT NULL,
 *     incidence_cases DECIMAL(12,4) NOT NULL,
 *     mortality_cases DECIMAL(12,4) NOT NULL,
 *     FOREIGN KEY (cancer_type_id) REFERENCES cancer_types(id)
 *   );
 *
 * Anders als Extract und Transform gibt diese Datei nichts zurück. Ihr
 * Ergebnis steht nach dem Aufruf in der Datenbank und bleibt dort.
 */

// ---------------------------------------------------------------------------
// 1: Ausgabe als reiner Text
// ---------------------------------------------------------------------------
//
// load.php ist ein Werkzeug und keine Webseite. Sie läuft, wenn neue Daten
// in die Datenbank sollen.

header('Content-Type: text/plain; charset=utf-8');

// ---------------------------------------------------------------------------
// 2: Zugangsdaten laden
// ---------------------------------------------------------------------------
//
// Die eine config.php im Hauptordner (steht in .gitignore!). Sie liefert
// $dsn, $username, $password und $options.
// Anzahl «/..» an eure Ordnerstruktur anpassen.

require __DIR__ . '/../config.php';

// ---------------------------------------------------------------------------
// 3: Das Ergebnis des Transforms holen
// ---------------------------------------------------------------------------
//
// transform.php liegt im selben Ordner und gibt ein Array mit rules, data und
// audit zurück. In die Datenbank schreiben wir nur data – rules und audit sind
// Begleitpapiere für Menschen, keine Messwerte.

$result = include __DIR__ . '/transform.php';
$rows = $result['data'];

echo 'Der Transform liefert ' . count($rows) . " Zeilen.\n\n";

// ---------------------------------------------------------------------------
// 4: Verbindung aufbauen
// ---------------------------------------------------------------------------

try {
    $pdo = new PDO($dsn, $username, $password, $options);
    echo "Verbindung steht.\n\n";
} catch (PDOException $e) {
    exit('Verbindung fehlgeschlagen: ' . $e->getMessage() . "\n");
}

// ---------------------------------------------------------------------------
// 5: Krebsarten suchen, sonst anlegen
// ---------------------------------------------------------------------------
//
// Im Transform steht «Lunge, Bronchien, Luftröhre (C33-C34)», in
// cancer_data braucht es die Nummer dieser Krebsart.
// Muster: «suchen, sonst anlegen».

$findCancerType = $pdo->prepare('SELECT id FROM cancer_types WHERE name = ?');
$insertCancerType = $pdo->prepare('INSERT INTO cancer_types (name) VALUES (?)');

// $cancerTypeIds ist ein Merkzettel: Krebsart => id. Ohne ihn liefe die
// Abfrage für jede einzelne Zeile statt nur einmal pro Krebsart.
$cancerTypeIds = [];

foreach ($rows as $row) {
    $cancerType = $row['cancer_type'];

    // Schon nachgeschlagen? Dann sofort weiter zur nächsten Zeile.
    if (isset($cancerTypeIds[$cancerType])) {
        continue;
    }

    // fetchColumn() holt den ersten Wert der ersten gefundenen Zeile.
    // Gibt es keine Zeile, liefert es false.
    $findCancerType->execute([$cancerType]);
    $id = $findCancerType->fetchColumn();

    // === false ist genau: Mit == sähe die Zahl 0 wie «nicht gefunden» aus.
    if ($id === false) {
        $insertCancerType->execute([$cancerType]);

        // lastInsertId() gibt die Nummer zurück, die die Datenbank gerade
        // vergeben hat. Sie kommt als Text, deshalb unten (int).
        $id = $pdo->lastInsertId();
    }

    $cancerTypeIds[$cancerType] = (int) $id;
}

echo count($cancerTypeIds) . " Krebsarten in der Datenbank:\n  - "
    . implode("\n  - ", array_keys($cancerTypeIds)) . "\n\n";

// ---------------------------------------------------------------------------
// 6: Alten Stand löschen
// ---------------------------------------------------------------------------
//
// INSERT fragt nicht, ob es die Zeile schon gibt. Ohne diese Zeile stünde
// nach dem zweiten Aufruf jeder Wert doppelt in der Tabelle.
//
// Wir dürfen hier löschen, weil die BFS-CSV ein historischer Datensatz ist,
// der jedes Mal vollständig kommt («Stand neu schreiben»). Bei einer
// Live-Sammlung wäre das fatal – dort bräuchte es UNIQUE + INSERT IGNORE.
//
// cancer_types bleibt stehen: cancer_data verweist mit dem statistics
// Fremdschlüssel darauf.

$deleted = $pdo->exec('DELETE FROM cancer_data');
echo $deleted . " alte Zeilen gelöscht.\n\n";

// ---------------------------------------------------------------------------
// 7: Alle Zeilen schreiben
// ---------------------------------------------------------------------------
//
// prepare() steht vor der Schleife und läuft genau einmal (der Bauplan).
// execute() steht in der Schleife und schickt nur noch die Werte.
//
// Hier wird nichts mehr umgerechnet oder geprüft – das hat der Transform
// erledigt (Region, Altersgruppen, gewichtete Raten, Rundung).

$insertStatistic = $pdo->prepare(
    'INSERT INTO cancer_data
        (cancer_type_id, gender, time_span, age_group,
         incidence_rate, mortality_rate, incidence_cases, mortality_cases)
     VALUES
        (:cancer_type_id, :gender, :time_span, :age_group,
         :incidence_rate, :mortality_rate, :incidence_cases, :mortality_cases)'
);

foreach ($rows as $row) {
    $insertStatistic->execute([
        'cancer_type_id'  => $cancerTypeIds[$row['cancer_type']],
        'gender'          => $row['gender'],
        'time_span'       => $row['time_span'],
        'age_group'       => $row['age_group'],
        'incidence_rate'  => $row['incidence_rate'],
        'mortality_rate'  => $row['mortality_rate'],
        'incidence_cases' => $row['incidence_cases'],
        'mortality_cases' => $row['mortality_cases'],
    ]);
}

echo count($rows) . " Zeilen geschrieben.\n\n";

// ---------------------------------------------------------------------------
// 8: Kontrolle
// ---------------------------------------------------------------------------
//
// Zählen allein genügt nicht: Die Zahl wäre auch dann richtig, wenn in jeder
// Zeile Unsinn stünde. Deshalb lesen wir zusätzlich ein paar Werte zurück.
//
// query() reicht für den ersten Befehl, weil darin kein eigener Wert steckt.
// Sobald einer hineinkommt – wie die cancer_type_id unten –, gilt wieder
// prepare() und execute().

$total = $pdo->query('SELECT COUNT(*) FROM cancer_data')->fetchColumn();
echo "In cancer_data stehen jetzt {$total} Zeilen.\n\n";

// Pro Krebsart: die drei zuletzt geschriebenen Zeilen (höchste id).
$lastStatistics = $pdo->prepare(
    'SELECT gender, time_span, age_group, incidence_rate, mortality_rate,
            incidence_cases, mortality_cases
     FROM cancer_data
     WHERE cancer_type_id = ?
     ORDER BY id DESC
     LIMIT 3'
);

foreach ($cancerTypeIds as $cancerType => $cancerTypeId) {
    echo $cancerType . ":\n";

    $lastStatistics->execute([$cancerTypeId]);

    foreach ($lastStatistics->fetchAll() as $statistic) {
        echo '  ' . $statistic['gender'] . "\t"
            . $statistic['time_span'] . "\t"
            . $statistic['age_group'] . "\t"
            . 'Inzidenz ' . $statistic['incidence_rate'] . "\t"
            . 'Mortalität ' . $statistic['mortality_rate'] . "\t"
            . 'Fälle ' . $statistic['incidence_cases'] . ' / '
            . $statistic['mortality_cases'] . "\n";
    }
}
