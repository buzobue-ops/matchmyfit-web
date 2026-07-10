<?php

declare(strict_types=1);

function db_connect(array $config): ?PDO
{
    $db = $config['db'] ?? [];
    if (empty($db['name']) || empty($db['user'])) {
        return null;
    }

    $dsn = sprintf(
        'mysql:host=%s;dbname=%s;charset=%s',
        $db['host'] ?? 'localhost',
        $db['name'],
        $db['charset'] ?? 'utf8mb4'
    );

    try {
        $pdo = new PDO($dsn, $db['user'], $db['pass'] ?? '', [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        return $pdo;
    } catch (PDOException $e) {
        error_log('[db] connect error: ' . $e->getMessage());
        return null;
    }
}

function db_init(PDO $pdo): void
{
    $sql = file_get_contents(dirname(__DIR__) . '/schema.sql');
    if ($sql === false) {
        return;
    }
    foreach (array_filter(array_map('trim', explode(';', $sql))) as $stmt) {
        if ($stmt === '' || str_starts_with($stmt, '--')) {
            continue;
        }
        try {
            $pdo->exec($stmt);
        } catch (PDOException $e) {
            error_log('[db] init: ' . $e->getMessage());
        }
    }
}
