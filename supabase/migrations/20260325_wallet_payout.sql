-- 1. Add payout fields to mission_submissions if not exists  
ALTER TABLE mission_submissions ADD COLUMN IF NOT EXISTS payout_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE mission_submissions ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE mission_submissions ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id);

-- 2. Create wallet_transactions table if not exists
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('earning', 'withdrawal', 'bonus', 'adjustment')),
  reference_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS for wallet_transactions
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'wallet_transactions' AND policyname = 'users_own_transactions'
  ) THEN
    CREATE POLICY "users_own_transactions" ON wallet_transactions
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'wallet_transactions' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY "service_role_all" ON wallet_transactions
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END
$$;

-- 4. RPC: approve_submission — atomically approve + credit wallet
-- Uses existing wallets table (balance in cents/øre as bigint)
-- p_payout_amount is in major currency units (e.g. 10.00 = 10 EUR/USD)
CREATE OR REPLACE FUNCTION approve_submission(
  p_submission_id UUID,
  p_admin_id UUID,
  p_payout_amount NUMERIC DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_submission mission_submissions%ROWTYPE;
  v_payout NUMERIC;
  v_payout_cents BIGINT;
  v_new_balance BIGINT;
  v_wallet_id UUID;
BEGIN
  -- Get submission
  SELECT * INTO v_submission FROM mission_submissions WHERE id = p_submission_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'submission_not_found');
  END IF;
  
  IF v_submission.status = 'approved' THEN
    RETURN json_build_object('success', false, 'error', 'already_approved');
  END IF;

  -- Determine payout amount (explicit or from mission's reward_amount)
  IF p_payout_amount IS NOT NULL THEN
    v_payout := p_payout_amount;
  ELSE
    -- reward_amount on missions is bigint (cents), convert to major units
    SELECT COALESCE(reward_amount, 0) / 100.0 INTO v_payout 
    FROM missions WHERE id = v_submission.mission_id;
  END IF;
  
  -- Convert to cents for wallet
  v_payout_cents := ROUND(v_payout * 100)::BIGINT;

  -- Update submission status
  UPDATE mission_submissions SET
    status = 'approved',
    approved_at = NOW(),
    approved_by = p_admin_id,
    payout_amount = v_payout,
    reviewed_at = NOW()
  WHERE id = p_submission_id;

  -- Upsert wallet and credit balance (unique key is user_id + currency)
  INSERT INTO wallets (user_id, currency, balance, pending_balance, total_earned, total_withdrawn, created_at)
  VALUES (v_submission.photographer_id, 'USD', v_payout_cents, 0, v_payout_cents, 0, NOW())
  ON CONFLICT (user_id, currency) DO UPDATE SET
    balance = wallets.balance + v_payout_cents,
    total_earned = wallets.total_earned + v_payout_cents
  RETURNING id, balance INTO v_wallet_id, v_new_balance;

  -- Insert wallet transaction log
  INSERT INTO wallet_transactions (user_id, amount, type, reference_id, description)
  VALUES (v_submission.photographer_id, v_payout, 'earning', p_submission_id, 'Mission approved');

  RETURN json_build_object(
    'success', true,
    'payout_amount', v_payout,
    'new_balance_cents', v_new_balance,
    'new_balance', v_new_balance::NUMERIC / 100,
    'submission_id', p_submission_id
  );
END;
$$;
