<?php

/**
 * Code-Along 08: CSV lesen (Extract) – Lösung
 *
 * Quelle -> PHP-Array von Datensätzen, diesmal aus einer echten CSV-Datei.
 */

header('Content-Type: text/plain; charset=utf-8');

// 1. CSV-Datei zum Lesen öffnen.
$handle = fopen('data/cancer.csv', 'r');

if ($handle === false) {
    die('CSV-Datei konnte nicht geöffnet werden.');
}

// 2. Kopfzeile (Spaltennamen) lesen und Leerzeichen entfernen.
$headerRow = fgetcsv($handle, null, ',', '"', '');

if ($headerRow === false) {
    die('CSV-Datei ist leer oder die Kopfzeile konnte nicht gelesen werden.');
}

$header = array_map('trim', $headerRow);

// 3. Die weiteren Zeilen schrittweise lesen.
//
// Wir speichern NICHT die gesamte CSV in $cases.
// Dadurch bleibt der Speicherverbrauch klein.
//
// Für die Kontrolle speichern wir nur die ersten 5 Datensätze.
$cases = [];

while (($row = fgetcsv($handle, null, ',', '"', '')) !== false) {

    // Leere Zeilen überspringen.
    if (($row[0] ?? '') === '') {
        continue;
    }

    // Spaltennamen mit den Werten verbinden.
    $case = array_combine($header, $row);

    // Nur die ersten 5 Datensätze für die Ausgabe speichern.

    $cases[] = $case;

}

fclose($handle);

// 4. Struktur prüfen.
//echo 'Spalten: ' . implode(', ', $header) . "\n";
//echo 'Anzahl gespeicherte Cases: ' . count($cases) . "\n\n";

// 5. Die ersten 5 Datensätze ausgeben.
//foreach ($cases as $a) {
  //  echo $a['Krebsart']
    //    . ': '
      //  . $a['Periode']
      //  . ' – '
        //. $a['Geschlecht']
    //    . "\n";
//}

return $cases;
