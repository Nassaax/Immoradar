-- ══════════════════════════════════════════════════════════
--  Liège Immo Radar — Schéma base de données
--  Copiez-collez CE TEXTE dans Supabase > SQL Editor > Run
-- ══════════════════════════════════════════════════════════

-- Table des annonces
CREATE TABLE IF NOT EXISTS listings (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id    TEXT        NOT NULL,
  agency_name  TEXT        NOT NULL,
  agency_url   TEXT        NOT NULL,
  title        TEXT        NOT NULL,
  description  TEXT,
  address      TEXT,
  city         TEXT,
  price        INTEGER,
  price_text   TEXT,
  type         TEXT        DEFAULT 'other',
  status       TEXT        DEFAULT 'sale',
  photos       JSONB       DEFAULT '[]',
  url          TEXT        NOT NULL UNIQUE,
  url_hash     TEXT        NOT NULL UNIQUE,
  bedrooms     INTEGER,
  surface      INTEGER,
  is_new       BOOLEAN     DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Table des abonnés aux alertes email
CREATE TABLE IF NOT EXISTS subscribers (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT        NOT NULL UNIQUE,
  filters     JSONB       DEFAULT '{}',
  active      BOOLEAN     DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Accès en lecture pour tout le monde (dashboard)
ALTER TABLE listings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lecture_publique" ON listings    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "acces_service"    ON listings    FOR ALL   TO service_role         USING (true) WITH CHECK (true);
CREATE POLICY "inscription"      ON subscribers FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "service_sub"      ON subscribers FOR ALL   TO service_role         USING (true) WITH CHECK (true);
