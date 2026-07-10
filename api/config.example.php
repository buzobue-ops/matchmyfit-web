<?php
/**
 * Copia questo file in config.php e compila i valori per Aruba.
 * config.php non va committato se contiene segreti reali.
 */
return [
    // Origini CORS consentite (oltre a same-origin)
    'allowed_origins' => [
        'http://localhost:5173',
        'https://zerodb.studio',
        'https://www.zerodb.studio',
    ],

    // URL pubblico dell'app (per OAuth callback in Google/Apple Console)
    'app_base_url' => 'https://www.zerodb.studio/matchmyfit',

    // Segreto per token sessione email (genera una stringa casuale lunga)
    'auth_secret' => 'CHANGE_ME',

    // MySQL Aruba — lascia vuoto per disabilitare history/auth/quota lato DB
    'db' => [
        'host' => 'localhost',
        'name' => 'matchmyfit',
        'user' => 'db_user',
        'pass' => 'db_password',
        'charset' => 'utf8mb4',
    ],

    // Webhook n8n (stessi URL del server Express)
    'n8n' => [
        'onboarding'      => 'https://buzobue.app.n8n.cloud/webhook/aa94f233-cc9b-416f-8cbf-a7c5fae268c4',
        'check_account'   => 'https://buzobue.app.n8n.cloud/webhook/ea2e6b62-1998-4f9a-8c1f-3cd7409319c3',
        'link_page'       => 'https://buzobue.app.n8n.cloud/webhook/ed39425a-e716-4273-adf5-a8e7779d19bf',
        'profile_update'  => 'https://buzobue.app.n8n.cloud/webhook/matchmyfit-profile-update',
        'feedback'        => 'https://buzobue.app.n8n.cloud/webhook/matchmyfit-feedback',
        'outfit'          => 'https://buzobue.app.n8n.cloud/webhook/0c23a3b1-895b-471a-a4eb-140c49c1b111',
    ],

    // Solo host n8n consentiti per /api/resume (anti-SSRF)
    'n8n_allowed_host' => 'buzobue.app.n8n.cloud',

    'free_analysis_limit' => 2,
];
