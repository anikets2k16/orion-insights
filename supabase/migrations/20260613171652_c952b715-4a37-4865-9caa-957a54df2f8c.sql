
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  default_persona TEXT NOT NULL DEFAULT 'researcher',
  default_threshold REAL NOT NULL DEFAULT 0.7,
  theme TEXT NOT NULL DEFAULT 'system',
  agent_models JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own profile" ON public.profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Research session history
CREATE TABLE public.research_sessions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  name TEXT,
  persona TEXT NOT NULL,
  threshold REAL NOT NULL DEFAULT 0.7,
  status TEXT NOT NULL DEFAULT 'running',
  source_count INTEGER NOT NULL DEFAULT 0,
  insight_count INTEGER NOT NULL DEFAULT 0,
  contradiction_count INTEGER NOT NULL DEFAULT 0,
  report_html TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.research_sessions TO authenticated;
GRANT ALL ON public.research_sessions TO service_role;
ALTER TABLE public.research_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own sessions" ON public.research_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX research_sessions_user_created_idx
  ON public.research_sessions(user_id, created_at DESC);

-- Touch updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER sessions_touch BEFORE UPDATE ON public.research_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
