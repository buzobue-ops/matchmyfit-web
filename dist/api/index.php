<?php

declare(strict_types=1);

require __DIR__ . '/lib/bootstrap.php';
require __DIR__ . '/lib/proxy.php';
require __DIR__ . '/lib/db.php';
require __DIR__ . '/lib/auth.php';

$config = load_config();
apply_cors($config);

/** @param array<string, string> $params */
function build_oauth_query(array $params, string $provider): string
{
    $parts = [];
    foreach (['code', 'id_token', 'state'] as $key) {
        if (!empty($params[$key])) {
            $parts[] = rawurlencode($key) . '=' . rawurlencode((string) $params[$key]);
        }
    }
    $parts[] = 'provider=' . rawurlencode($provider);
    return implode('&', $parts);
}

$pdo = db_connect($config);
if ($pdo) {
    db_init($pdo);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = request_path();
$n8n = $config['n8n'];

// ─── Email auth ───────────────────────────────────────────────────────────

if ($method === 'POST' && $path === '/auth/register') {
    if (!$pdo) {
        send_json(503, ['error' => 'Database unavailable']);
    }
    if (rate_limited('reg:' . client_ip(), 10, 15 * 60 * 1000)) {
        send_json(429, ['error' => 'Troppi tentativi. Riprova tra qualche minuto.']);
    }

    $body = json_body();
    $email = strtolower(trim((string) ($body['email'] ?? '')));
    $password = (string) ($body['password'] ?? '');
    $username = trim((string) ($body['username'] ?? ''));
    $displayName = trim((string) ($body['displayName'] ?? $username));

    if ($email === '' || !str_contains($email, '@')) {
        send_json(400, ['error' => 'Email non valida']);
    }
    if (strlen($password) < 8) {
        send_json(400, ['error' => 'La password deve avere almeno 8 caratteri']);
    }
    if ($username === '') {
        send_json(400, ['error' => 'Username obbligatorio']);
    }
    if (!isset($body['height']) || (float) $body['height'] <= 0) {
        send_json(400, ['error' => 'Altezza obbligatoria']);
    }

    $exists = $pdo->prepare('SELECT 1 FROM email_users WHERE LOWER(email) = ?');
    $exists->execute([$email]);
    if ($exists->fetch()) {
        send_json(409, ['error' => 'Email già registrata']);
    }

    $userId = sprintf(
        '%s-%s-%s-%s-%s',
        bin2hex(random_bytes(4)),
        bin2hex(random_bytes(2)),
        bin2hex(random_bytes(2)),
        bin2hex(random_bytes(2)),
        bin2hex(random_bytes(6))
    );

    $stmt = $pdo->prepare(
        'INSERT INTO email_users
         (user_id, email, password_hash, username, display_name, height, chest, waist, hips, shoulders, inseam)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)'
    );
    $stmt->execute([
        $userId,
        $email,
        hash_password($password),
        $username,
        $displayName,
        (float) $body['height'],
        isset($body['chest']) ? (float) $body['chest'] : null,
        isset($body['waist']) ? (float) $body['waist'] : null,
        isset($body['hips']) ? (float) $body['hips'] : null,
        isset($body['shoulders']) ? (float) $body['shoulders'] : null,
        isset($body['inseam']) ? (float) $body['inseam'] : null,
    ]);

    $rowStmt = $pdo->prepare('SELECT * FROM email_users WHERE user_id = ?');
    $rowStmt->execute([$userId]);
    $user = $rowStmt->fetch();
    $token = make_session_token($userId, $config['auth_secret'] ?? 'matchmyfit-dev-secret');
    $response = [
        'userId' => $userId,
        'email' => $email,
        'username' => $user['username'],
        'displayName' => $user['display_name'],
        'token' => $token,
        'profile' => profile_from_row($user),
    ];

    http_response_code(201);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    } else {
        if (ob_get_level() > 0) {
            ob_end_flush();
        }
        flush();
    }

    try {
        sync_email_user_to_n8n($n8n['onboarding'], $user, $body['imageBase64'] ?? null);
    } catch (Throwable $e) {
        error_log('[auth/register] n8n sync: ' . $e->getMessage());
    }
    exit;
}

if ($method === 'POST' && $path === '/auth/login') {
    if (!$pdo) {
        send_json(503, ['error' => 'Database unavailable']);
    }

    $body = json_body();
    $email = strtolower(trim((string) ($body['email'] ?? '')));
    $password = (string) ($body['password'] ?? '');

    if ($email === '' || $password === '') {
        send_json(400, ['error' => 'Email e password obbligatorie']);
    }
    if (rate_limited('login:' . client_ip(), 20, 15 * 60 * 1000)
        || rate_limited('login:' . $email, 10, 15 * 60 * 1000)) {
        send_json(429, ['error' => 'Troppi tentativi. Riprova tra qualche minuto.']);
    }

    $stmt = $pdo->prepare('SELECT * FROM email_users WHERE LOWER(email) = ? LIMIT 1');
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    if (!$user || !verify_password($password, $user['password_hash'])) {
        send_json(401, ['error' => 'Email o password non corretti']);
    }

    send_json(200, [
        'userId' => $user['user_id'],
        'email' => $user['email'],
        'username' => $user['username'],
        'displayName' => $user['display_name'],
        'token' => make_session_token($user['user_id'], $config['auth_secret'] ?? 'matchmyfit-dev-secret'),
        'profile' => profile_from_row($user),
    ]);
}

// ─── n8n proxies ──────────────────────────────────────────────────────────

if ($method === 'POST' && $path === '/check-account') {
    $body = json_body();
    if (($body['authProvider'] ?? '') === 'email' && $pdo) {
        $row = lookup_email_user($pdo, $body['providerUserId'] ?? null, $body['email'] ?? null);
        if ($row) {
            $profile = profile_from_row($row);
            send_json(200, [
                'exists' => true,
                'step' => 2,
                'username' => $profile['username'],
                'user' => $profile,
            ]);
        }
        send_json(200, ['exists' => false]);
    }
    emit_proxy_response(proxy_json($n8n['check_account'], $body, 15));
}

if ($method === 'POST' && $path === '/onboarding') {
    emit_proxy_response(proxy_json($n8n['onboarding'], json_body(), 60));
}

if ($method === 'POST' && $path === '/resume') {
    $resumeUrl = $_GET['resumeUrl'] ?? '';
    if ($resumeUrl === '') {
        send_json(400, ['error' => 'Missing resumeUrl']);
    }
    $host = parse_url($resumeUrl, PHP_URL_HOST);
    if ($host !== ($config['n8n_allowed_host'] ?? 'buzobue.app.n8n.cloud')) {
        send_json(400, ['error' => 'Invalid resumeUrl']);
    }
    emit_proxy_response(proxy_json($resumeUrl, json_body(), 300));
}

if ($method === 'POST' && $path === '/profile-update') {
    emit_proxy_response(proxy_json($n8n['profile_update'], json_body(), 30));
}

if ($method === 'POST' && $path === '/search') {
    emit_proxy_response(proxy_json($n8n['link_page'], json_body(), 300));
}

if ($method === 'POST' && $path === '/feedback') {
    emit_proxy_response(proxy_json($n8n['feedback'], json_body(), 10));
}

if ($method === 'POST' && $path === '/outfit') {
    $body = json_body();
    $searchId = 'outfit_' . (string) (int) (microtime(true) * 1000) . '_' . substr(bin2hex(random_bytes(3)), 0, 5);
    $outfitBody = [
        'userId' => $body['userId'] ?? null,
        'searchId' => $searchId,
        'top' => $body['links']['top'] ?? null,
        'mid' => $body['links']['mid'] ?? null,
        'bottom' => $body['links']['bottom'] ?? null,
    ];
    emit_proxy_response(proxy_json($n8n['outfit'], $outfitBody, 300));
}

// ─── OAuth relay (HTTPS → matchmyfit://) ────────────────────────────────────

if ($path === '/oauth/callback') {
    $params = $method === 'POST'
        ? array_merge($_GET, $_POST)
        : $_GET;
    $error = $params['error'] ?? null;
    if ($error) {
        header('Location: matchmyfit://oauth?error=' . rawurlencode((string) $error));
        exit;
    }
    $provider = $method === 'POST' ? 'apple' : 'google';
    header('Location: matchmyfit://oauth?' . build_oauth_query($params, $provider));
    exit;
}

// ─── Image proxy ──────────────────────────────────────────────────────────

if ($method === 'GET' && $path === '/image-proxy') {
    $url = $_GET['url'] ?? '';
    if ($url === '' || !str_starts_with($url, 'https://drive.google.com/')) {
        http_response_code(400);
        echo 'Invalid URL';
        exit;
    }
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_USERAGENT => 'Mozilla/5.0',
    ]);
    $data = curl_exec($ch);
    $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE) ?: 'image/jpeg';
    curl_close($ch);
    if ($data === false) {
        http_response_code(502);
        echo 'Image proxy error';
        exit;
    }
    header('Content-Type: ' . $contentType);
    header('Cache-Control: public, max-age=86400');
    echo $data;
    exit;
}

// ─── Search history ───────────────────────────────────────────────────────

if ($method === 'GET' && $path === '/history') {
    $userId = $_GET['userId'] ?? '';
    if ($userId === '' || !$pdo) {
        send_json(200, []);
    }
    $stmt = $pdo->prepare(
        'SELECT id, user_id, product_link, product_name, response_text,
                image_url, price, recommended_size, status, created_at
         FROM searches WHERE user_id = ?
         ORDER BY created_at DESC LIMIT 200'
    );
    $stmt->execute([$userId]);
    $rows = array_map(static function (array $r): array {
        return [
            'id' => $r['id'],
            'userId' => $r['user_id'],
            'productLink' => $r['product_link'],
            'productName' => $r['product_name'],
            'responseText' => $r['response_text'],
            'responseImageUrl' => $r['image_url'],
            'productPrice' => $r['price'] !== null ? (float) $r['price'] : null,
            'recommendedSize' => $r['recommended_size'],
            'status' => $r['status'],
            'createdAt' => $r['created_at'],
        ];
    }, $stmt->fetchAll());
    send_json(200, $rows);
}

if ($method === 'POST' && $path === '/history') {
    if (!$pdo) {
        send_json(200, ['ok' => true]);
    }
    $r = json_body();
    if (empty($r['id']) || empty($r['userId'])) {
        send_json(400, ['error' => 'Missing id or userId']);
    }
    if (($r['status'] ?? '') === 'pending') {
        send_json(200, ['ok' => true]);
    }
    $stmt = $pdo->prepare(
        'INSERT INTO searches
           (id, user_id, product_link, product_name, response_text, image_url, price, recommended_size, status)
         VALUES (?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           product_name = VALUES(product_name),
           response_text = VALUES(response_text),
           image_url = VALUES(image_url),
           price = VALUES(price),
           recommended_size = VALUES(recommended_size),
           status = VALUES(status),
           updated_at = CURRENT_TIMESTAMP'
    );
    $stmt->execute([
        $r['id'],
        $r['userId'],
        $r['productLink'] ?? null,
        $r['productName'] ?? null,
        $r['responseText'] ?? null,
        $r['responseImageUrl'] ?? null,
        $r['productPrice'] ?? null,
        $r['recommendedSize'] ?? null,
        $r['status'] ?? 'completed',
    ]);
    send_json(200, ['ok' => true]);
}

if ($method === 'DELETE' && preg_match('#^/history/([^/]+)$#', $path, $m)) {
    if ($pdo) {
        $stmt = $pdo->prepare('DELETE FROM searches WHERE id = ?');
        $stmt->execute([$m[1]]);
    }
    send_json(200, ['ok' => true]);
}

if ($method === 'DELETE' && $path === '/history') {
    $userId = $_GET['userId'] ?? '';
    if ($pdo && $userId !== '') {
        $stmt = $pdo->prepare('DELETE FROM searches WHERE user_id = ?');
        $stmt->execute([$userId]);
    }
    send_json(200, ['ok' => true]);
}

// ─── Freemium quota (MySQL locale, come Express) ──────────────────────────

$freeLimit = (int) ($config['free_analysis_limit'] ?? 2);

if ($method === 'POST' && $path === '/quota/check') {
    $body = json_body();
    $userId = $body['userId'] ?? '';
    $email = $body['email'] ?? null;
    if ($userId === '') {
        send_json(400, ['error' => 'Missing userId']);
    }
    if (!$pdo) {
        send_json(200, [
            'allowed' => true,
            'usageCount' => 0,
            'freeLimit' => $freeLimit,
            'freeUsesRemaining' => $freeLimit,
            'hasSubscription' => false,
        ]);
    }

    $stmt = $pdo->prepare('SELECT usage_count, subscribed, subscription_expires FROM usage_quotas WHERE user_id = ?');
    $stmt->execute([$userId]);
    $row = $stmt->fetch();
    $usage = 0;
    $subscribed = false;
    if ($row) {
        $usage = (int) $row['usage_count'];
        $subscribed = (bool) $row['subscribed'];
        if (!empty($row['subscription_expires']) && strtotime($row['subscription_expires']) < time()) {
            $subscribed = false;
        }
    } elseif ($email) {
        $ins = $pdo->prepare('INSERT IGNORE INTO usage_quotas (user_id, email) VALUES (?, ?)');
        $ins->execute([$userId, $email]);
    }
    $remaining = max(0, $freeLimit - $usage);
    send_json(200, [
        'allowed' => $subscribed || $remaining > 0,
        'usageCount' => $usage,
        'freeLimit' => $freeLimit,
        'freeUsesRemaining' => $subscribed ? 0 : $remaining,
        'hasSubscription' => $subscribed,
    ]);
}

if ($method === 'POST' && $path === '/quota/record') {
    $body = json_body();
    $userId = $body['userId'] ?? '';
    if ($userId === '') {
        send_json(400, ['error' => 'Missing userId']);
    }
    if (!$pdo) {
        send_json(200, ['ok' => true]);
    }
    $stmt = $pdo->prepare(
        'INSERT INTO usage_quotas (user_id, email, usage_count)
         VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE
           email = COALESCE(VALUES(email), email),
           usage_count = IF(subscribed = 1, usage_count, usage_count + 1),
           updated_at = CURRENT_TIMESTAMP'
    );
    $stmt->execute([$userId, $body['email'] ?? null]);
    send_json(200, ['ok' => true]);
}

if ($method === 'POST' && $path === '/subscription/sync') {
    $body = json_body();
    $userId = $body['userId'] ?? '';
    if ($userId === '') {
        send_json(400, ['error' => 'Missing userId']);
    }
    if (!$pdo) {
        send_json(200, ['ok' => true]);
    }
    $stmt = $pdo->prepare(
        'INSERT INTO usage_quotas (user_id, email, subscribed, subscription_expires)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           email = COALESCE(VALUES(email), email),
           subscribed = VALUES(subscribed),
           subscription_expires = VALUES(subscription_expires),
           updated_at = CURRENT_TIMESTAMP'
    );
    $stmt->execute([
        $userId,
        $body['email'] ?? null,
        !empty($body['subscribed']) ? 1 : 0,
        $body['expiresAt'] ?? null,
    ]);
    send_json(200, ['ok' => true]);
}

send_json(404, ['error' => 'Not found']);
