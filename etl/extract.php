<?php

/**
 * Extract: CSV zeilenweise lesen.
 *
 * Statt alle Zeilen in einem Array zu sammeln, liefert diese Datei einen
 * Generator. transform.php kann ihn mit foreach durchlaufen wie ein Array,
 * aber es liegt immer nur EINE Zeile im Speicher.
 */

header('Content-Type: text/plain; charset=utf-8');

return (function () {
    // 1. CSV-Datei zum Lesen öffnen.
    $handle = fopen(__DIR__ . '/data/cancer.csv', 'r');

    if ($handle === false) {
        die('CSV-Datei konnte nicht geöffnet werden.');
    }

    // 2. Kopfzeile lesen; Leerzeichen und ein allfälliges UTF-8-BOM entfernen.
    $headerRow = fgetcsv($handle, null, ',', '"', '');

    if ($headerRow === false) {
        die('CSV-Datei ist leer oder die Kopfzeile konnte nicht gelesen werden.');
    }

    $header = array_map(fn($h) => trim($h, " \t\n\r\0\x0B\xEF\xBB\xBF"), $headerRow);

    // 3. Zeile für Zeile lesen und einzeln weitergeben (yield).
    while (($row = fgetcsv($handle, null, ',', '"', '')) !== false) {

        // Leere Zeilen überspringen.
        if (($row[0] ?? '') === '') {
            continue;
        }

        // Zeilen mit falscher Spaltenanzahl überspringen
        // (array_combine wirft sonst in PHP 8 einen Fehler).
        if (count($row) !== count($header)) {
            continue;
        }

        yield array_combine($header, $row);

    }

    fclose($handle);
})();