<?php

declare(strict_types=1);

function hash_password(string $password): string
{
    $salt = bin2hex(random_bytes(16));
    $hash = hash_pbkdf2('sha256', $password, $salt, 100000, 64);
    return $salt . ':' . $hash;
}

function verify_password(string $password, string $stored): bool
{
    if ($stored === '' || !str_contains($stored, ':')) {
        return false;
    }
    [$salt, $hash] = explode(':', $stored, 2);
    if ($salt === '' || $hash === '') {
        return false;
    }
    $test = hash_pbkdf2('sha256', $password, $salt, 100000, 64);
    return hash_equals($hash, $test);
}

function make_session_token(string $userId, string $secret): string
{
    $payload = $userId . ':' . (string) (int) (microtime(true) * 1000);
    $sig = hash_hmac('sha256', $payload, $secret);
    return rtrim(strtr(base64_encode($payload . ':' . $sig), '+/', '-_'), '=');
}

function profile_from_row(array $row): array
{
    return [
        'id' => $row['user_id'],
        'userId' => $row['user_id'],
        'email' => $row['email'],
        'username' => $row['username'],
        'displayName' => $row['display_name'] ?: $row['username'],
        'authProvider' => 'email',
        'height' => isset($row['height']) ? (float) $row['height'] : null,
        'bodySizes' => [
            'height' => isset($row['height']) ? (float) $row['height'] : null,
            'chest' => isset($row['chest']) ? (float) $row['chest'] : null,
            'waist' => isset($row['waist']) ? (float) $row['waist'] : null,
            'hips' => isset($row['hips']) ? (float) $row['hips'] : null,
            'shoulders' => isset($row['shoulders']) ? (float) $row['shoulders'] : null,
            'inseam' => isset($row['inseam']) ? (float) $row['inseam'] : null,
        ],
        'onboardingStep' => 2,
        'createdAt' => $row['created_at'] ?? null,
    ];
}

function lookup_email_user(?PDO $pdo, ?string $providerUserId, ?string $email): ?array
{
    if (!$pdo) {
        return null;
    }
    if ($providerUserId) {
        $stmt = $pdo->prepare('SELECT * FROM email_users WHERE user_id = ? LIMIT 1');
        $stmt->execute([$providerUserId]);
        $row = $stmt->fetch();
        if ($row) {
            return $row;
        }
    }
    if ($email) {
        $stmt = $pdo->prepare('SELECT * FROM email_users WHERE LOWER(email) = LOWER(?) LIMIT 1');
        $stmt->execute([trim($email)]);
        $row = $stmt->fetch();
        if ($row) {
            return $row;
        }
    }
    return null;
}

function proxy_onboarding(string $url, array $body, int $timeoutSec = 60): ?array
{
    $result = proxy_json($url, $body, $timeoutSec);
    return $result['body'] ?? null;
}

function sync_email_user_to_n8n(string $onboardingUrl, array $user, ?string $imageBase64): void
{
    $userId = $user['user_id'];
    $measurements = [
        'height' => isset($user['height']) ? (float) $user['height'] : null,
        'chest' => isset($user['chest']) ? (float) $user['chest'] : null,
        'waist' => isset($user['waist']) ? (float) $user['waist'] : null,
        'hips' => isset($user['hips']) ? (float) $user['hips'] : null,
        'shoulders' => isset($user['shoulders']) ? (float) $user['shoulders'] : null,
        'inseam' => isset($user['inseam']) ? (float) $user['inseam'] : null,
    ];
    $ts = gmdate('c');

    proxy_onboarding($onboardingUrl, [
        'step' => 'username',
        'userId' => $userId,
        'username' => $user['username'],
        'timestamp' => $ts,
    ], 15);

    proxy_onboarding($onboardingUrl, [
        'step' => 'measurements',
        'userId' => $userId,
        'measurements' => $measurements,
        'timestamp' => $ts,
        'source' => 'ios_manual_register',
    ], 30);

    if ($imageBase64) {
        proxy_onboarding($onboardingUrl, [
            'step' => 'photo',
            'userId' => $userId,
            'imageBase64' => $imageBase64,
            'imageSizeBytes' => (int) round((strlen($imageBase64) * 3) / 4),
            'timestamp' => $ts,
        ], 90);
    }

    $profile = profile_from_row($user);
    proxy_onboarding($onboardingUrl, [
        'step' => 'complete',
        'userId' => $userId,
        'profile' => [
            'userId' => $userId,
            'username' => $user['username'],
            'email' => $user['email'],
            'displayName' => $user['display_name'] ?: $user['username'],
            'authProvider' => 'email',
            'createdAt' => $user['created_at'] ?? $ts,
            'height' => $profile['height'],
            'bodySizes' => $profile['bodySizes'],
        ],
        'timestamp' => $ts,
    ], 30);
}

// Rate limiting in-memory (per processo PHP-FPM)
$GLOBALS['_rate_buckets'] = $GLOBALS['_rate_buckets'] ?? [];

function rate_limited(string $key, int $maxHits, int $windowMs): bool
{
    $now = (int) (microtime(true) * 1000);
    $bucket = $GLOBALS['_rate_buckets'][$key] ?? null;
    if (!$bucket || $now > $bucket['resetAt']) {
        $GLOBALS['_rate_buckets'][$key] = ['hits' => 1, 'resetAt' => $now + $windowMs];
        return false;
    }
    $GLOBALS['_rate_buckets'][$key]['hits']++;
    return $GLOBALS['_rate_buckets'][$key]['hits'] > $maxHits;
}
