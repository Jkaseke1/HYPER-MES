-- Sage UAT's actual latest manufacturing-process reference is MFP010402.
-- Advance MES to the next usable Sage reference without ever moving it backward.
INSERT INTO batch_sequences (prefix, year, next_sequence)
VALUES ('MFP', 0, 10403)
ON CONFLICT (prefix, year) DO UPDATE
SET next_sequence = GREATEST(batch_sequences.next_sequence, EXCLUDED.next_sequence),
    updated_at = NOW();
