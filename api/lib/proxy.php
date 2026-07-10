<?php

declare(strict_types=1);

function proxy_json(string $targetUrl, array $body, int $timeoutSec = 30): array
{
    $ch = curl_init($targetUrl);
    $payload = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER => true,
        CURLOPT_TIMEOUT => $timeoutSec,
        CURLOPT_FOLLOWLOCATION => false,
    ]);

    $raw = curl_exec($ch);
    if ($raw === false) {
        $err = curl_error($ch);
        curl_close($ch);
        return ['status' => 500, 'headers' => [], 'body' => ['error' => $err]];
    }

    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $headerSize = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    curl_close($ch);

    $headerRaw = substr($raw, 0, $headerSize);
    $bodyRaw = substr($raw, $headerSize);

    $headers = [];
    foreach (explode("\r\n", $headerRaw) as $line) {
        if (strpos($line, ':') === false) {
            continue;
        }
        [$name, $value] = explode(':', $line, 2);
        $headers[strtolower(trim($name))] = trim($value);
    }

    $decoded = json_decode($bodyRaw, true);
    if (!is_array($decoded)) {
        $decoded = ['raw' => $bodyRaw];
    }

    return ['status' => $status, 'headers' => $headers, 'body' => $decoded];
}

function emit_proxy_response(array $result): void
{
    $forward = ['photofoldername', 'content-type'];
    foreach ($forward as $h) {
        if (!empty($result['headers'][$h])) {
            if ($h === 'content-type') {
                header('Content-Type: ' . $result['headers'][$h]);
            } else {
                header('PhotoFolderName: ' . $result['headers'][$h]);
            }
        }
    }
    send_json($result['status'] ?: 502, $result['body']);
}
