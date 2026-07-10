-- Schema MySQL per MatchMyFit (migrazione da PostgreSQL Railway)
-- Esegui una volta sul database Aruba.

CREATE TABLE IF NOT EXISTS searches (
  id               VARCHAR(64) PRIMARY KEY,
  user_id          VARCHAR(64) NOT NULL,
  product_link     TEXT,
  product_name     TEXT,
  response_text    MEDIUMTEXT,
  image_url        TEXT,
  price            DECIMAL(12,2),
  recommended_size VARCHAR(32),
  status           VARCHAR(32) DEFAULT 'pending',
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX searches_user_id_idx (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS usage_quotas (
  user_id              VARCHAR(64) PRIMARY KEY,
  email                VARCHAR(255),
  usage_count          INT DEFAULT 0,
  subscribed           TINYINT(1) DEFAULT 0,
  subscription_expires DATETIME NULL,
  updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS email_users (
  user_id       VARCHAR(64) PRIMARY KEY,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  username      VARCHAR(128) NOT NULL,
  display_name  VARCHAR(255),
  height        DECIMAL(8,2),
  chest         DECIMAL(8,2),
  waist         DECIMAL(8,2),
  hips          DECIMAL(8,2),
  shoulders     DECIMAL(8,2),
  inseam        DECIMAL(8,2),
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY email_users_email_uq (email),
  INDEX email_users_email_idx (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
