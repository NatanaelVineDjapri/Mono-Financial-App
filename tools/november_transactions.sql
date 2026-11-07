-- Transaksi November 2026 untuk MONO Finance
-- Load setelah sample_data.sql sudah di-load
-- Kategori: 1=Food&drink, 2=Transport, 3=Shopping, 4=Bills, 5=Health, 6=Leisure, 11=Salary, 12=Freelance

BEGIN;

-- Income November: Gaji + Freelance (adjusted ke angka lebih kecil)
INSERT INTO transactions (id, kind, account_id, currency, to_account_id, to_currency, category_id, amount, amount_to, amount_idr, occurred_on, description, note, source, created_at, updated_at) VALUES 
(12, 'income', 1, 'IDR', NULL, NULL, 11, 8500000, NULL, 8500000, '2026-11-01', 'Gaji November', NULL, 'manual', '2026-11-07T10:00:00+07:00', '2026-11-07T10:00:00+07:00');

INSERT INTO transactions (id, kind, account_id, currency, to_account_id, to_currency, category_id, amount, amount_to, amount_idr, occurred_on, description, note, source, created_at, updated_at) VALUES 
(13, 'income', 1, 'IDR', NULL, NULL, 12, 750000, NULL, 750000, '2026-11-03', 'Project website client', NULL, 'manual', '2026-11-07T10:00:00+07:00', '2026-11-07T10:00:00+07:00');

-- Expense November: Angka lebih kecil dan realistis
INSERT INTO transactions (id, kind, account_id, currency, to_account_id, to_currency, category_id, amount, amount_to, amount_idr, occurred_on, description, note, source, created_at, updated_at) VALUES 
(14, 'expense', 1, 'IDR', NULL, NULL, 1, 45000, NULL, 45000, '2026-11-02', 'Makan siang Padang', NULL, 'manual', '2026-11-07T10:00:00+07:00', '2026-11-07T10:00:00+07:00');

INSERT INTO transactions (id, kind, account_id, currency, to_account_id, to_currency, category_id, amount, amount_to, amount_idr, occurred_on, description, note, source, created_at, updated_at) VALUES 
(15, 'expense', 2, 'IDR', NULL, NULL, 2, 35000, NULL, 35000, '2026-11-02', 'Grab ke kantor', NULL, 'manual', '2026-11-07T10:00:00+07:00', '2026-11-07T10:00:00+07:00');

INSERT INTO transactions (id, kind, account_id, currency, to_account_id, to_currency, category_id, amount, amount_to, amount_idr, occurred_on, description, note, source, created_at, updated_at) VALUES 
(16, 'expense', 3, 'IDR', NULL, NULL, 1, 185000, NULL, 185000, '2026-11-03', 'Groceries Indomaret', NULL, 'manual', '2026-11-07T10:00:00+07:00', '2026-11-07T10:00:00+07:00');

INSERT INTO transactions (id, kind, account_id, currency, to_account_id, to_currency, category_id, amount, amount_to, amount_idr, occurred_on, description, note, source, created_at, updated_at) VALUES 
(17, 'expense', 1, 'IDR', NULL, NULL, 3, 325000, NULL, 325000, '2026-11-04', 'Beli kemeja', NULL, 'manual', '2026-11-07T10:00:00+07:00', '2026-11-07T10:00:00+07:00');

INSERT INTO transactions (id, kind, account_id, currency, to_account_id, to_currency, category_id, amount, amount_to, amount_idr, occurred_on, description, note, source, created_at, updated_at) VALUES 
(18, 'expense', 1, 'IDR', NULL, NULL, 4, 385000, NULL, 385000, '2026-11-05', 'Internet IndiHome', NULL, 'manual', '2026-11-07T10:00:00+07:00', '2026-11-07T10:00:00+07:00');

INSERT INTO transactions (id, kind, account_id, currency, to_account_id, to_currency, category_id, amount, amount_to, amount_idr, occurred_on, description, note, source, created_at, updated_at) VALUES 
(19, 'expense', 3, 'IDR', NULL, NULL, 1, 52000, NULL, 52000, '2026-11-05', 'Kopi Starbucks', NULL, 'manual', '2026-11-07T10:00:00+07:00', '2026-11-07T10:00:00+07:00');

INSERT INTO transactions (id, kind, account_id, currency, to_account_id, to_currency, category_id, amount, amount_to, amount_idr, occurred_on, description, note, source, created_at, updated_at) VALUES 
(20, 'expense', 1, 'IDR', NULL, NULL, 6, 175000, NULL, 175000, '2026-11-06', 'Nonton bioskop', NULL, 'manual', '2026-11-07T10:00:00+07:00', '2026-11-07T10:00:00+07:00');

INSERT INTO transactions (id, kind, account_id, currency, to_account_id, to_currency, category_id, amount, amount_to, amount_idr, occurred_on, description, note, source, created_at, updated_at) VALUES 
(21, 'expense', 2, 'IDR', NULL, NULL, 2, 150000, NULL, 150000, '2026-11-06', 'Bensin Pertamax', NULL, 'manual', '2026-11-07T10:00:00+07:00', '2026-11-07T10:00:00+07:00');

-- Transfer: Top up GoPay dari BCA
INSERT INTO transactions (id, kind, account_id, currency, to_account_id, to_currency, category_id, amount, amount_to, amount_idr, occurred_on, description, note, source, created_at, updated_at) VALUES 
(22, 'transfer', 1, 'IDR', 3, 'IDR', NULL, 300000, 300000, 300000, '2026-11-07', 'Top up GoPay', NULL, 'manual', '2026-11-07T10:00:00+07:00', '2026-11-07T10:00:00+07:00');

COMMIT;
