-- Migration: Menambahkan kolom status ke tabel creators agar kompatibel dengan operasi creator insert/promote
ALTER TABLE creators ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
