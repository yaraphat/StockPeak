-- Portfolio tables for Stock Peak
-- Run: psql -U postgres -p 6051 -d stockpeak -f schema-portfolio.sql

CREATE TABLE portfolio_holdings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  ticker text NOT NULL,
  company_name text NOT NULL,
  buy_price numeric NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  buy_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, ticker, buy_date)
);

CREATE INDEX idx_portfolio_user ON portfolio_holdings(user_id);
CREATE INDEX idx_portfolio_ticker ON portfolio_holdings(ticker);
