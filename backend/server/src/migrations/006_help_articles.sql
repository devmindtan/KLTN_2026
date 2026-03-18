-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 006: Bảng help_articles cho hệ thống tài liệu hướng dẫn CMS
-- Tất cả dùng IF NOT EXISTS — idempotent, an toàn khi chạy lại nhiều lần
-- KHÔNG chứa INSERT / seed data
-- ─────────────────────────────────────────────────────────────────────────────

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ help_articles — Bài viết tài liệu hướng dẫn (CMS 3-lớp)                │
-- └──────────────────────────────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS help_articles (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    section_key  VARCHAR(100) NOT NULL UNIQUE,  -- Khóa định danh URL (?doc=section_key)
    parent_key   VARCHAR(100) DEFAULT NULL,     -- NULL = section gốc
    type         VARCHAR(20)  NOT NULL DEFAULT 'document' CHECK (type IN ('document', 'question')),
    title        TEXT         NOT NULL,
    summary      TEXT         NOT NULL DEFAULT '',  -- Lớp 1: tóm tắt 1 câu
    content      TEXT         NOT NULL DEFAULT '',  -- Lớp 2: Markdown giải thích
    tech_detail  TEXT         DEFAULT NULL,         -- Lớp 3: Markdown kỹ thuật (collapsible)
    sort_order   INTEGER      DEFAULT 0,
    is_published BOOLEAN      DEFAULT TRUE,
    created_at   TIMESTAMPTZ  DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_help_articles_parent_key
    ON help_articles(parent_key);

CREATE INDEX IF NOT EXISTS idx_help_articles_sort_order
    ON help_articles(sort_order);
