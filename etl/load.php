<?php

header('Content-Type: text/plain; charset=utf-8');

require __DIR__ . '/../config.php';

$result = include __DIR__ . '/transform.php';
$rows = $result['data'];

echo 'Der Transform liefert ' . count($rows) . " Zeilen.\n\n";

// ---------------------------------------------------------------------------
// TODO 4: Verbindung aufbauen
// ---------------------------------------------------------------------------
//
// Wortgleich wie in Code-Along 11. Wenn dieser Teil dort lief, läuft er hier.

try {
    $pdo = new PDO($dsn, $username, $password, $options);
    echo "Verbindung steht.\n\n";
} catch (PDOException $e) {
    exit('Verbindung fehlgeschlagen: ' . $e->getMessage() . "\n");
}
